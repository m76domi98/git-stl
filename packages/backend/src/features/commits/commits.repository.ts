import type { Pool } from 'pg'
import type { Commit, CommitSummary } from './commits.types.js'

export interface NewCommit {
  projectId: string
  authorId: string
  message: string
  mesh: { id: string; fileSize: number; vertexCount: number; faceCount: number }
}

export interface MeshLocation {
  project_id: string
  mesh_id: string
}

export interface CommitsRepository {
  listForProject(projectId: string): Promise<CommitSummary[]>
  findMeshOwned(commitId: string, ownerId: string): Promise<MeshLocation | null>
  /** Inserts mesh + commit in one transaction; `persist` runs before COMMIT. */
  create(input: NewCommit, persist: () => Promise<void>): Promise<Commit>
}

/** Another commit claimed the same parent first (unique index violation). */
export class ConcurrentCommitError extends Error {
  constructor() {
    super('Commit created concurrently')
    this.name = 'ConcurrentCommitError'
  }
}

const UNIQUE_VIOLATION = '23505'

export function createCommitsRepository(db: Pool): CommitsRepository {
  return {
    async listForProject(projectId) {
      const { rows } = await db.query<CommitSummary>(
        `SELECT c.id, c.parent_id, c.message, c.created_at,
                m.vertex_count, m.face_count, m.file_size,
                u.github_username AS author
         FROM commits c
         JOIN meshes m ON m.id = c.mesh_id
         JOIN users u ON u.id = c.author_id
         WHERE c.project_id = $1
         ORDER BY c.created_at DESC`,
        [projectId],
      )
      return rows
    },

    async findMeshOwned(commitId, ownerId) {
      const { rows } = await db.query<MeshLocation>(
        `SELECT c.project_id, c.mesh_id FROM commits c
         JOIN projects p ON p.id = c.project_id
         WHERE c.id = $1 AND p.owner_id = $2`,
        [commitId, ownerId],
      )
      return rows[0] ?? null
    },

    async create({ projectId, authorId, message, mesh }, persist) {
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          'INSERT INTO meshes (id, file_size, vertex_count, face_count) VALUES ($1, $2, $3, $4)',
          [mesh.id, mesh.fileSize, mesh.vertexCount, mesh.faceCount],
        )
        const { rows: parents } = await client.query<{ id: string }>(
          'SELECT id FROM commits WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
          [projectId],
        )
        const { rows } = await client.query<Commit>(
          `INSERT INTO commits (project_id, parent_id, mesh_id, author_id, message)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [projectId, parents[0]?.id ?? null, mesh.id, authorId, message],
        )
        await persist()
        await client.query('COMMIT')
        return rows[0] as Commit
      } catch (err) {
        await client.query('ROLLBACK')
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new ConcurrentCommitError()
        throw err
      } finally {
        client.release()
      }
    },
  }
}
