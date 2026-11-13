import type { Pool } from 'pg'
import { ensureRuntimeRoles, type RuntimePasswords } from './roles.js'
import { applyRowSecurity } from './row-security.js'

/** Creates or updates the schema. Runs as the migration login, never the web app's. */
export async function migrate(pool: Pool, passwords: RuntimePasswords): Promise<void> {
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token TEXT;
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id          UUID NOT NULL REFERENCES users(id),
      name              TEXT NOT NULL,
      description       TEXT,
      github_repo_owner TEXT,
      github_repo_name  TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW()
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

  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo_owner TEXT;
  `)
  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo_name TEXT;
  `)

  // Enforce a single linear chain per project: at most one child per parent,
  // and at most one root commit. Prevents concurrent POST /commits from
  // silently forking history.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS commits_parent_unique
      ON commits (parent_id) WHERE parent_id IS NOT NULL;
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS commits_root_unique
      ON commits (project_id) WHERE parent_id IS NULL;
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS commits_project_created_idx
      ON commits (project_id, created_at DESC);
  `)

  // One row per mesh cleaning started, for the daily processing budget.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS processing_attempts (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS processing_attempts_user_created_idx
      ON processing_attempts (user_id, created_at DESC);
  `)

  await ensureRuntimeRoles(pool, passwords)
  await applyRowSecurity(pool)
}
