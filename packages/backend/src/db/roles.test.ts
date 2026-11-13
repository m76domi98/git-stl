import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { assertRuntimeLogin } from './login-check.js'
import { APP_ROLE, resetLogin } from './roles.js'
import adminPool from '../test/admin-pool.js'
import { loginUrl } from '../test/runtime-pools.js'

// A throwaway role, so this never races tests that use the real runtime logins.
const ROLE = 'meshgit_reset_check'

afterAll(async () => {
  await adminPool.query(`DROP ROLE IF EXISTS ${ROLE}`)
  await adminPool.end()
})

describe('resetLogin', () => {
  it('creates a login that passes the least-privilege check', async () => {
    const password = randomUUID()
    await resetLogin(adminPool, ROLE, password)
    const pool = new pg.Pool({
      connectionString: loginUrl(process.env.DATABASE_URL!, ROLE, password),
    })
    try {
      await expect(assertRuntimeLogin(pool, ROLE)).resolves.toBeUndefined()
    } finally {
      await pool.end()
    }
  })

  it('strips extra rights and role memberships from an existing login', async () => {
    await resetLogin(adminPool, ROLE, randomUUID())
    await adminPool.query(`ALTER ROLE ${ROLE} CREATEDB CREATEROLE BYPASSRLS INHERIT`)
    await adminPool.query(`GRANT ${APP_ROLE} TO ${ROLE}`)

    await resetLogin(adminPool, ROLE, randomUUID())

    const { rows } = await adminPool.query(
      `SELECT rolcreatedb, rolcreaterole, rolbypassrls, rolinherit, rolcanlogin,
              (SELECT COUNT(*)::int FROM pg_auth_members WHERE member = r.oid) AS memberships
       FROM pg_roles r WHERE rolname = $1`,
      [ROLE],
    )
    expect(rows[0]).toEqual({
      rolcreatedb: false,
      rolcreaterole: false,
      rolbypassrls: false,
      rolinherit: false,
      rolcanlogin: true,
      memberships: 0,
    })
  })
})
