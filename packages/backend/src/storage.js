import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads'

export async function storeMesh(projectId, meshId, buffer) {
  const dir = join(UPLOADS_DIR, projectId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${meshId}.stl`), buffer)
}

export async function readMesh(projectId, meshId) {
  return readFile(join(UPLOADS_DIR, projectId, `${meshId}.stl`))
}
