import pg from 'pg'

/**
 * The meshgit_auth login, for sign-in and GitHub sync. Server startup checks it
 * with assertRuntimeLogin before serving, so a missing or wrong AUTH_DATABASE_URL
 * stops the app. It is never the migration login.
 */
const pool = new pg.Pool({ connectionString: process.env.AUTH_DATABASE_URL })

export default pool
