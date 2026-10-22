import { Router } from 'express'
import { currentUserId } from '../../shared/auth/types.js'
import { asyncRoute } from '../../shared/http/async-route.js'
import { ok } from '../../shared/http/envelope.js'
import { parse } from '../../shared/http/validate.js'
import type { ProjectsService } from './projects.service.js'
import { createProjectSchema, projectIdSchema } from './projects.types.js'

export function projectsRouter(service: ProjectsService): Router {
  const router = Router()

  router.get(
    '/',
    asyncRoute(async (req, res) => {
      res.json(ok(await service.list(currentUserId(req))))
    }),
  )

  router.post(
    '/',
    asyncRoute(async (req, res) => {
      const input = parse(createProjectSchema, req.body)
      res.status(201).json(ok(await service.create(currentUserId(req), input)))
    }),
  )

  router.get(
    '/:id',
    asyncRoute(async (req, res) => {
      const { id } = parse(projectIdSchema, req.params)
      res.json(ok(await service.get(currentUserId(req), id)))
    }),
  )

  return router
}
