import type { Pool } from 'pg'

/** Request queries: scoped to the signed-in user by row level security. */
export const APP_ROLE = 'meshgit_app'
/** The login flow and GitHub sync, which run before a user is known. */
export const AUTH_ROLE = 'meshgit_auth'

export interface RuntimePasswords {
  readonly app: string
  readonly auth: string
}

/**
 * Creates the runtime logins, or resets them to least privilege if they exist:
 * no superuser, no BYPASSRLS, can't create roles or databases, and member of no
 * other role, so neither login can SET ROLE to anything more powerful.
 * Runs as the migration login, which must be allowed to manage roles.
 */
export async function ensureRuntimeRoles(pool: Pool, passwords: RuntimePasswords): Promise<void> {
  const logins: [string, string][] = [
    [APP_ROLE, passwords.app],
    [AUTH_ROLE, passwords.auth],
  ]
  for (const [role, password] of logins) await resetLogin(pool, role, password)
  // Lets the migration login check policies with SET ROLE in tests. This makes the
  // migration login a member of the app role, never the other way round.
  await pool.query(`GRANT ${APP_ROLE} TO CURRENT_USER`)
}

/** Creates `role` if needed and strips it back to a plain login with `password`. */
export async function resetLogin(pool: Pool, role: string, password: string): Promise<void> {
  // DDL can't take $1 parameters, so format() quotes the name and password.
  await runFormatted(
    pool,
    `SELECT format('CREATE ROLE %I', $1::text) AS sql
     WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1::text)`,
    [role],
  )
  await runFormatted(
    pool,
    `SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE
                    NOREPLICATION NOINHERIT CONNECTION LIMIT -1 VALID UNTIL ''infinity''
                    PASSWORD %L', $1::text, $2::text) AS sql`,
    [role, password],
  )
  // Drop any per-role settings, then pin search_path with pg_temp last so a
  // temporary table can never shadow a real one.
  await runFormatted(
    pool,
    `SELECT format('ALTER ROLE %I RESET ALL', $1::text) AS sql
     UNION ALL
     SELECT format('ALTER ROLE %I SET search_path = pg_catalog, public, pg_temp', $1::text)`,
    [role],
  )
  await runFormatted(
    pool,
    `SELECT format('REVOKE %I FROM %I', r.rolname, $1::text) AS sql
     FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid
     WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = $1::text)`,
    [role],
  )
}

/** Runs each statement a `format()` query builds. */
async function runFormatted(pool: Pool, builder: string, params: string[]): Promise<void> {
  const { rows } = await pool.query<{ sql: string }>(builder, params)
  for (const { sql } of rows) await pool.query(sql)
}
