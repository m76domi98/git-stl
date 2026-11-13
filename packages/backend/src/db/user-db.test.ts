import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import pool from './pool.js'
import { createUserDb } from './user-db.js'
import { appPool } from '../test/app-pool.js'
import { createUser, deleteUsers } from '../test/fixtures.js'

const userDb = createUserDb(appPool)

let alice: string
let bob: string

beforeAll(async () => {
  alice = await createUser(pool)
  bob = await createUser(pool)
  await pool.query('INSERT INTO projects (owner_id, name) VALUES ($1, $2), ($3, $4)', [
    alice,
    'alice-part',
    bob,
    'bob-part',
  ])
})

afterAll(async () => {
  await deleteUsers(pool, [alice, bob])
  await pool.end()
})

describe('createUserDb', () => {
  it('runs queries as the given user, so other users rows stay hidden', async () => {
    const rows = await userDb.query<{ owner_id: string }>(alice, 'SELECT owner_id FROM projects')
    expect(rows.map((r) => r.owner_id)).toEqual([alice])
  })

  it('runs as the restricted role', async () => {
    const [row] = await userDb.query<{ role: string }>(alice, 'SELECT current_user AS role')
    expect(row?.role).toBe('meshgit_app')
  })

  it('refuses to run on a connection that is not the app login', async () => {
    await expect(createUserDb(pool).query(alice, 'SELECT 1')).rejects.toThrow(/meshgit_app/)
  })

  it('rejects a user id that is not a uuid before touching the database', async () => {
    const connect = vi.spyOn(appPool, 'connect')
    await expect(userDb.query('not-a-uuid', 'SELECT 1')).rejects.toMatchObject({ status: 401 })
    expect(connect).not.toHaveBeenCalled()
    connect.mockRestore()
  })

  it('rolls back everything when the callback throws', async () => {
    await expect(
      userDb.transaction(alice, async (db) => {
        await db.query('INSERT INTO projects (owner_id, name) VALUES ($1, $2)', [alice, 'ghost'])
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    const { rows } = await pool.query("SELECT id FROM projects WHERE name = 'ghost'")
    expect(rows).toEqual([])
  })
})
