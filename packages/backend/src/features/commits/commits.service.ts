import { randomUUID } from 'node:crypto'
import { conflict, notFound } from '../../shared/http/errors.js'
import type { GeometryClient } from '../../shared/geometry/geometry-client.js'
import type { MeshStorage } from '../../shared/storage.js'
import type { ProjectsRepository } from '../projects/projects.repository.js'
import type { CommitEvents } from './commit-events.js'
import { ConcurrentCommitError, type CommitsRepository } from './commits.repository.js'
import type { CommitSummary, CreatedCommit, UploadedFile } from './commits.types.js'

export interface CommitsService {
  list(userId: string, projectId: string): Promise<CommitSummary[]>
  readMesh(userId: string, commitId: string): Promise<Buffer>
  create(
    userId: string,
    input: { projectId: string; message: string; file: UploadedFile },
  ): Promise<CreatedCommit>
}

export interface CommitsServiceDeps {
  commits: CommitsRepository
  projects: ProjectsRepository
  geometry: GeometryClient
  storage: MeshStorage
  events: CommitEvents
}

export function createCommitsService(deps: CommitsServiceDeps): CommitsService {
  const { commits, projects, geometry, storage, events } = deps

  const ownedProject = async (userId: string, projectId: string) => {
    const project = await projects.findOwned(projectId, userId)
    if (!project) throw notFound('Project')
    return project
  }

  return {
    async list(userId, projectId) {
      const project = await ownedProject(userId, projectId)
      return commits.listForProject(project.id)
    },

    async readMesh(userId, commitId) {
      const location = await commits.findMeshOwned(commitId, userId)
      if (!location) throw notFound('Commit')
      try {
        return await storage.read(location.project_id, location.mesh_id)
      } catch (err) {
        if ((err as { code?: string }).code === 'ENOENT') throw notFound('Mesh file')
        throw err
      }
    },

    async create(userId, { projectId, message, file }) {
      const project = await ownedProject(userId, projectId)
      const cleaned = await geometry.clean(file.buffer)
      const mesh = {
        id: randomUUID(),
        fileSize: cleaned.data.length,
        vertexCount: cleaned.vertexCount,
        faceCount: cleaned.faceCount,
      }

      // Always key storage and rows by the DB's canonical project.id, never the raw request value.
      // The file is written before the transaction so slow disk I/O never holds a DB connection.
      await storage.store(project.id, mesh.id, cleaned.data)
      let commit
      try {
        commit = await commits.create({ projectId: project.id, authorId: userId, message, mesh })
      } catch (err) {
        await storage.remove(project.id, mesh.id)
        if (err instanceof ConcurrentCommitError)
          throw conflict('Commit created concurrently, retry')
        throw err
      }

      events.emitCommitCreated({ commit, project, authorId: userId })
      return {
        ...commit,
        vertex_count: mesh.vertexCount,
        face_count: mesh.faceCount,
        file_size: mesh.fileSize,
      }
    },
  }
}
