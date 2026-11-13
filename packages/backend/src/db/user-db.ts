import type { Pool, PoolClient, QueryResultRow } from 'pg'
import { AppError } from '../shared/http/errors.js'
import { APP_ROLE } from './row-security.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The subset of a client that repositories use inside a user-scoped transaction. */
export type Queryable = Pick<PoolClient, 'query'>

/**
 * Database access for request handlers. Every call runs in a transaction as the
 * restricted app role with `app.user_id` set, so row level security applies.
 */
export interface UserDb {
  query<R extends QueryResultRow>(userId: string, text: string, params?: unknown[]): Promise<R[]>
  transaction<T>(userId: string, fn: (db: Queryable) => Promise<T>): Promise<T>
}

export function createUserDb(pool: Pool): UserDb {
  async function transaction<T>(userId: string, fn: (db: Queryable) => Promise<T>): Promise<T> {
    if (!UUID.test(userId)) throw new AppError(401, 'Not authenticated')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL ROLE ${APP_ROLE}`)
      await client.query("SELECT set_config('app.user_id', $1, true)", [userId])
      const result = await fn(client)
      await client.query('COMMIT')
      client.release()
      return result
    } catch (err) {
      await rollback(client)
      throw err
    }
  }

  return {
    transaction,
    query: (userId, text, params) =>
      transaction(userId, async (db) => (await db.query(text, params)).rows),
  }
}

/**
 * Serializes a user's quota-checked writes for the rest of the transaction, so
 * parallel requests can't all pass a "count < cap" check before any insert lands.
 */
export async function lockUser(db: Queryable, userId: string): Promise<void> {
  await db.query("SELECT pg_advisory_xact_lock(hashtext('meshgit-user:' || $1))", [userId])
}

/** Rolls back and releases; a broken connection is discarded instead of reused. */
export async function rollback(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK')
    client.release()
  } catch (err) {
    client.release(err as Error)
  }
}
