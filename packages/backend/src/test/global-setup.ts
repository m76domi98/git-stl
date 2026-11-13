import { loadMigrateConfig } from '../db/migrate-config.js'
import { migrate } from '../db/migrate.js'
import pool from './admin-pool.js'

// Integration tests run against a real Postgres. Setup migrates it as the
// migration login (DATABASE_URL), as `pnpm migrate` would, then tests connect
// with the runtime logins using APP_DB_PASSWORD and AUTH_DB_PASSWORD.
export async function setup(): Promise<void> {
  const { passwords } = loadMigrateConfig()
  await migrate(pool, passwords)
  await pool.end()
}
