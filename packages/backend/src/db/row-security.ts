import type { Pool } from 'pg'
import { APP_ROLE, AUTH_ROLE } from './roles.js'

/**
 * Grants and row level security for the runtime logins. Neither login owns
 * the tables, so Postgres applies every policy below to them.
 */
export async function applyRowSecurity(pool: Pool): Promise<void> {
  await pool.query(`
    -- Runtime logins can use the schema but never create objects in it.
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO ${APP_ROLE}, ${AUTH_ROLE};

    CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
      $f$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $f$;

    -- Meshes are written just before their commit, so they carry their own owner.
    ALTER TABLE meshes ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE meshes ALTER COLUMN owner_id SET DEFAULT app_user_id();

    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE meshes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE commits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE cli_auth_codes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE processing_attempts ENABLE ROW LEVEL SECURITY;
  `)
  await applyAppGrants(pool)
  await applyAuthGrants(pool)
}

/** Request queries: read and create the signed-in user's own rows, nothing else. */
async function applyAppGrants(pool: Pool): Promise<void> {
  await pool.query(`
    REVOKE ALL ON users, projects, meshes, commits, cli_auth_codes, processing_attempts
      FROM ${APP_ROLE};
    GRANT SELECT (id, github_username, github_avatar) ON users TO ${APP_ROLE};
    GRANT SELECT, INSERT ON projects, commits, meshes, processing_attempts TO ${APP_ROLE};

    DROP POLICY IF EXISTS processing_attempts_owner ON processing_attempts;
    CREATE POLICY processing_attempts_owner ON processing_attempts FOR ALL TO ${APP_ROLE}
      USING (user_id = app_user_id())
      WITH CHECK (user_id = app_user_id());

    DROP POLICY IF EXISTS users_self ON users;
    CREATE POLICY users_self ON users FOR SELECT TO ${APP_ROLE}
      USING (id = app_user_id());

    DROP POLICY IF EXISTS projects_owner ON projects;
    CREATE POLICY projects_owner ON projects FOR ALL TO ${APP_ROLE}
      USING (owner_id = app_user_id())
      WITH CHECK (owner_id = app_user_id());

    DROP POLICY IF EXISTS commits_owner ON commits;
    CREATE POLICY commits_owner ON commits FOR ALL TO ${APP_ROLE}
      USING (EXISTS (SELECT 1 FROM projects p
                     WHERE p.id = commits.project_id AND p.owner_id = app_user_id()))
      WITH CHECK (author_id = app_user_id() AND EXISTS (
                     SELECT 1 FROM projects p
                     WHERE p.id = commits.project_id AND p.owner_id = app_user_id()));

    DROP POLICY IF EXISTS meshes_read ON meshes;
    CREATE POLICY meshes_read ON meshes FOR SELECT TO ${APP_ROLE}
      USING (EXISTS (SELECT 1 FROM commits c JOIN projects p ON p.id = c.project_id
                     WHERE c.mesh_id = meshes.id AND p.owner_id = app_user_id()));

    DROP POLICY IF EXISTS meshes_insert ON meshes;
    CREATE POLICY meshes_insert ON meshes FOR INSERT TO ${APP_ROLE}
      WITH CHECK (owner_id = app_user_id());
  `)
}

/**
 * The login flow runs before anyone is signed in, so its policies can't key on
 * a user. Grants keep it to exactly the statements it runs: sign-in upserts,
 * logout, CLI login codes, and linking a project to a GitHub repo. It can't
 * create, delete, or touch meshes, and never sees mesh files.
 */
async function applyAuthGrants(pool: Pool): Promise<void> {
  await pool.query(`
    REVOKE ALL ON users, projects, meshes, commits, cli_auth_codes, processing_attempts
      FROM ${AUTH_ROLE};
    GRANT SELECT, INSERT ON users TO ${AUTH_ROLE};
    GRANT UPDATE (github_username, github_avatar, email, github_access_token, tokens_invalidated_at)
      ON users TO ${AUTH_ROLE};
    GRANT SELECT, INSERT, DELETE ON cli_auth_codes TO ${AUTH_ROLE};
    GRANT UPDATE (jwt) ON cli_auth_codes TO ${AUTH_ROLE};
    GRANT SELECT ON projects, commits TO ${AUTH_ROLE};
    GRANT UPDATE (github_repo_owner, github_repo_name) ON projects TO ${AUTH_ROLE};

    DROP POLICY IF EXISTS users_auth ON users;
    CREATE POLICY users_auth ON users FOR ALL TO ${AUTH_ROLE} USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS cli_auth_codes_auth ON cli_auth_codes;
    CREATE POLICY cli_auth_codes_auth ON cli_auth_codes FOR ALL TO ${AUTH_ROLE}
      USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS projects_auth ON projects;
    CREATE POLICY projects_auth ON projects FOR ALL TO ${AUTH_ROLE} USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS commits_auth ON commits;
    CREATE POLICY commits_auth ON commits FOR SELECT TO ${AUTH_ROLE} USING (true);
  `)
}
