import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'
import { currentUserId } from '../../shared/auth/types.js'
import { asyncRoute } from '../../shared/http/async-route.js'
import { ok } from '../../shared/http/envelope.js'
import { badRequest } from '../../shared/http/errors.js'
import { MAX_UPLOAD_BYTES } from '../../shared/http/limits.js'
import { parse } from '../../shared/http/validate.js'
import type { CommitsService } from './commits.service.js'
import { commitIdSchema, createCommitSchema, listCommitsSchema } from './commits.types.js'

const UPLOAD_RATE_LIMIT = { windowMs: 60_000, limit: 10 }

// NOTE: buffers the whole upload in memory; move to disk/streaming storage if
// concurrent large uploads start pressuring RAM.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, parts: 6 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.stl')) cb(null, true)
    else cb(badRequest('Only STL files are accepted'))
  },
})

export function commitsRouter(service: CommitsService): Router {
  const router = Router()
  // Uploads are expensive (memory + mesh cleaning), so each user gets a small budget.
  const uploadLimit = rateLimit({
    ...UPLOAD_RATE_LIMIT,
    keyGenerator: (req) => currentUserId(req),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })

  router.get(
    '/',
    asyncRoute(async (req, res) => {
      const { project_id } = parse(listCommitsSchema, req.query)
      res.json(ok(await service.list(currentUserId(req), project_id)))
    }),
  )

  router.get(
    '/:id/file',
    asyncRoute(async (req, res) => {
      const { id } = parse(commitIdSchema, req.params)
      const mesh = await service.readMesh(currentUserId(req), id)
      res.set('Content-Type', 'application/octet-stream').send(mesh)
    }),
  )

  router.post(
    '/',
    uploadLimit,
    upload.single('file'),
    asyncRoute(async (req, res) => {
      const { project_id, message } = parse(createCommitSchema, req.body)
      if (!req.file) throw badRequest('STL file required')
      const commit = await service.create(currentUserId(req), {
        projectId: project_id,
        message,
        file: req.file,
      })
      res.status(201).json(ok(commit))
    }),
  )

  return router
}
