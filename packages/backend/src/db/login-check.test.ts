import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { assertRuntimeLogin, assertSignedUserContext } from './login-check.js'
import { APP_ROLE, AUTH_ROLE } from './roles.js'
import { createUserDb } from './user-db.js'
import adminPool from '../test/admin-pool.js'
import { CONTEXT_KEY, appPool, authPool, loginUrl } from '../test/runtime-pools.js'

afterAll(() => Promise.all([adminPool.end(), appPool.end(), authPool.end()]))

describe('assertRuntimeLogin', () => {
  it('accepts the least-privilege app and auth logins', async () => {
    await expect(assertRuntimeLogin(appPool, APP_ROLE)).resolves.toBeUndefined()
    await expect(assertRuntimeLogin(authPool, AUTH_ROLE)).resolves.toBeUndefined()
  })

  it('refuses a login for the wrong role', async () => {
    await expect(assertRuntimeLogin(authPool, APP_ROLE)).rejects.toThrow(
      /must log in as meshgit_app/,
    )
  })

  it('refuses the migration login', async () => {
    await expect(assertRuntimeLogin(adminPool, APP_ROLE)).rejects.toThrow(/meshgit_app/)
  })

  it('names every excess privilege on a login with the right role name', async () => {
    const role = 'meshgit_check_overpowered'
    const password = randomUUID()
    await adminPool.query(`DROP ROLE IF EXISTS ${role}`)
    const { rows } = await adminPool.query<{ sql: string }>(
      "SELECT format('CREATE ROLE %I LOGIN CREATEDB PASSWORD %L', $1::text, $2::text) AS sql",
      [role, password],
    )
    await adminPool.query(rows[0]!.sql)
    await adminPool.query(`GRANT ${APP_ROLE} TO ${role}`)
    await adminPool.query(
      `GRANT CONNECT ON DATABASE "${new URL(process.env.DATABASE_URL!).pathname.slice(1)}" TO ${role}`,
    )
    const pool = new pg.Pool({
      connectionString: loginUrl(process.env.DATABASE_URL!, role, password),
    })
    try {
      await expect(assertRuntimeLogin(pool, role)).rejects.toThrow(
        `${role} has more privilege than it needs: CREATEDB, role memberships`,
      )
    } finally {
      await pool.end()
      await adminPool.query(`DROP OWNED BY ${role}`)
      await adminPool.query(`DROP ROLE ${role}`)
    }
  })
})

describe('assertSignedUserContext', () => {
  it('passes when the app signs with the key the migration stored', async () => {
    await expect(
      assertSignedUserContext(createUserDb(appPool, { contextKey: CONTEXT_KEY })),
    ).resolves.toBeUndefined()
  })

  it('fails startup when DB_CONTEXT_KEY differs from the stored key', async () => {
    const wrong = createUserDb(appPool, { contextKey: 'not-the-stored-key-0123456789abcdef' })
    await expect(assertSignedUserContext(wrong)).rejects.toThrow(/DB_CONTEXT_KEY/)
  })
})
