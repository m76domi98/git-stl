import pg from 'pg'
import { APP_ROLE } from './row-security.js'

/**
 * The connection string for request queries: same host and database as the
 * admin connection, but logged in as the restricted, non-superuser app role.
 */
export function appDatabaseUrl(adminUrl: string, password: string): string {
  const url = new URL(adminUrl)
  url.username = APP_ROLE
  url.password = encodeURIComponent(password)
  return url.toString()
}

export function createAppPool(adminUrl: string, password: string): pg.Pool {
  return new pg.Pool({ connectionString: appDatabaseUrl(adminUrl, password) })
}
