import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  GEOMETRY_SERVICE_URL: z.string().url().default('http://geometry:8000'),
  UPLOADS_DIR: z.string().min(1).default('/app/uploads'),
  // 'github' loads the local auth module; 'dev' uses the built-in stub (never in production).
  AUTH_MODE: z.enum(['github', 'dev']).default('github'),
})

export interface Config {
  readonly nodeEnv: 'development' | 'test' | 'production'
  readonly port: number
  readonly databaseUrl: string
  readonly frontendUrl: string
  readonly geometryServiceUrl: string
  readonly uploadsDir: string
  readonly authMode: 'github' | 'dev'
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
    databaseUrl: e.DATABASE_URL,
    frontendUrl: e.FRONTEND_URL,
    geometryServiceUrl: e.GEOMETRY_SERVICE_URL,
    uploadsDir: e.UPLOADS_DIR,
    authMode: e.AUTH_MODE,
  })
}
