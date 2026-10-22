import { z } from 'zod'

export interface Project {
  id: string
  owner_id: string
  name: string
  description: string | null
  github_repo_owner: string | null
  github_repo_name: string | null
  created_at: Date
}

export interface ProjectSummary extends Project {
  commit_count: number
}

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((d) => d || null),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const projectIdSchema = z.object({ id: z.string().uuid() })
