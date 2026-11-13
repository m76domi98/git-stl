import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import pool from '../../test/admin-pool.js'
import { AppError } from '../../shared/http/errors.js'
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

/** A geometry client whose first `failures` cleans reject, like a broken file would. */
function flakyGeometry(failures: number) {
  const geometry = fakeGeometry()
  const succeed = geometry.clean
  let calls = 0
  geometry.clean = vi.fn(async (file: Buffer) => {
    calls += 1
    if (calls <= failures) throw new AppError(422, 'Mesh cleaning failed')
    return succeed(file)
  })
  return geometry
}

async function setup(quotas: Partial<Quotas>, geometry = fakeGeometry()) {
  const user = await createUser(pool)
  users.push(user)
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

  it('holds the daily limit when uploads arrive at the same time', async () => {
    const { upload } = await setup({ maxUploadsPerDay: 2 })

    const results = await Promise.all(Array.from({ length: 5 }, () => upload()))

    expect(results.filter((r) => r.status === 201)).toHaveLength(2)
    expect(results.filter((r) => r.status === 429)).toHaveLength(3)
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

describe('daily processing budget', () => {
  it('counts failed cleans, so broken files use up the budget too', async () => {
    const { upload, geometry } = await setup({ maxProcessingPerDay: 2 }, flakyGeometry(2))

    expect((await upload()).status).toBe(422)
    expect((await upload()).status).toBe(422)
    const third = await upload()

    expect(third.status).toBe(429)
    expect(third.body.error).toBe('Daily processing limit reached')
    expect(geometry.clean).toHaveBeenCalledTimes(2)
  })

  it('leaves failed cleans out of the daily upload limit', async () => {
    const { upload } = await setup(
      { maxUploadsPerDay: 1, maxProcessingPerDay: 5 },
      flakyGeometry(1),
    )

    expect((await upload()).status).toBe(422)
    expect((await upload()).status).toBe(201)
    const third = await upload()

    expect(third.status).toBe(429)
    expect(third.body.error).toBe('Daily upload limit reached')
  })

  it('holds the budget when uploads arrive at the same time', async () => {
    const { upload, geometry } = await setup({ maxProcessingPerDay: 2 })

    const results = await Promise.all(Array.from({ length: 5 }, () => upload()))

    expect(results.filter((r) => r.status === 201)).toHaveLength(2)
    expect(results.filter((r) => r.status === 429)).toHaveLength(3)
    expect(geometry.clean).toHaveBeenCalledTimes(2)
  })
})

describe('cleanings running at once', () => {
  it('refuses a second clean while one is running, without spending budget', async () => {
    let finish: () => void = () => {}
    const geometry = fakeGeometry()
    const succeed = geometry.clean
    geometry.clean = vi.fn(async (file: Buffer) => {
      await new Promise<void>((resolve) => (finish = resolve))
      return succeed(file)
    })
    const { upload } = await setup({ maxConcurrentCleans: 1, maxProcessingPerDay: 2 }, geometry)

    const first = upload().then((r) => r)
    await vi.waitFor(() => expect(geometry.clean).toHaveBeenCalledTimes(1))
    const [second, third] = await Promise.all([upload(), upload()])
    finish()

    expect(second.status).toBe(429)
    expect(second.body.error).toBe('Too many uploads processing at once, try again shortly')
    expect(third.status).toBe(429)
    expect((await first).status).toBe(201)
    // The refused uploads didn't use the budget of 2, so one more still goes through.
    geometry.clean = vi.fn(succeed)
    expect((await upload()).status).toBe(201)
  })
})
