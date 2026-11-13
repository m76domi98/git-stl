import { afterAll, describe, expect, it } from 'vitest'
import { appDatabaseUrl, createAppPool } from './app-pool.js'

const ADMIN_URL = 'postgres://admin:secret@db.internal:5432/meshgit'

describe('appDatabaseUrl', () => {
  it('keeps the host and database but logs in as the app role', () => {
    const url = new URL(appDatabaseUrl(ADMIN_URL, 'app-password-1234'))
    expect(url.username).toBe('meshgit_app')
    expect(url.password).toBe('app-password-1234')
    expect(url.host).toBe('db.internal:5432')
    expect(url.pathname).toBe('/meshgit')
  })

  it('encodes special characters in the password', () => {
    const url = new URL(appDatabaseUrl(ADMIN_URL, 'p@ss:w/rd#?%'))
    expect(decodeURIComponent(url.password)).toBe('p@ss:w/rd#?%')
  })
})

describe('the app login', () => {
  const appPool = createAppPool(process.env.DATABASE_URL!, process.env.APP_DB_PASSWORD!)
  afterAll(() => appPool.end())

  it('is not a superuser and cannot switch back to one', async () => {
    const client = await appPool.connect()
    try {
      await client.query('RESET ROLE')
      const { rows } = await client.query<{ role: string; superuser: boolean }>(
        'SELECT current_user AS role, rolsuper AS superuser FROM pg_roles WHERE rolname = current_user',
      )
      expect(rows[0]).toEqual({ role: 'meshgit_app', superuser: false })
    } finally {
      client.release()
    }
  })

  it('cannot read tokens even without a user set', async () => {
    await expect(appPool.query('SELECT github_access_token FROM users')).rejects.toMatchObject({
      code: '42501',
    })
  })
})
