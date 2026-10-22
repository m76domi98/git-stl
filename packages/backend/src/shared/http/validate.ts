import type { ZodType, ZodTypeDef } from 'zod'
import { badRequest } from './errors.js'

export function parse<T>(schema: ZodType<T, ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
  throw badRequest('Invalid request', issues)
}
