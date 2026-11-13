import type { Pool } from 'pg'

interface LoginFacts {
  role: string
  superuser: boolean
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
    `SELECT r.rolname AS role, r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls,
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
      ['BYPASSRLS', facts.bypass_rls],
      ['CREATEROLE', facts.create_role],
      ['CREATEDB', facts.create_db],
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
