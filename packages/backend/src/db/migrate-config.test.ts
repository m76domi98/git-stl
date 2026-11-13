import { describe, expect, it } from 'vitest'
import { loadMigrateConfig } from './migrate-config.js'

const base = {
  DATABASE_URL: 'postgres://owner:p@localhost:5432/db',
  APP_DB_PASSWORD: 'app-password-0123456',
  AUTH_DB_PASSWORD: 'auth-password-012345',
}

describe('loadMigrateConfig', () => {
  it('reads the migration login and both runtime passwords', () => {
    expect(loadMigrateConfig(base)).toEqual({
      databaseUrl: base.DATABASE_URL,
      passwords: { app: base.APP_DB_PASSWORD, auth: base.AUTH_DB_PASSWORD },
    })
  })

  it.each(['DATABASE_URL', 'APP_DB_PASSWORD', 'AUTH_DB_PASSWORD'])('requires %s', (name) => {
    expect(() => loadMigrateConfig({ ...base, [name]: undefined })).toThrow(name)
  })

  it('rejects short passwords and ones that would need escaping in a URL', () => {
    expect(() => loadMigrateConfig({ ...base, APP_DB_PASSWORD: 'short' })).toThrow(/16/)
    expect(() => loadMigrateConfig({ ...base, AUTH_DB_PASSWORD: 'p@ss:word/with#chars' })).toThrow(
      /letters, digits/,
    )
  })
})
