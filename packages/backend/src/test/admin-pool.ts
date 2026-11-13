import pg from 'pg'

/**
 * The migration login, for test setup and fixtures only. The web app never
 * gets this connection; it only has the runtime logins.
 */
const adminPool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

export default adminPool
