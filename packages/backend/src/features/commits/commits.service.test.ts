import { describe, expect, it, vi } from 'vitest'
import type { MeshStorage } from '../../shared/storage.js'
import { fakeGeometry } from '../../test/test-app.js'
import type { ProjectsRepository } from '../projects/projects.repository.js'
import type { Project } from '../projects/projects.types.js'
import { createCommitEvents } from './commit-events.js'
import { ConcurrentCommitError, type CommitsRepository } from './commits.repository.js'
import { createCommitsService } from './commits.service.js'

const project = { id: 'p1', owner_id: 'u1' } as Project
const file = { buffer: Buffer.from('stl'), originalname: 'a.stl' }

function service(commits: Partial<CommitsRepository>) {
  const projects: ProjectsRepository = {
    listByOwner: vi.fn(),
    create: vi.fn(),
    findOwned: vi.fn(async () => project),
  }
  const storage: MeshStorage = { store: vi.fn(), read: vi.fn(), remove: vi.fn() }
  const svc = createCommitsService({
    commits: commits as CommitsRepository,
    projects,
    geometry: fakeGeometry(),
    storage,
    events: createCommitEvents(),
  })
  return { svc, storage }
}

describe('commits service', () => {
  it('maps a concurrent commit to 409 and removes the stored file', async () => {
    const { svc, storage } = service({
      create: vi.fn().mockRejectedValue(new ConcurrentCommitError()),
    })
    await expect(svc.create('u1', { projectId: 'p1', message: '', file })).rejects.toMatchObject({
      status: 409,
    })
    expect(storage.store).toHaveBeenCalledOnce()
    expect(storage.remove).toHaveBeenCalledWith('p1', vi.mocked(storage.store).mock.calls[0]![1])
  })

  it('returns 404 when the mesh file is missing on disk', async () => {
    const { svc, storage } = service({
      findMeshOwned: vi.fn(async () => ({ project_id: 'p1', mesh_id: 'm1' })),
    })
    vi.mocked(storage.read).mockRejectedValue(Object.assign(new Error('gone'), { code: 'ENOENT' }))
    await expect(svc.readMesh('u1', 'c1')).rejects.toMatchObject({ status: 404 })
  })

  it('rethrows other repository errors untouched', async () => {
    const boom = new Error('db down')
    const { svc } = service({ create: vi.fn().mockRejectedValue(boom) })
    await expect(svc.create('u1', { projectId: 'p1', message: '', file })).rejects.toBe(boom)
  })

  it('returns 404 for a mesh the user does not own', async () => {
    const { svc } = service({ findMeshOwned: vi.fn(async () => null) })
    await expect(svc.readMesh('u1', 'c1')).rejects.toMatchObject({ status: 404 })
  })
})
