import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { testApp } from './test/test-app.js'
import { fakeAuth } from './test/fake-auth.js'

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
