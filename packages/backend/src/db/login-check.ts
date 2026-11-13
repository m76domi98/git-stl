import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { UserDb } from './user-db.js'

interface LoginFacts {
  role: string
  superuser: boolean
  replication: boolean
  temp_tables: boolean
  create_in_schema: boolean
  bypass_rls: boolean
  create_role: boolean
  create_db: boolean
  member_of_roles: boolean
  owns_tables: boolean
}

/**
 * Fails startup unless `pool` logs in as `expectedRole` with least privilege:
 * not a superuser, can't bypass row level security, create roles or databases,
 * switch into another role, or own (and so skip policies on) any table.
 */
export async function assertRuntimeLogin(pool: Pool, expectedRole: string): Promise<void> {
  const { rows } = await pool.query<LoginFacts>(
    `SELECT r.rolname AS role, r.rolsuper AS superuser,
            r.rolreplication AS replication, r.rolbypassrls AS bypass_rls,
            has_database_privilege(current_database(), 'TEMP') AS temp_tables,
            has_schema_privilege('public', 'CREATE') AS create_in_schema,
            r.rolcreaterole AS create_role, r.rolcreatedb AS create_db,
            EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS member_of_roles,
            EXISTS (SELECT 1 FROM pg_class c WHERE c.relowner = r.oid
                    AND c.relnamespace = 'public'::regnamespace) AS owns_tables
     FROM pg_roles r WHERE r.rolname = current_user`,
  )
  const facts = rows[0]
  if (facts?.role !== expectedRole) {
    throw new Error(
      `Database login must log in as ${expectedRole}, not ${facts?.role ?? 'unknown'}`,
    )
  }
  const excess = (
    [
      ['superuser', facts.superuser],
      ['REPLICATION', facts.replication],
      ['BYPASSRLS', facts.bypass_rls],
      ['CREATEROLE', facts.create_role],
      ['CREATEDB', facts.create_db],
      ['temporary tables', facts.temp_tables],
      ['CREATE on the schema', facts.create_in_schema],
      ['role memberships', facts.member_of_roles],
      ['table ownership', facts.owns_tables],
    ] as const
  )
    .filter(([, has]) => has)
    .map(([name]) => name)
  if (excess.length > 0) {
    throw new Error(`${expectedRole} has more privilege than it needs: ${excess.join(', ')}`)
  }
}

/**
 * Fails startup unless a signed user id round-trips through app_user_id(), which
 * means DB_CONTEXT_KEY matches the key the migrate step stored.
 */
export async function assertSignedUserContext(userDb: UserDb): Promise<void> {
  const probe = randomUUID()
  const rows = await userDb.query<{ id: string | null }>(probe, 'SELECT app_user_id()::text AS id')
  if (rows[0]?.id !== probe) {
    throw new Error('DB_CONTEXT_KEY does not match the key stored by the migrate step')
  }
}
