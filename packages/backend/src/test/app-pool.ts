import { createAppPool } from '../db/app-pool.js'

/** The restricted login request queries use, so tests exercise row level security for real. */
export const appPool = createAppPool(
  process.env.DATABASE_URL ?? '',
  process.env.APP_DB_PASSWORD ?? '',
)
