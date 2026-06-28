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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id    UUID NOT NULL REFERENCES users(id),
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS meshes (
      id           UUID PRIMARY KEY,
      file_size    INTEGER,
      vertex_count INTEGER,
      face_count   INTEGER,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS commits (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id),
      parent_id  UUID REFERENCES commits(id),
      mesh_id    UUID NOT NULL REFERENCES meshes(id),
      author_id  UUID NOT NULL REFERENCES users(id),
      message    TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  console.log('Database migrations applied')
}
