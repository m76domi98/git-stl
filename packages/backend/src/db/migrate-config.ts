import { z } from 'zod'
import type { RuntimePasswords } from './roles.js'

// Letters, digits, - and _ only, so the passwords drop into connection strings unescaped.
const password = z
  .string()
  .min(16, 'must be at least 16 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'must use only letters, digits, - and _')

const migrateEnvSchema = z.object({
  // The migration login: owns the schema and manages the runtime roles.
  DATABASE_URL: z.string().min(1),
  APP_DB_PASSWORD: password,
  AUTH_DB_PASSWORD: password,
})

export interface MigrateConfig {
  readonly databaseUrl: string
  readonly passwords: RuntimePasswords
}

/** Settings for the migrate command only. The web app never reads these. */
export function loadMigrateConfig(
  env: Record<string, string | undefined> = process.env,
): MigrateConfig {
  const parsed = migrateEnvSchema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment: ${problems.join('; ')}`)
  }
  const e = parsed.data
  return Object.freeze({
    databaseUrl: e.DATABASE_URL,
    passwords: Object.freeze({ app: e.APP_DB_PASSWORD, auth: e.AUTH_DB_PASSWORD }),
  })
}
