import cors from 'cors'
import express, { type Express } from 'express'
import type { Config } from './config.js'
import type { AuthModule } from './shared/auth/types.js'
import { fail, ok } from './shared/http/envelope.js'
import { errorHandler } from './shared/http/error-handler.js'

export interface AppDeps {
  config: Pick<Config, 'frontendUrl'>
  auth: AuthModule
}

/** Builds the Express app without listening, so tests can drive it directly. */
export function createApp({ config, auth }: AppDeps): Express {
  const app = express()
  app.use(cors({ origin: config.frontendUrl, credentials: true }))
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json(ok({ status: 'ok' }))
  })

  auth.install?.(app)

  app.use('/api', (_req, res) => {
    res.status(404).json(fail('Not found'))
  })

  app.use(errorHandler())
  return app
}
