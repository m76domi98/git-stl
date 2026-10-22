import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface MeshStorage {
  store(projectId: string, meshId: string, data: Buffer): Promise<void>
  read(projectId: string, meshId: string): Promise<Buffer>
  /** Deletes a mesh; succeeds if it is already gone. */
  remove(projectId: string, meshId: string): Promise<void>
}

// Postgres returns UUIDs in this exact form; anything else must not reach a file path.
const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function assertId(id: string): void {
  if (!CANONICAL_UUID.test(id)) throw new Error(`Invalid storage id: ${JSON.stringify(id)}`)
}

export function createMeshStorage(uploadsDir: string): MeshStorage {
  const meshPath = (projectId: string, meshId: string): string => {
    assertId(projectId)
    assertId(meshId)
    return join(uploadsDir, projectId, `${meshId}.stl`)
  }

  return {
    async store(projectId, meshId, data) {
      const path = meshPath(projectId, meshId)
      await mkdir(join(uploadsDir, projectId), { recursive: true })
      // Meshes are immutable once committed; never overwrite one.
      await writeFile(path, data, { flag: 'wx' })
    },
    async read(projectId, meshId) {
      return readFile(meshPath(projectId, meshId))
    },
    async remove(projectId, meshId) {
      await rm(meshPath(projectId, meshId), { force: true })
    },
  }
}
