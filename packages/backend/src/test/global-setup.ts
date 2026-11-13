import { migrate } from '../db/migrate.js'
import pool from '../db/pool.js'

// Integration tests run against a real Postgres at DATABASE_URL, with the app
// and auth logins using APP_DB_PASSWORD and AUTH_DB_PASSWORD.
export async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required to run tests')
  const app = process.env.APP_DB_PASSWORD
  const auth = process.env.AUTH_DB_PASSWORD
  if (!app || !auth)
    throw new Error('APP_DB_PASSWORD and AUTH_DB_PASSWORD are required to run tests')
  await migrate(pool, { app, auth })
  await pool.end()
}
