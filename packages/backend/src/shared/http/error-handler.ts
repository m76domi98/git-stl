import type { ErrorRequestHandler } from 'express'
import multer from 'multer'
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
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json(fail(`File too large (max ${MAX_UPLOAD_MB} MB)`))
      } else {
        res.status(400).json(fail('Invalid upload'))
      }
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

// body-parser and similar middleware tag their errors with a 4xx status.
function clientErrorStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined
}
