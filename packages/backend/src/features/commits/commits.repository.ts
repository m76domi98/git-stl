import { lockUser, type Queryable, type UserDb } from '../../db/user-db.js'
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

export interface Usage {
  storedBytes: number
  uploadsToday: number
}

export interface CommitsRepository {
  listForProject(userId: string, projectId: string): Promise<CommitSummary[]>
  findMeshOwned(commitId: string, ownerId: string): Promise<MeshLocation | null>
  /** What a user has stored and uploaded, for the spending caps. */
  usageFor(userId: string): Promise<Usage>
  /**
   * Inserts mesh + commit in one transaction, chained onto the latest commit.
   * `checkQuota` runs inside the transaction under a per-user lock and throws to refuse.
   */
  create(
    input: NewCommit,
    checkQuota: (usage: Usage, incomingBytes: number) => void,
  ): Promise<Commit>
}

/** Another commit claimed the same parent first (unique index violation). */
export class ConcurrentCommitError extends Error {
  constructor() {
    super('Commit created concurrently')
    this.name = 'ConcurrentCommitError'
  }
}

const UNIQUE_VIOLATION = '23505'

async function readUsage(db: Queryable, userId: string): Promise<Usage> {
  const { rows } = await db.query<{ stored_bytes: string; uploads_today: number }>(
    `SELECT COALESCE(SUM(m.file_size), 0)::bigint AS stored_bytes,
            COUNT(*) FILTER (WHERE c.created_at > NOW() - INTERVAL '1 day')::int AS uploads_today
     FROM commits c
     JOIN meshes m ON m.id = c.mesh_id
     WHERE c.author_id = $1`,
    [userId],
  )
  return {
    storedBytes: Number(rows[0]?.stored_bytes ?? 0),
    uploadsToday: rows[0]?.uploads_today ?? 0,
  }
}

/** Every query runs as the signed-in user, so row level security applies. */
export function createCommitsRepository(db: UserDb): CommitsRepository {
  return {
    async listForProject(userId, projectId) {
      return db.query<CommitSummary>(
        userId,
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
    },

    async findMeshOwned(commitId, ownerId) {
      const rows = await db.query<MeshLocation>(
        ownerId,
        `SELECT c.project_id, c.mesh_id FROM commits c
         JOIN projects p ON p.id = c.project_id
         WHERE c.id = $1 AND p.owner_id = $2`,
        [commitId, ownerId],
      )
      return rows[0] ?? null
    },

    usageFor: (userId) => db.transaction(userId, (tx) => readUsage(tx, userId)),

    async create({ projectId, authorId, message, mesh }, checkQuota) {
      try {
        return await db.transaction(authorId, async (tx) => {
          await lockUser(tx, authorId)
          checkQuota(await readUsage(tx, authorId), mesh.fileSize)
          await tx.query(
            'INSERT INTO meshes (id, file_size, vertex_count, face_count) VALUES ($1, $2, $3, $4)',
            [mesh.id, mesh.fileSize, mesh.vertexCount, mesh.faceCount],
          )
          const { rows: parents } = await tx.query<{ id: string }>(
            'SELECT id FROM commits WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
            [projectId],
          )
          const { rows } = await tx.query<Commit>(
            `INSERT INTO commits (project_id, parent_id, mesh_id, author_id, message)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [projectId, parents[0]?.id ?? null, mesh.id, authorId, message],
          )
          return rows[0] as Commit
        })
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new ConcurrentCommitError()
        throw err
      }
    },
  }
}
