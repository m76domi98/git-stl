import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pool from '../../db/pool.js'
import { TEST_USER_HEADER } from '../../test/fake-auth.js'
import { createUser, deleteUsers } from '../../test/fixtures.js'
import { testApp } from '../../test/test-app.js'

const app = testApp()

let alice: string
let bob: string

beforeAll(async () => {
  alice = await createUser(pool)
  bob = await createUser(pool)
})

afterAll(async () => {
  await deleteUsers(pool, [alice, bob])
  await pool.end()
})

const as = (userId: string) => ({ [TEST_USER_HEADER]: userId })

describe('projects', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/projects')).status).toBe(401)
  })

  it('creates a project with trimmed fields', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(as(alice))
      .send({ name: '  bracket  ', description: '  v1 ' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({ name: 'bracket', description: 'v1', owner_id: alice })
  })

  it('stores an empty description as null', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(as(alice))
      .send({ name: 'gear', description: '  ' })
    expect(res.body.data.description).toBeNull()
  })

  it('rejects a blank name', async () => {
    const res = await request(app).post('/api/projects').set(as(alice)).send({ name: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it("lists only the caller's projects, newest first, with commit counts", async () => {
    const res = await request(app).get('/api/projects').set(as(alice))

    expect(res.status).toBe(200)
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual(['gear', 'bracket'])
    expect(res.body.data[0].commit_count).toBe(0)
    expect((await request(app).get('/api/projects').set(as(bob))).body.data).toEqual([])
  })

  it('gets a project by id for its owner only', async () => {
    const created = await request(app).post('/api/projects').set(as(alice)).send({ name: 'hinge' })
    const id = created.body.data.id

    expect((await request(app).get(`/api/projects/${id}`).set(as(alice))).body.data.name).toBe(
      'hinge',
    )
    expect((await request(app).get(`/api/projects/${id}`).set(as(bob))).status).toBe(404)
  })

  it('rejects a malformed project id with 400', async () => {
    const res = await request(app).get('/api/projects/not-a-uuid').set(as(alice))
    expect(res.status).toBe(400)
  })
})
