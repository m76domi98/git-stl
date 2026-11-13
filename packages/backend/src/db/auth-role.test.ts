import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pool from '../test/admin-pool.js'
import { createUser, deleteUsers } from '../test/fixtures.js'
import { authPool } from '../test/runtime-pools.js'

const PERMISSION_DENIED = '42501'

let owner: string
let project: string

/** Runs one statement over the real auth login, then rolls back. */
async function asAuth(sql: string, params: unknown[] = []): Promise<unknown[]> {
  const client = await authPool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(sql, params)
    return rows
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

beforeAll(async () => {
  owner = await createUser(pool)
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO projects (owner_id, name) VALUES ($1, $2) RETURNING id',
    [owner, 'linked-part'],
  )
  project = rows[0]!.id
})

afterAll(async () => {
  await deleteUsers(pool, [owner])
  await Promise.all([pool.end(), authPool.end()])
})

describe('the auth login', () => {
  it('runs the sign-in upsert, logout, and token lookup', async () => {
    const upsert = `INSERT INTO users (github_id, github_username, github_avatar, email, github_access_token)
      VALUES ($1, 'octo', NULL, NULL, 'enc') ON CONFLICT (github_id) DO UPDATE
      SET github_username = EXCLUDED.github_username, github_avatar = EXCLUDED.github_avatar,
          email = COALESCE(EXCLUDED.email, users.email), github_access_token = EXCLUDED.github_access_token
      RETURNING *`
    await expect(asAuth(upsert, [`gh-${randomUUID()}`])).resolves.toHaveLength(1)
    await expect(
      asAuth('UPDATE users SET tokens_invalidated_at = NOW() WHERE id = $1', [owner]),
    ).resolves.toEqual([])
    await expect(
      asAuth('SELECT github_access_token FROM users WHERE id = $1', [owner]),
    ).resolves.toHaveLength(1)
  })

  it('manages CLI login codes', async () => {
    const code = randomUUID()
    await expect(
      asAuth(
        `WITH i AS (INSERT INTO cli_auth_codes (device_code, state_token, user_code, expires_at)
                    VALUES ($1, $1, 'ABCD', NOW() + INTERVAL '5 minutes') RETURNING device_code)
         SELECT device_code FROM i`,
        [code],
      ),
    ).resolves.toHaveLength(1)
    await expect(
      asAuth("UPDATE cli_auth_codes SET jwt = 'x' WHERE state_token = $1", [code]),
    ).resolves.toEqual([])
    await expect(asAuth('DELETE FROM cli_auth_codes WHERE expires_at < NOW()')).resolves.toEqual([])
  })

  it('links a project to a GitHub repo and reads its latest commit', async () => {
    await expect(
      asAuth("UPDATE projects SET github_repo_owner = 'o', github_repo_name = 'r' WHERE id = $1", [
        project,
      ]),
    ).resolves.toEqual([])
    await expect(
      asAuth('SELECT id FROM commits WHERE project_id = $1', [project]),
    ).resolves.toEqual([])
  })

  it.each([
    ['rename a project', "UPDATE projects SET name = 'x'"],
    ['create a project', "INSERT INTO projects (owner_id, name) VALUES (gen_random_uuid(), 'x')"],
    ['delete a project', 'DELETE FROM projects'],
    ['delete a user', 'DELETE FROM users'],
    ['read meshes', 'SELECT id FROM meshes'],
    ['create a commit', 'INSERT INTO commits (project_id, mesh_id, author_id) VALUES ($1, $1, $1)'],
  ])('cannot %s', async (_name, sql) => {
    const params = sql.includes('$1') ? [randomUUID()] : []
    await expect(asAuth(sql, params)).rejects.toMatchObject({ code: PERMISSION_DENIED })
  })

  it('cannot switch to the app role or the migration role', async () => {
    const migrationRole = new URL(process.env.DATABASE_URL!).username
    for (const role of ['meshgit_app', migrationRole]) {
      await expect(asAuth(`SET ROLE "${role}"`)).rejects.toMatchObject({ code: PERMISSION_DENIED })
    }
  })
})
