import pg from 'pg'
import { APP_ROLE, AUTH_ROLE } from '../db/roles.js'

/** The test database's connection string with a different login. */
export function loginUrl(adminUrl: string, role: string, password: string): string {
  const url = new URL(adminUrl)
  url.username = role
  url.password = encodeURIComponent(password)
  return url.toString()
}

const adminUrl = process.env.DATABASE_URL ?? ''

/** DB_CONTEXT_KEY, the key the test migration stored for signing user ids. */
export const CONTEXT_KEY = process.env.DB_CONTEXT_KEY ?? ''

/** The real runtime logins, so tests exercise grants and row level security for real. */
export const appPool = new pg.Pool({
  connectionString: loginUrl(adminUrl, APP_ROLE, process.env.APP_DB_PASSWORD ?? ''),
})
export const authPool = new pg.Pool({
  connectionString: loginUrl(adminUrl, AUTH_ROLE, process.env.AUTH_DB_PASSWORD ?? ''),
})
