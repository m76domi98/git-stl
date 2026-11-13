import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pool from '../../db/pool.js'
import { DEFAULT_QUOTAS, type Quotas } from '../../shared/quotas.js'
import { createMeshStorage } from '../../shared/storage.js'
import { TEST_USER_HEADER } from '../../test/fake-auth.js'
import { createUser, deleteUsers } from '../../test/fixtures.js'
import { fakeGeometry, testApp } from '../../test/test-app.js'

const STL = Buffer.from('solid cube\nendsolid cube\n')

let uploadsDir: string
const users: string[] = []

beforeAll(async () => {
  uploadsDir = await mkdtemp(join(tmpdir(), 'meshgit-quotas-'))
})

afterAll(async () => {
  await deleteUsers(pool, users)
  await pool.end()
  await rm(uploadsDir, { recursive: true, force: true })
})

async function setup(quotas: Partial<Quotas>) {
  const user = await createUser(pool)
  users.push(user)
  const geometry = fakeGeometry()
  const app = testApp({
    storage: createMeshStorage(uploadsDir),
    geometry,
    quotas: { ...DEFAULT_QUOTAS, ...quotas },
  })
  const as = { [TEST_USER_HEADER]: user }
  const project = await request(app).post('/api/projects').set(as).send({ name: 'part' })
  const upload = () =>
    request(app)
      .post('/api/commits')
      .set(as)
      .field('project_id', project.body.data.id)
      .field('message', 'm')
      .attach('file', STL, 'cube.stl')
  return { upload, geometry }
}

describe('upload spending caps', () => {
  it('refuses uploads past the daily limit, before cleaning the mesh', async () => {
    const { upload, geometry } = await setup({ maxUploadsPerDay: 2 })

    expect((await upload()).status).toBe(201)
    expect((await upload()).status).toBe(201)
    const third = await upload()

    expect(third.status).toBe(429)
    expect(third.body.error).toBe('Daily upload limit reached')
    expect(geometry.clean).toHaveBeenCalledTimes(2)
  })

  it('refuses an upload that would go past the storage limit', async () => {
    const { upload, geometry } = await setup({ maxStorageBytes: STL.length * 2 - 1 })

    expect((await upload()).status).toBe(201)
    const second = await upload()

    expect(second.status).toBe(403)
    expect(second.body.error).toBe('Storage limit reached')
    expect(geometry.clean).toHaveBeenCalledTimes(1)
  })
})
