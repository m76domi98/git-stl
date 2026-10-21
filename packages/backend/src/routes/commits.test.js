import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'crypto'
import pool from '../db.js'

// ponytail: integration test against a real Postgres (needs DATABASE_URL / docker-compose postgres up)
// covers the commits_parent_unique / commits_root_unique indexes added in migrate.js
test('concurrent commits sharing a parent: only one wins, the other gets 23505', async () => {
  const userId = randomUUID()
  const projectId = randomUUID()
  const meshIdA = randomUUID()
  const meshIdB = randomUUID()
  const rootId = randomUUID()

  await pool.query(
    'INSERT INTO users (id, github_id, github_username) VALUES ($1, $2, $3)',
    [userId, `test-${userId}`, 'test-user']
  )
  await pool.query('INSERT INTO projects (id, owner_id, name) VALUES ($1, $2, $3)', [
    projectId, userId, 'test-project',
  ])
  await pool.query('INSERT INTO meshes (id) VALUES ($1), ($2)', [meshIdA, meshIdB])
  await pool.query(
    'INSERT INTO commits (id, project_id, parent_id, mesh_id, author_id) VALUES ($1, $2, NULL, $3, $4)',
    [rootId, projectId, meshIdA, userId]
  )

  try {
    const insertChild = (meshId) =>
      pool.query(
        'INSERT INTO commits (project_id, parent_id, mesh_id, author_id) VALUES ($1, $2, $3, $4)',
        [projectId, rootId, meshId, userId]
      )

    const results = await Promise.allSettled([insertChild(meshIdA), insertChild(meshIdB)])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    assert.equal(fulfilled.length, 1, 'exactly one concurrent child commit should succeed')
    assert.equal(rejected.length, 1, 'exactly one concurrent child commit should be rejected')
    assert.equal(rejected[0].reason.code, '23505', 'rejection should be a unique_violation')
  } finally {
    await pool.query('DELETE FROM commits WHERE project_id = $1', [projectId])
    await pool.query('DELETE FROM meshes WHERE id = ANY($1)', [[meshIdA, meshIdB]])
    await pool.query('DELETE FROM projects WHERE id = $1', [projectId])
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
    await pool.end()
  }
})
