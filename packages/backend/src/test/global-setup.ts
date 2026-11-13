import { migrate } from '../db/migrate.js'
import pool from '../db/pool.js'

// Integration tests run against a real Postgres at DATABASE_URL, with the app
// role logging in with APP_DB_PASSWORD.
export async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run tests')
  const appPassword = process.env.APP_DB_PASSWORD
  if (!appPassword) throw new Error('APP_DB_PASSWORD is required to run tests')
  await migrate(pool, { appPassword })
  await pool.end()
}
