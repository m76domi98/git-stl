import type { Pool } from 'pg'
import { ok } from '../http/envelope.js'
import { asyncRoute } from '../http/async-route.js'
import type { AuthModule } from './types.js'

export const DEV_USER = Object.freeze({
  id: '00000000-0000-4000-8000-000000000001',
  githubId: 'dev-user',
  username: 'dev',
})

/** Signs every request in as one local user. Refuses to run in production. */
export function createDevAuth(db: Pool, nodeEnv: string): AuthModule {
  if (nodeEnv === 'production') {
    throw new Error('AUTH_MODE=dev is not allowed when NODE_ENV=production')
  }

  let ensured: Promise<unknown> | undefined
  const ensureUser = (): Promise<unknown> => {
    ensured ??= db
      .query(
        `INSERT INTO users (id, github_id, github_username) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [DEV_USER.id, DEV_USER.githubId, DEV_USER.username],
      )
      .catch((err: unknown) => {
        ensured = undefined
        throw err
      })
    return ensured
  }

  const authenticate = asyncRoute(async (req, _res, next) => {
    await ensureUser()
    req.user = { userId: DEV_USER.id }
    next()
  })

  return {
    authenticate,
    install(app) {
      app.get('/api/auth/me', authenticate, (_req, res) => {
        res.json(ok({ userId: DEV_USER.id, github_username: DEV_USER.username }))
      })
    },
  }
}
