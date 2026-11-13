import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createUserDb } from '../../db/user-db.js'
import adminPool from '../../test/admin-pool.js'
import { createUser, deleteUsers } from '../../test/fixtures.js'
import { appPool } from '../../test/runtime-pools.js'
import { createProcessingBudget } from './processing-budget.js'

const userDb = createUserDb(appPool)
const budget = createProcessingBudget(userDb)

let user: string

const attemptAges = async () => {
  const { rows } = await adminPool.query<{ days: number }>(
    `SELECT EXTRACT(DAY FROM NOW() - created_at)::int AS days
     FROM processing_attempts WHERE user_id = $1 ORDER BY created_at`,
    [user],
  )
  return rows.map((r) => r.days)
}

beforeAll(async () => {
  user = await createUser(adminPool)
})

afterAll(async () => {
  await deleteUsers(adminPool, [user])
  await Promise.all([adminPool.end(), appPool.end()])
})

describe('processing budget', () => {
  it("prunes the user's attempts older than two days when claiming", async () => {
    await adminPool.query(
      `INSERT INTO processing_attempts (user_id, created_at)
       VALUES ($1, NOW() - INTERVAL '5 days'), ($1, NOW() - INTERVAL '1 day 1 hour')`,
      [user],
    )

    await expect(budget.claim(user, 10)).resolves.toBe(true)

    expect(await attemptAges()).toEqual([1, 0])
  })

  it('cannot delete attempts that still count, even with a direct query', async () => {
    const before = await attemptAges()
    await expect(userDb.query(user, 'DELETE FROM processing_attempts')).resolves.toEqual([])
    expect(await attemptAges()).toEqual(before)
  })
})
