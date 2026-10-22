import type { Express, Request, RequestHandler } from 'express'
import { AppError } from '../http/errors.js'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      userId: string
    }
    interface Request {
      user?: User
    }
  }
}

/**
 * The pluggable auth layer. The GitHub implementation lives outside the public
 * repo; `createDevAuth` is the stand-in for local development.
 */
export interface AuthModule {
  /** Rejects unauthenticated requests and sets `req.user`. */
  authenticate: RequestHandler
  /** Mounts the module's own middleware and routes (sessions, login, callbacks). */
  install?(app: Express): void
}

export function currentUserId(req: Request): string {
  if (!req.user) throw new AppError(401, 'Not authenticated')
  return req.user.userId
}
