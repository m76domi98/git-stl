import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import pool from '../../db/pool.js'
import { AppError } from '../../shared/http/errors.js'
import { createMeshStorage } from '../../shared/storage.js'
import { TEST_USER_HEADER } from '../../test/fake-auth.js'
import { createUser, deleteUsers } from '../../test/fixtures.js'
import { fakeGeometry, testApp } from '../../test/test-app.js'
import { createCommitEvents } from './commit-events.js'

const STL = Buffer.from('solid cube\nendsolid cube\n')

let uploadsDir: string
let alice: string
let bob: string

beforeAll(async () => {
  uploadsDir = await mkdtemp(join(tmpdir(), 'meshgit-commits-'))
  alice = await createUser(pool)
  bob = await createUser(pool)
})

afterAll(async () => {
  await deleteUsers(pool, [alice, bob])
  await pool.end()
  await rm(uploadsDir, { recursive: true, force: true })
})

const as = (userId: string) => ({ [TEST_USER_HEADER]: userId })

function setup(overrides: Parameters<typeof testApp>[0] = {}) {
  const events = createCommitEvents()
  const app = testApp({ storage: createMeshStorage(uploadsDir), events, ...overrides })
  return { app, events }
}

async function newProject(app: ReturnType<typeof testApp>, owner: string): Promise<string> {
  const res = await request(app).post('/api/projects').set(as(owner)).send({ name: 'part' })
  return res.body.data.id
}

const upload = (
  app: ReturnType<typeof testApp>,
  user: string,
  projectId: string,
  message = 'first',
) =>
  request(app)
    .post('/api/commits')
    .set(as(user))
    .field('project_id', projectId)
    .field('message', message)
    .attach('file', STL, 'cube.stl')

describe('POST /api/commits', () => {
  it('cleans, stores and records the mesh, chaining parents', async () => {
    const { app } = setup()
    const projectId = await newProject(app, alice)

    const first = await upload(app, alice, projectId)
    const second = await upload(app, alice, projectId, 'second')

    expect(first.status).toBe(201)
    expect(first.body.data).toMatchObject({
      project_id: projectId,
      parent_id: null,
      message: 'first',
      vertex_count: 8,
      face_count: 12,
      file_size: STL.length,
    })
    expect(second.body.data.parent_id).toBe(first.body.data.id)
    expect(await readdir(join(uploadsDir, projectId))).toHaveLength(2)
  })

  it('stores under the canonical project id even when the request spells it differently', async () => {
    const { app } = setup()
    const projectId = await newProject(app, alice)

    const res = await upload(app, alice, projectId.toUpperCase())

    expect(res.status).toBe(201)
    expect(res.body.data.project_id).toBe(projectId)
    expect(await readdir(uploadsDir)).toContain(projectId)
    expect(await readdir(uploadsDir)).not.toContain(projectId.toUpperCase())
  })

  it("rejects uploads to someone else's project", async () => {
    const { app } = setup()
    const projectId = await newProject(app, alice)
    expect((await upload(app, bob, projectId)).status).toBe(404)
  })

  it('rejects non-STL files and missing files', async () => {
    const { app } = setup()
    const projectId = await newProject(app, alice)

    const wrongType = await request(app)
      .post('/api/commits')
      .set(as(alice))
      .field('project_id', projectId)
      .attach('file', STL, 'cube.obj')
    const missing = await request(app)
      .post('/api/commits')
      .set(as(alice))
      .field('project_id', projectId)

    expect(wrongType.status).toBe(400)
    expect(missing.status).toBe(400)
  })

  it('returns 422 and records nothing when cleaning fails', async () => {
    const geometry = fakeGeometry()
    vi.mocked(geometry.clean).mockRejectedValue(new AppError(422, 'Mesh cleaning failed', 'bad'))
    const { app } = setup({ geometry })
    const projectId = await newProject(app, alice)

    const res = await upload(app, alice, projectId)

    expect(res.status).toBe(422)
    expect(res.body).toEqual({ success: false, error: 'Mesh cleaning failed', details: 'bad' })
    const { rows } = await pool.query('SELECT 1 FROM commits WHERE project_id = $1', [projectId])
    expect(rows).toHaveLength(0)
  })

  it('emits a commit-created event, and a failing listener does not fail the request', async () => {
    const { app, events } = setup()
    const seen = vi.fn()
    events.onCommitCreated(seen)
    events.onCommitCreated(() => {
      throw new Error('github down')
    })
    const projectId = await newProject(app, alice)

    const res = await upload(app, alice, projectId)

    expect(res.status).toBe(201)
    await vi.waitFor(() => expect(seen).toHaveBeenCalledOnce())
    expect(seen.mock.calls[0]![0]).toMatchObject({
      authorId: alice,
      commit: { id: res.body.data.id },
      project: { id: projectId },
    })
  })
})

describe('upload rate limit', () => {
  it('allows 10 uploads per user per minute', async () => {
    const { app } = setup()
    const projectId = await newProject(app, alice)

    for (let i = 0; i < 10; i++) expect((await upload(app, alice, projectId)).status).toBe(201)
    const limited = await upload(app, alice, projectId)
    const otherUser = await request(app)
      .post('/api/commits')
      .set(as(bob))
      .field('project_id', projectId)

    expect(limited.status).toBe(429)
    expect(otherUser.status).not.toBe(429)
  })
})

describe('GET /api/commits', () => {
  it('lists commits newest first with mesh stats and author', async () => {
    const { app } = setup()
    const projectId = await newProject(app, alice)
    await upload(app, alice, projectId, 'one')
    await upload(app, alice, projectId, 'two')

    const res = await request(app).get(`/api/commits?project_id=${projectId}`).set(as(alice))

    expect(res.status).toBe(200)
    expect(res.body.data.map((c: { message: string }) => c.message)).toEqual(['two', 'one'])
    expect(res.body.data[0]).toMatchObject({ vertex_count: 8, author: 'test-user' })
  })

  it('validates project_id and hides other users projects', async () => {
    const { app } = setup()
    const projectId = await newProject(app, alice)

    expect((await request(app).get('/api/commits').set(as(alice))).status).toBe(400)
    expect(
      (await request(app).get(`/api/commits?project_id=${projectId}`).set(as(bob))).status,
    ).toBe(404)
  })
})

describe('GET /api/commits/:id/file', () => {
  it('returns the stored mesh to its owner only', async () => {
    const { app } = setup()
    const projectId = await newProject(app, alice)
    const commitId = (await upload(app, alice, projectId)).body.data.id

    const mine = await request(app).get(`/api/commits/${commitId}/file`).set(as(alice)).buffer(true)
    const theirs = await request(app).get(`/api/commits/${commitId}/file`).set(as(bob))

    expect(mine.status).toBe(200)
    expect(mine.headers['content-type']).toBe('application/octet-stream')
    expect(Buffer.from(mine.body).equals(STL)).toBe(true)
    expect(theirs.status).toBe(404)
  })
})
