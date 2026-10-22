import { migrate } from '../db/migrate.js'
import pool from '../db/pool.js'

// Integration tests run against a real Postgres at DATABASE_URL.
export async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run tests')
  await migrate(pool)
  await pool.end()
}
