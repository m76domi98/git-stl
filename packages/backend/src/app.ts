import cors from 'cors'
import express, { type Express } from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import type { Pool } from 'pg'
import type { Config } from './config.js'
import type { CommitEvents } from './features/commits/commit-events.js'
import { createCommitsRepository } from './features/commits/commits.repository.js'
import { commitsRouter } from './features/commits/commits.routes.js'
import { createCommitsService } from './features/commits/commits.service.js'
import { diffRouter } from './features/diff/diff.routes.js'
import { mergeRouter } from './features/merge/merge.routes.js'
import { createUserDb } from './db/user-db.js'
import { createProjectsRepository } from './features/projects/projects.repository.js'
import { projectsRouter } from './features/projects/projects.routes.js'
import { createProjectsService } from './features/projects/projects.service.js'
import type { AuthModule } from './shared/auth/types.js'
import { fail, ok } from './shared/http/envelope.js'
import { errorHandler } from './shared/http/error-handler.js'
import type { GeometryClient } from './shared/geometry/geometry-client.js'
import { DEFAULT_QUOTAS, type Quotas } from './shared/quotas.js'
import type { MeshStorage } from './shared/storage.js'

const JSON_BODY_LIMIT = '100kb'
const RATE_LIMIT = { windowMs: 60_000, limit: 300 }

export interface AppDeps {
  config: Pick<Config, 'frontendUrl'>
  auth: AuthModule
  db: Pool
  geometry: GeometryClient
  storage: MeshStorage
  events: CommitEvents
  /** Per-user spending caps; defaults apply when omitted. */
  quotas?: Quotas
}

/** Builds the Express app without listening, so tests can drive it directly. */
export function createApp(deps: AppDeps): Express {
  const { config, auth, db } = deps
  const app = express()
  app.use(helmet())
  app.use('/api', rateLimit({ ...RATE_LIMIT, standardHeaders: 'draft-7', legacyHeaders: false }))
  app.use(cors({ origin: config.frontendUrl, credentials: true }))
  app.use(express.json({ limit: JSON_BODY_LIMIT }))

  app.get('/api/health', (_req, res) => {
    res.json(ok({ status: 'ok' }))
  })

  auth.install?.(app)

  const userDb = createUserDb(db)
  const projectsRepo = createProjectsRepository(userDb)
  const commits = createCommitsService({
    commits: createCommitsRepository(userDb),
    projects: projectsRepo,
    geometry: deps.geometry,
    storage: deps.storage,
    events: deps.events,
    quotas: deps.quotas ?? DEFAULT_QUOTAS,
  })

  app.use('/api/projects', auth.authenticate, projectsRouter(createProjectsService(projectsRepo)))
  app.use('/api/commits', auth.authenticate, commitsRouter(commits))
  app.use('/api/diff', auth.authenticate, diffRouter())
  app.use('/api/merge', auth.authenticate, mergeRouter())

  app.use('/api', (_req, res) => {
    res.status(404).json(fail('Not found'))
  })

  app.use(errorHandler())
  return app
}
