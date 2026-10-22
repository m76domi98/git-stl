import express from 'express'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import pool from '../../db/pool.js'
import { DEV_USER, createDevAuth } from './dev-auth.js'
import { currentUserId } from './types.js'

afterAll(async () => {
  await pool.end()
})

function appWith(auth: ReturnType<typeof createDevAuth>) {
  const app = express()
  auth.install?.(app)
  app.get('/whoami', auth.authenticate, (req, res) => {
    res.json({ userId: currentUserId(req) })
  })
  return app
}

describe('createDevAuth', () => {
  it('refuses to run in production', () => {
    expect(() => createDevAuth(pool, 'production')).toThrow(/production/)
  })

  it('signs requests in as the dev user and creates the user row', async () => {
    const app = appWith(createDevAuth(pool, 'test'))

    const res = await request(app).get('/whoami')

    expect(res.body).toEqual({ userId: DEV_USER.id })
    const { rows } = await pool.query('SELECT github_username FROM users WHERE id = $1', [
      DEV_USER.id,
    ])
    expect(rows).toEqual([{ github_username: 'dev' }])
  })

  it('exposes /api/auth/me', async () => {
    const res = await request(appWith(createDevAuth(pool, 'development'))).get('/api/auth/me')
    expect(res.body).toEqual({
      success: true,
      data: { userId: DEV_USER.id, github_username: 'dev' },
    })
  })
})

describe('currentUserId', () => {
  it('throws 401 when no user is set', () => {
    expect(() => currentUserId({} as express.Request)).toThrow(/Not authenticated/)
  })
})
