import { z } from 'zod'
import type { Project } from '../projects/projects.types.js'

export interface Commit {
  id: string
  project_id: string
  parent_id: string | null
  mesh_id: string
  author_id: string
  message: string
  created_at: Date
}

export interface CommitSummary {
  id: string
  parent_id: string | null
  message: string
  created_at: Date
  vertex_count: number | null
  face_count: number | null
  file_size: number | null
  author: string
}

export interface CreatedCommit extends Commit {
  vertex_count: number
  face_count: number
  file_size: number
}

export interface UploadedFile {
  buffer: Buffer
  originalname: string
}

export interface CommitCreatedEvent {
  commit: Commit
  project: Project
  authorId: string
}

export const listCommitsSchema = z.object({ project_id: z.string().uuid() })

export const createCommitSchema = z.object({
  project_id: z.string().uuid(),
  message: z.string().trim().max(2000).optional().default(''),
})

export const commitIdSchema = z.object({ id: z.string().uuid() })
