import pool from '../db.js'

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      github_id       TEXT UNIQUE NOT NULL,
      github_username TEXT NOT NULL,
      github_avatar   TEXT,
      email           TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cli_auth_codes (
      device_code TEXT PRIMARY KEY,
      state_token TEXT UNIQUE NOT NULL,
      jwt         TEXT,
      expires_at  TIMESTAMPTZ NOT NULL
    );
  `)

  await pool.query(`
    ALTER TABLE cli_auth_codes ADD COLUMN IF NOT EXISTS state_token TEXT UNIQUE;
  `)

  await pool.query(`
    ALTER TABLE cli_auth_codes ADD COLUMN IF NOT EXISTS user_code TEXT;
  `)

  // Track when a user's tokens were last invalidated (server-side logout)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_invalidated_at TIMESTAMPTZ;
  `)

  console.log('Database migrations applied')
}
