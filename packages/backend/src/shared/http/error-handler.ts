import type { ErrorRequestHandler } from 'express'
import { fail } from './envelope.js'
import { AppError } from './errors.js'

type Logger = (message: string, err: unknown) => void

const MAX_UPLOAD_MB = 500

export function errorHandler(log: Logger = console.error): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json(fail(err.message, err.details))
      return
    }
    if (isMulterSizeError(err)) {
      res.status(413).json(fail(`File too large (max ${MAX_UPLOAD_MB} MB)`))
      return
    }
    log(`[ERROR] ${req.method} ${req.originalUrl}`, err)
    res.status(500).json(fail('Internal server error'))
  }
}

function isMulterSizeError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { code?: string }).code === 'LIMIT_FILE_SIZE'
}
