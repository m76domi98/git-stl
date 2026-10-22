import 'dotenv/config'
import { createApp } from './app.js'
import { loadAuth } from './auth-loader.js'
import { loadConfig } from './config.js'
import { migrate } from './db/migrate.js'
import pool from './db/pool.js'
import { createCommitEvents } from './features/commits/commit-events.js'
import { createGeometryClient } from './shared/geometry/geometry-client.js'
import { createMeshStorage } from './shared/storage.js'

async function main(): Promise<void> {
  const config = loadConfig()
  await migrate(pool)

  const storage = createMeshStorage(config.uploadsDir)
  const events = createCommitEvents()
  const auth = await loadAuth({ config, db: pool, storage, events })
  if (config.authMode === 'dev')
    console.warn('AUTH_MODE=dev: every request is signed in as the dev user')

  const app = createApp({
    config,
    auth,
    db: pool,
    geometry: createGeometryClient(config.geometryServiceUrl),
    storage,
    events,
  })
  app.listen(config.port, () => {
    process.stdout.write(`Backend running on port ${config.port}\n`)
  })
}

main().catch((err: unknown) => {
  console.error('Failed to start backend:', err)
  process.exit(1)
})
