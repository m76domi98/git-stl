import type { Pool } from 'pg'
import type { CreateProjectInput, Project, ProjectSummary } from './projects.types.js'

export interface ProjectsRepository {
  listByOwner(ownerId: string): Promise<ProjectSummary[]>
  create(ownerId: string, input: CreateProjectInput): Promise<Project>
  findOwned(id: string, ownerId: string): Promise<Project | null>
}

export function createProjectsRepository(db: Pool): ProjectsRepository {
  return {
    async listByOwner(ownerId) {
      const { rows } = await db.query<ProjectSummary>(
        `SELECT p.*, COUNT(c.id)::int AS commit_count
         FROM projects p
         LEFT JOIN commits c ON c.project_id = p.id
         WHERE p.owner_id = $1
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [ownerId],
      )
      return rows
    },

    async create(ownerId, { name, description }) {
      const { rows } = await db.query<Project>(
        'INSERT INTO projects (owner_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [ownerId, name, description],
      )
      return rows[0] as Project
    },

    async findOwned(id, ownerId) {
      const { rows } = await db.query<Project>(
        'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
        [id, ownerId],
      )
      return rows[0] ?? null
    },
  }
}
