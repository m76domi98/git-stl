import { z } from 'zod'
import { DEFAULT_QUOTAS, type Quotas } from './shared/quotas.js'

const MB = 1024 * 1024
const cap = (fallback: number) => z.coerce.number().int().min(1).default(fallback)
const postgresUrl = z
  .string()
  .refine((u) => URL.canParse(u) && /^postgres(ql)?:$/.test(new URL(u).protocol), {
    message: 'must be a postgres:// URL',
  })

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    // The web app only gets the two least-privilege logins. The migration login
    // (DATABASE_URL) belongs to the separate migrate command.
    APP_DATABASE_URL: postgresUrl,
    AUTH_DATABASE_URL: postgresUrl,
    FRONTEND_URL: z
      .string()
      .url()
      .default('http://localhost:5173')
      .transform((u) => new URL(u).origin),
    GEOMETRY_SERVICE_URL: z.string().url().default('http://geometry:8000'),
    UPLOADS_DIR: z.string().min(1).default('/app/uploads'),
    // 'github' loads the local auth module; 'dev' uses the built-in stub (never in production).
    AUTH_MODE: z.enum(['github', 'dev']).default('github'),
    // Per-user spending caps.
    QUOTA_STORAGE_MB: cap(DEFAULT_QUOTAS.maxStorageBytes / MB),
    QUOTA_UPLOADS_PER_DAY: cap(DEFAULT_QUOTAS.maxUploadsPerDay),
    QUOTA_PROCESSING_PER_DAY: cap(DEFAULT_QUOTAS.maxProcessingPerDay),
    QUOTA_PROJECTS: cap(DEFAULT_QUOTAS.maxProjects),
  })
  .refine((e) => !(e.AUTH_MODE === 'dev' && e.NODE_ENV === 'production'), {
    message: 'AUTH_MODE=dev is not allowed when NODE_ENV=production',
    path: ['AUTH_MODE'],
  })

export interface Config {
  readonly nodeEnv: 'development' | 'test' | 'production'
  readonly port: number
  /** meshgit_app: request queries, scoped to the signed-in user. */
  readonly appDatabaseUrl: string
  /** meshgit_auth: sign-in and GitHub sync. */
  readonly authDatabaseUrl: string
  readonly frontendUrl: string
  readonly geometryServiceUrl: string
  readonly uploadsDir: string
  readonly authMode: 'github' | 'dev'
  readonly quotas: Quotas
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment: ${problems.join('; ')}`)
  }
  const e = parsed.data
  return Object.freeze({
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    appDatabaseUrl: e.APP_DATABASE_URL,
    authDatabaseUrl: e.AUTH_DATABASE_URL,
    frontendUrl: e.FRONTEND_URL,
    geometryServiceUrl: e.GEOMETRY_SERVICE_URL,
    uploadsDir: e.UPLOADS_DIR,
    authMode: e.AUTH_MODE,
    quotas: Object.freeze({
      maxStorageBytes: e.QUOTA_STORAGE_MB * MB,
      maxUploadsPerDay: e.QUOTA_UPLOADS_PER_DAY,
      maxProcessingPerDay: e.QUOTA_PROCESSING_PER_DAY,
      maxProjects: e.QUOTA_PROJECTS,
    }),
  })
}
