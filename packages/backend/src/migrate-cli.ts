import 'dotenv/config'
import pg from 'pg'
import { loadMigrateConfig } from './db/migrate-config.js'
import { migrate } from './db/migrate.js'

/**
 * Runs migrations as the migration login, then exits. It's a separate command
 * so the web app never holds credentials that own the schema.
 */
async function main(): Promise<void> {
  const config = loadMigrateConfig()
  const pool = new pg.Pool({ connectionString: config.databaseUrl })
  try {
    await migrate(pool, config.passwords)
  } finally {
    await pool.end()
  }
  process.stdout.write('Migrations applied\n')
}

main().catch((err: unknown) => {
  // Messages only: driver errors can carry connection details.
  console.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
