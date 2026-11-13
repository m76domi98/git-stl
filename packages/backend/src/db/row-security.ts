import type { Pool } from 'pg'

/**
 * The restricted role request queries run as. It is not a superuser and does
 * not own the tables, so Postgres applies the row level security policies below.
 * Auth and migrations keep using the connection's own role.
 */
export const APP_ROLE = 'meshgit_app'

export async function applyRowSecurity(pool: Pool): Promise<void> {
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
        CREATE ROLE ${APP_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
      END IF;
    END $$;
    GRANT ${APP_ROLE} TO CURRENT_USER;
    GRANT USAGE ON SCHEMA public TO ${APP_ROLE};

    -- Least privilege: only what the API needs today.
    REVOKE ALL ON users, projects, meshes, commits, cli_auth_codes FROM ${APP_ROLE};
    GRANT SELECT (id, github_username, github_avatar) ON users TO ${APP_ROLE};
    GRANT SELECT, INSERT ON projects, commits, meshes TO ${APP_ROLE};

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
