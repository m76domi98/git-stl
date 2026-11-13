import { createHmac } from 'node:crypto'
import type { Pool } from 'pg'
import { APP_ROLE, AUTH_ROLE } from './roles.js'

/**
 * How row level security learns who the signed-in user is, without trusting a
 * setting any session could change.
 *
 * For each transaction, UserDb sets `app.user_id` and `app.user_sig`, an HMAC of
 * `<user id>:<transaction id>` keyed with DB_CONTEXT_KEY. `app_user_id()` returns
 * the user only when that signature checks out. The key lives in an owner-only
 * table, read by `app_user_id()` as a SECURITY DEFINER function, so SQL running
 * as a runtime login can't read it or forge a signature. Binding the signature to
 * the transaction id means a leaked one can't be replayed in another transaction.
 */
export function signUserContext(key: string, userId: string, transactionId: string): string {
  return createHmac('sha256', key).update(`${userId}:${transactionId}`).digest('hex')
}

/** Stores the key and (re)creates `app_user_id()`. Runs as the migration login. */
export async function applyUserContext(pool: Pool, key: string): Promise<void> {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS app_context_key (
      id  BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
      key TEXT NOT NULL
    );
    -- Owner only: no grants and no policies, so the runtime logins can't read it.
    REVOKE ALL ON app_context_key FROM PUBLIC, ${APP_ROLE}, ${AUTH_ROLE};
    ALTER TABLE app_context_key ENABLE ROW LEVEL SECURITY;
  `)
  await pool.query(
    `INSERT INTO app_context_key (id, key) VALUES (true, $1)
     ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key`,
    [key],
  )
  await pool.query(`
    CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
      LANGUAGE plpgsql STABLE SECURITY DEFINER
      SET search_path = pg_catalog, public
    AS $f$
    DECLARE
      uid text := current_setting('app.user_id', true);
      sig text := current_setting('app.user_sig', true);
      expected text;
    BEGIN
      IF coalesce(uid, '') = '' OR coalesce(sig, '') = '' THEN
        RETURN NULL;
      END IF;
      SELECT encode(hmac(uid || ':' || pg_current_xact_id()::text, k.key, 'sha256'), 'hex')
        INTO expected FROM app_context_key k;
      IF expected IS NULL OR expected <> sig THEN
        RETURN NULL;
      END IF;
      RETURN uid::uuid;
    END
    $f$;
    REVOKE ALL ON FUNCTION app_user_id() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION app_user_id() TO ${APP_ROLE}, ${AUTH_ROLE};
  `)
}
