import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { signUserContext } from './user-context.js'
import { createUserDb } from './user-db.js'
import adminPool from '../test/admin-pool.js'
import { createUser, deleteUsers } from '../test/fixtures.js'
import { CONTEXT_KEY, appPool, authPool } from '../test/runtime-pools.js'

// Every query here goes over the real meshgit_app login, as request queries do.
// None of them filter by owner, so only grants and row level security stand
// between user A and user B's data.

const PERMISSION_DENIED = '42501'
const userDb = createUserDb(appPool, { contextKey: CONTEXT_KEY })

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
  await Promise.all([adminPool.end(), appPool.end(), authPool.end()])
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

  it("refuses a commit that points at B's mesh", async () => {
    const { rows } = await adminPool.query<{ id: string }>(
      'INSERT INTO meshes (id, owner_id) VALUES (gen_random_uuid(), $1) RETURNING id',
      [bob],
    )
    const aliceProject = await userDb.query<{ id: string }>(alice, 'SELECT id FROM projects')
    await expect(
      userDb.query(
        alice,
        'INSERT INTO commits (project_id, mesh_id, author_id) VALUES ($1, $2, $3)',
        [aliceProject[0]!.id, rows[0]!.id, alice],
      ),
    ).rejects.toMatchObject({ code: PERMISSION_DENIED })
    await adminPool.query('DELETE FROM meshes WHERE id = $1', [rows[0]!.id])
  })

  it('refuses to create a project owned by B', async () => {
    await expect(
      userDb.query(alice, "INSERT INTO projects (owner_id, name) VALUES ($1, 'planted')", [bob]),
    ).rejects.toMatchObject({ code: PERMISSION_DENIED })
  })
})

describe('the runtime login cannot gain more privilege', () => {
  const migrationRole = new URL(process.env.DATABASE_URL!).username

  it('cannot create a temporary table that would shadow a real one', async () => {
    await expect(appPool.query('CREATE TEMP TABLE projects (id uuid)')).rejects.toMatchObject({
      code: PERMISSION_DENIED,
    })
  })

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

describe('a session cannot pose as another user by setting app.user_id', () => {
  // Arbitrary SQL as meshgit_app can set any setting, but app_user_id() only
  // trusts a user id signed with DB_CONTEXT_KEY for the current transaction.

  /** Runs one select as a session that sets the context itself. */
  async function poseAs(userId: string, sig: (xid: string) => string): Promise<unknown[]> {
    const client = await appPool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ xid: string }>(
        'SELECT pg_current_xact_id()::text AS xid',
      )
      await client.query(
        "SELECT set_config('app.user_id', $1, true), set_config('app.user_sig', $2, true)",
        [userId, sig(rows[0]!.xid)],
      )
      return (await client.query('SELECT owner_id FROM projects')).rows
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  }

  it('sees nothing with no signature, or one forged without the key', async () => {
    await expect(poseAs(bob, () => '')).resolves.toEqual([])
    await expect(poseAs(bob, (xid) => signUserContext('guessed-key', bob, xid))).resolves.toEqual(
      [],
    )
  })

  it("can't replay a signature from another transaction", async () => {
    await expect(poseAs(bob, () => signUserContext(CONTEXT_KEY, bob, '1'))).resolves.toEqual([])
  })

  it.each([
    ['meshgit_app', () => appPool],
    ['meshgit_auth', () => authPool],
  ])("can't read the signing key or its column statistics as %s", async (_role, pool) => {
    await expect(pool().query('SELECT key FROM app_context_key')).rejects.toMatchObject({
      code: PERMISSION_DENIED,
    })
    const { rows } = await pool().query(
      "SELECT most_common_vals FROM pg_stats WHERE tablename = 'app_context_key'",
    )
    expect(rows).toEqual([])
  })

  it('reads as the user when the signature is genuine', async () => {
    await expect(poseAs(bob, (xid) => signUserContext(CONTEXT_KEY, bob, xid))).resolves.toEqual([
      { owner_id: bob },
    ])
  })
})
