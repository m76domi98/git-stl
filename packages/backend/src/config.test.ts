import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' }

describe('loadConfig', () => {
  it('applies defaults for optional settings', () => {
    const config = loadConfig(base)

    expect(config).toEqual({
      nodeEnv: 'development',
      port: 3001,
      databaseUrl: base.DATABASE_URL,
      frontendUrl: 'http://localhost:5173',
      geometryServiceUrl: 'http://geometry:8000',
      uploadsDir: '/app/uploads',
      authMode: 'github',
    })
  })

  it('reads explicit values', () => {
    const config = loadConfig({
      ...base,
      NODE_ENV: 'production',
      PORT: '8080',
      FRONTEND_URL: 'https://meshgit.example',
      GEOMETRY_SERVICE_URL: 'http://localhost:8000',
      UPLOADS_DIR: '/tmp/uploads',
      AUTH_MODE: 'dev',
    })

    expect(config.port).toBe(8080)
    expect(config.nodeEnv).toBe('production')
    expect(config.authMode).toBe('dev')
    expect(config.uploadsDir).toBe('/tmp/uploads')
  })

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/)
  })

  it('rejects an unknown AUTH_MODE', () => {
    expect(() => loadConfig({ ...base, AUTH_MODE: 'none' })).toThrow(/AUTH_MODE/)
  })

  it('rejects a non-numeric PORT', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/)
  })

  it('returns a frozen object', () => {
    expect(Object.isFrozen(loadConfig(base))).toBe(true)
  })
})
