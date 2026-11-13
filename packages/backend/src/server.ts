import 'dotenv/config'
import pg from 'pg'
import { createApp } from './app.js'
import { loadAuth } from './auth-loader.js'
import { loadConfig } from './config.js'
import { assertRuntimeLogin, assertSignedUserContext } from './db/login-check.js'
import authPool from './db/pool.js'
import { APP_ROLE, AUTH_ROLE } from './db/roles.js'
import { createUserDb } from './db/user-db.js'
import { createCommitEvents } from './features/commits/commit-events.js'
import { createGeometryClient } from './shared/geometry/geometry-client.js'
import { createMeshStorage } from './shared/storage.js'

async function main(): Promise<void> {
  const config = loadConfig()
  // Migrations run separately (pnpm migrate). The app holds only these two logins,
  // and refuses to start if either one is missing or more powerful than it should be.
  const appPool = new pg.Pool({ connectionString: config.appDatabaseUrl })
  // An idle connection dropped by a Postgres restart shouldn't crash the process.
  for (const pool of [appPool, authPool]) {
    pool.on('error', (err) => console.error(`Database connection error: ${err.message}`))
  }
  await assertRuntimeLogin(appPool, APP_ROLE)
  await assertRuntimeLogin(authPool, AUTH_ROLE)
  await assertSignedUserContext(createUserDb(appPool, { contextKey: config.dbContextKey }))

  const storage = createMeshStorage(config.uploadsDir)
  const events = createCommitEvents()
  const auth = await loadAuth({ config, db: authPool, storage, events })
  if (config.authMode === 'dev') {
    console.warn(
      'WARNING: AUTH_MODE=dev. Every request is signed in as the dev user. Local use only.',
    )
  }

  const app = createApp({
    config,
    auth,
    db: appPool,
    geometry: createGeometryClient(config.geometryServiceUrl),
    storage,
    events,
    quotas: config.quotas,
  })
  app.listen(config.port, () => {
    process.stdout.write(`Backend running on port ${config.port}\n`)
  })
}

main().catch((err: unknown) => {
  // Messages only: driver errors can carry connection details.
  const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : ''
  console.error(
    `Failed to start backend: ${err instanceof Error ? err.message : String(err)}${cause}`,
  )
  process.exit(1)
})
