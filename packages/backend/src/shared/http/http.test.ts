import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { fail, ok } from './envelope.js'
import { AppError, badRequest, conflict, notFound } from './errors.js'
import { errorHandler } from './error-handler.js'
import { asyncRoute } from './async-route.js'
import { parse } from './validate.js'

function appThatThrows(err: unknown, log = vi.fn()) {
  const app = express()
  app.get(
    '/',
    asyncRoute(async () => {
      throw err
    }),
  )
  app.use(errorHandler(log))
  return { app, log }
}

describe('envelope', () => {
  it('wraps data and errors', () => {
    expect(ok({ a: 1 })).toEqual({ success: true, data: { a: 1 } })
    expect(fail('nope')).toEqual({ success: false, error: 'nope' })
    expect(fail('nope', ['x'])).toEqual({ success: false, error: 'nope', details: ['x'] })
  })
})

describe('errors', () => {
  it('builds typed errors with a status', () => {
    expect(notFound('Project')).toMatchObject({ status: 404, message: 'Project not found' })
    expect(badRequest('bad')).toMatchObject({ status: 400, message: 'bad' })
    expect(conflict('again')).toMatchObject({ status: 409, message: 'again' })
    expect(new AppError(422, 'x', { d: 1 }).details).toEqual({ d: 1 })
  })
})

describe('errorHandler', () => {
  it('maps an AppError to its status and envelope', async () => {
    const { app } = appThatThrows(new AppError(422, 'Mesh cleaning failed', 'bad mesh'))
    const res = await request(app).get('/')
    expect(res.status).toBe(422)
    expect(res.body).toEqual({ success: false, error: 'Mesh cleaning failed', details: 'bad mesh' })
  })

  it('maps multer size errors to 413', async () => {
    const { app } = appThatThrows(Object.assign(new Error('too big'), { code: 'LIMIT_FILE_SIZE' }))
    const res = await request(app).get('/')
    expect(res.status).toBe(413)
    expect(res.body.success).toBe(false)
  })

  it('hides unexpected error messages from the client and logs them', async () => {
    const { app, log } = appThatThrows(new Error('connection string postgres://secret'))
    const res = await request(app).get('/')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ success: false, error: 'Internal server error' })
    expect(log).toHaveBeenCalledOnce()
  })

  it('handles non-Error throws', async () => {
    const { app } = appThatThrows('a string')
    const res = await request(app).get('/')
    expect(res.status).toBe(500)
  })
})

describe('parse', () => {
  const schema = z.object({ name: z.string().min(1) })

  it('returns parsed data', () => {
    expect(parse(schema, { name: 'cube' })).toEqual({ name: 'cube' })
  })

  it('throws a 400 AppError listing the issues', () => {
    try {
      parse(schema, { name: '' })
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).status).toBe(400)
      expect((err as AppError).details).toEqual([{ path: 'name', message: expect.any(String) }])
    }
  })
})

describe('errorHandler client errors', () => {
  it('returns the 4xx status of middleware errors without logging', async () => {
    const { app, log } = appThatThrows(
      Object.assign(new Error('Unexpected token'), { status: 400 }),
    )
    const res = await request(app).get('/')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Invalid request' })
    expect(log).not.toHaveBeenCalled()
  })
})
