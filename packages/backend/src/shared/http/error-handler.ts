import type { ErrorRequestHandler } from 'express'
import { fail } from './envelope.js'
import { AppError } from './errors.js'
import { MAX_UPLOAD_MB } from './limits.js'

type Logger = (message: string, err: unknown) => void

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
    const clientStatus = clientErrorStatus(err)
    if (clientStatus) {
      res.status(clientStatus).json(fail('Invalid request'))
      return
    }
    log(`[ERROR] ${req.method} ${req.originalUrl}`, err)
    res.status(500).json(fail('Internal server error'))
  }
}

function isMulterSizeError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { code?: string }).code === 'LIMIT_FILE_SIZE'
}

// body-parser and similar middleware tag their errors with a 4xx status.
function clientErrorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined
}
