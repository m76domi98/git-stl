import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createUserDb } from './user-db.js'
import adminPool from '../test/admin-pool.js'
import { createUser, deleteUsers } from '../test/fixtures.js'
import { appPool } from '../test/runtime-pools.js'

// Every query here goes over the real meshgit_app login, as request queries do.
// None of them filter by owner, so only grants and row level security stand
// between user A and user B's data.

const PERMISSION_DENIED = '42501'
const userDb = createUserDb(appPool)

let alice: string
let bob: string
let bobProject: string

beforeAll(async () => {
  alice = await createUser(adminPool)
  bob = await createUser(adminPool)
  const { rows } = await adminPool.query<{ id: string; owner_id: string }>(
    `INSERT INTO projects (owner_id, name) VALUES ($1, 'alice-part'), ($2, 'bob-part')
     RETURNING id, owner_id`,
    [alice, bob],
  )
  bobProject = rows.find((r) => r.owner_id === bob)!.id
})

afterAll(async () => {
  await deleteUsers(adminPool, [alice, bob])
  await Promise.all([adminPool.end(), appPool.end()])
})

describe("the runtime login keeps user A out of user B's projects", () => {
  it("returns only A's rows from an unfiltered select", async () => {
    const rows = await userDb.query<{ owner_id: string }>(alice, 'SELECT owner_id FROM projects')
    expect(rows.map((r) => r.owner_id)).toEqual([alice])
  })

  it("finds nothing when A asks for B's project by id", async () => {
    await expect(
      userDb.query(alice, 'SELECT * FROM projects WHERE id = $1', [bobProject]),
    ).resolves.toEqual([])
  })

  it.each([
    ['rename', "UPDATE projects SET name = 'taken'"],
    ['delete', 'DELETE FROM projects'],
  ])("refuses to %s any project, so B's stays untouched", async (_verb, sql) => {
    await expect(userDb.query(alice, sql)).rejects.toMatchObject({ code: PERMISSION_DENIED })
    const { rows } = await adminPool.query('SELECT name FROM projects WHERE id = $1', [bobProject])
    expect(rows).toEqual([{ name: 'bob-part' }])
  })

  it('refuses to create a project owned by B', async () => {
    await expect(
      userDb.query(alice, "INSERT INTO projects (owner_id, name) VALUES ($1, 'planted')", [bob]),
    ).rejects.toMatchObject({ code: PERMISSION_DENIED })
  })
})

describe('the runtime login cannot gain more privilege', () => {
  const migrationRole = new URL(process.env.DATABASE_URL!).username

  it.each([
    ['SET ROLE', `SET ROLE "${migrationRole}"`],
    ['SET SESSION AUTHORIZATION', `SET SESSION AUTHORIZATION "${migrationRole}"`],
    ['SET ROLE to the auth login', 'SET ROLE meshgit_auth'],
  ])('refuses %s', async (_name, sql) => {
    await expect(appPool.query(sql)).rejects.toMatchObject({ code: PERMISSION_DENIED })
  })

  it('stays meshgit_app after RESET ROLE', async () => {
    const client = await appPool.connect()
    try {
      await client.query('RESET ROLE')
      const { rows } = await client.query('SELECT current_user AS role')
      expect(rows).toEqual([{ role: 'meshgit_app' }])
    } finally {
      client.release()
    }
  })
})

describe('known risk: the current user comes from a setting the login can change', () => {
  // app_user_id() reads the app.user_id setting, and any session can call
  // set_config. UserDb sets it from the verified session, but someone who could
  // run arbitrary SQL as meshgit_app could set it to another user's id and read
  // their rows. Grants still cap what they could do: no updates, deletes,
  // tokens, or login codes. This test documents the gap; change it when it closes.
  it('lets a session that sets app.user_id itself read as that user', async () => {
    const client = await appPool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT set_config('app.user_id', $1, true)", [bob])
      const { rows } = await client.query('SELECT owner_id FROM projects')
      expect(rows).toEqual([{ owner_id: bob }])
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  })
})
