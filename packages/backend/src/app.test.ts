import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { testApp } from './test/test-app.js'
import { fakeAuth, TEST_USER_HEADER } from './test/fake-auth.js'

describe('createApp', () => {
  it('serves the health check', async () => {
    const res = await request(testApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } })
  })

  it('lets the auth module install its routes', async () => {
    const install = vi.fn((app) =>
      app.get('/api/auth/ping', (_req: unknown, res: { send: (s: string) => void }) =>
        res.send('pong'),
      ),
    )
    const app = testApp({ auth: { ...fakeAuth, install } })

    expect(install).toHaveBeenCalledOnce()
    expect((await request(app).get('/api/auth/ping')).text).toBe('pong')
  })

  it('answers unknown api routes with a JSON 404', async () => {
    const res = await request(testApp()).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, error: 'Not found' })
  })

  it('only allows the configured frontend origin', async () => {
    const res = await request(testApp()).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })
})

describe('request bodies', () => {
  it('answers malformed JSON with 400', async () => {
    const res = await request(testApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"oops"')
    expect(res.status).toBe(400)
  })
})

describe('hardening', () => {
  it('sets security headers and rate limit headers', async () => {
    const res = await request(testApp()).get('/api/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['ratelimit-policy']).toBeDefined()
  })
})

describe('authentication', () => {
  const SOME_ID = '00000000-0000-4000-8000-0000000000aa'
  const PROTECTED_ROUTES: Array<['get' | 'post', string]> = [
    ['get', '/api/projects'],
    ['post', '/api/projects'],
    ['get', `/api/projects/${SOME_ID}`],
    ['get', `/api/commits?project_id=${SOME_ID}`],
    ['post', '/api/commits'],
    ['get', `/api/commits/${SOME_ID}/file`],
    ['get', '/api/diff'],
    ['post', '/api/merge'],
  ]

  it.each(PROTECTED_ROUTES)('%s %s rejects requests without a user', async (method, path) => {
    const res = await request(testApp())[method](path)
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('rejects an upload without a user before reading the file', async () => {
    const res = await request(testApp())
      .post('/api/commits')
      .field('project_id', SOME_ID)
      .field('message', 'sneaky')
      .attach('file', Buffer.from('solid x\nendsolid x\n'), 'x.stl')
    expect(res.status).toBe(401)
  })
})

describe('unbuilt features', () => {
  it('answer 501 behind auth', async () => {
    const app = testApp()
    expect((await request(app).get('/api/diff')).status).toBe(401)
    expect((await request(app).get('/api/diff').set(TEST_USER_HEADER, 'u')).status).toBe(501)
    expect((await request(app).post('/api/merge').set(TEST_USER_HEADER, 'u')).status).toBe(501)
  })
})
