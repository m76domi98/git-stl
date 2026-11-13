import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pool from '../test/admin-pool.js'
import { APP_ROLE } from './roles.js'
import { signUserContext } from './user-context.js'
import { CONTEXT_KEY } from '../test/runtime-pools.js'
import { createUser, deleteUsers } from '../test/fixtures.js'

const PERMISSION_DENIED = '42501'

let alice: string
let bob: string
let bobProject: string
let bobMesh: string

/** Runs one statement as the restricted app role, then rolls back. */
async function asUser<T>(userId: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${APP_ROLE}`)
    if (userId) {
      const { rows } = await client.query<{ xid: string }>(
        'SELECT pg_current_xact_id()::text AS xid',
      )
      await client.query(
        "SELECT set_config('app.user_id', $1, true), set_config('app.user_sig', $2, true)",
        [userId, signUserContext(CONTEXT_KEY, userId, rows[0]!.xid)],
      )
    }
    const { rows } = await client.query(sql, params)
    return rows as T[]
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

beforeAll(async () => {
  alice = await createUser(pool)
  bob = await createUser(pool)
  await pool.query('INSERT INTO projects (owner_id, name) VALUES ($1, $2)', [alice, 'alice-part'])
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO projects (owner_id, name) VALUES ($1, $2) RETURNING id',
    [bob, 'bob-part'],
  )
  bobProject = rows[0]!.id
  bobMesh = randomUUID()
  await pool.query('INSERT INTO meshes (id, file_size, owner_id) VALUES ($1, 10, $2)', [
    bobMesh,
    bob,
  ])
  await pool.query(
    'INSERT INTO commits (project_id, mesh_id, author_id, message) VALUES ($1, $2, $3, $4)',
    [bobProject, bobMesh, bob, 'bob commit'],
  )
})

afterAll(async () => {
  await deleteUsers(pool, [alice, bob])
  await pool.end()
})

describe('row level security for the app role', () => {
  it('shows a user only their own projects', async () => {
    const rows = await asUser<{ owner_id: string }>(alice, 'SELECT owner_id FROM projects')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.owner_id === alice)).toBe(true)
  })

  it('shows nothing when no user is set', async () => {
    expect(await asUser(null, 'SELECT id FROM projects')).toEqual([])
  })

  it("hides other users' commits and meshes", async () => {
    expect(
      await asUser(alice, 'SELECT id FROM commits WHERE project_id = $1', [bobProject]),
    ).toEqual([])
    expect(await asUser(alice, 'SELECT id FROM meshes WHERE id = $1', [bobMesh])).toEqual([])
    expect(await asUser(bob, 'SELECT id FROM meshes WHERE id = $1', [bobMesh])).toHaveLength(1)
  })

  it('refuses to create a project for someone else', async () => {
    await expect(
      asUser(alice, 'INSERT INTO projects (owner_id, name) VALUES ($1, $2)', [bob, 'sneaky']),
    ).rejects.toMatchObject({ code: PERMISSION_DENIED })
  })

  it("refuses to commit into someone else's project", async () => {
    const mesh = randomUUID()
    await expect(
      asUser(
        alice,
        `WITH m AS (INSERT INTO meshes (id) VALUES ($1))
         INSERT INTO commits (project_id, mesh_id, author_id) VALUES ($2, $1, $3)`,
        [mesh, bobProject, alice],
      ),
    ).rejects.toMatchObject({ code: PERMISSION_DENIED })
  })

  it('stamps new meshes with the user and refuses meshes owned by someone else', async () => {
    await expect(
      asUser(alice, 'INSERT INTO meshes (id) VALUES ($1)', [randomUUID()]),
    ).resolves.toEqual([])
    await expect(
      asUser(alice, 'INSERT INTO meshes (id, owner_id) VALUES ($1, $2)', [randomUUID(), bob]),
    ).rejects.toMatchObject({ code: PERMISSION_DENIED })
  })

  it('cannot update or delete projects at all', async () => {
    await expect(asUser(alice, "UPDATE projects SET name = 'x'")).rejects.toMatchObject({
      code: PERMISSION_DENIED,
    })
    await expect(asUser(alice, 'DELETE FROM projects')).rejects.toMatchObject({
      code: PERMISSION_DENIED,
    })
  })

  it('cannot read tokens or login codes', async () => {
    await expect(asUser(alice, 'SELECT github_access_token FROM users')).rejects.toMatchObject({
      code: PERMISSION_DENIED,
    })
    await expect(asUser(alice, 'SELECT * FROM cli_auth_codes')).rejects.toMatchObject({
      code: PERMISSION_DENIED,
    })
  })
})
