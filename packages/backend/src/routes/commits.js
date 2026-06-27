import { Router } from 'express'

const router = Router()

router.get('/', (_req, res) => res.status(501).json({ error: 'Not implemented' }))
router.post('/', (_req, res) => res.status(501).json({ error: 'Not implemented' }))
router.get('/history', (_req, res) => res.status(501).json({ error: 'Not implemented' }))

export default router
