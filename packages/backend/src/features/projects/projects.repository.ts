import type { UserDb } from '../../db/user-db.js'
import type { CreateProjectInput, Project, ProjectSummary } from './projects.types.js'

export interface ProjectsRepository {
  listByOwner(ownerId: string): Promise<ProjectSummary[]>
  create(ownerId: string, input: CreateProjectInput): Promise<Project>
  findOwned(id: string, ownerId: string): Promise<Project | null>
  countByOwner(ownerId: string): Promise<number>
}

/** Every query runs as the owner, so row level security backs up the owner filters. */
export function createProjectsRepository(db: UserDb): ProjectsRepository {
  return {
    async listByOwner(ownerId) {
      return db.query<ProjectSummary>(
        ownerId,
        `SELECT p.*, COUNT(c.id)::int AS commit_count
         FROM projects p
         LEFT JOIN commits c ON c.project_id = p.id
         WHERE p.owner_id = $1
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [ownerId],
      )
    },

    async create(ownerId, { name, description }) {
      const rows = await db.query<Project>(
        ownerId,
        'INSERT INTO projects (owner_id, name, description) VALUES ($1, $2, $3) RETURNING *',
        [ownerId, name, description],
      )
      return rows[0] as Project
    },

    async findOwned(id, ownerId) {
      const rows = await db.query<Project>(
        ownerId,
        'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
        [id, ownerId],
      )
      return rows[0] ?? null
    },

    async countByOwner(ownerId) {
      const [row] = await db.query<{ count: number }>(
        ownerId,
        'SELECT COUNT(*)::int AS count FROM projects WHERE owner_id = $1',
        [ownerId],
      )
      return row?.count ?? 0
    },
  }
}
