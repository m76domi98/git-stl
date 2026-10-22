import { Router } from 'express'
import { fail } from '../../shared/http/envelope.js'

// Placeholder until the diff feature lands.
export function diffRouter(): Router {
  const router = Router()
  router.get('/', (_req, res) => {
    res.status(501).json(fail('Not implemented'))
  })
  return router
}
