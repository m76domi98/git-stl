import cors from 'cors'
import express, { type Express } from 'express'
import type { Pool } from 'pg'
import type { Config } from './config.js'
import { createProjectsRepository } from './features/projects/projects.repository.js'
import { projectsRouter } from './features/projects/projects.routes.js'
import { createProjectsService } from './features/projects/projects.service.js'
import type { AuthModule } from './shared/auth/types.js'
import { fail, ok } from './shared/http/envelope.js'
import { errorHandler } from './shared/http/error-handler.js'

export interface AppDeps {
  config: Pick<Config, 'frontendUrl'>
  auth: AuthModule
  db: Pool
}

/** Builds the Express app without listening, so tests can drive it directly. */
export function createApp({ config, auth, db }: AppDeps): Express {
  const app = express()
  app.use(cors({ origin: config.frontendUrl, credentials: true }))
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json(ok({ status: 'ok' }))
  })

  auth.install?.(app)

  const projects = createProjectsService(createProjectsRepository(db))
  app.use('/api/projects', auth.authenticate, projectsRouter(projects))

  app.use('/api', (_req, res) => {
    res.status(404).json(fail('Not found'))
  })

  app.use(errorHandler())
  return app
}
