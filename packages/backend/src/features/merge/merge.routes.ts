import { Router } from 'express'
import { fail } from '../../shared/http/envelope.js'

// Placeholder until the merge feature lands.
export function mergeRouter(): Router {
  const router = Router()
  router.post('/', (_req, res) => {
    res.status(501).json(fail('Not implemented'))
  })
  return router
}
