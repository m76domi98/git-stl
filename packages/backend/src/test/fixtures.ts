import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'

/** Inserts a throwaway user and returns its id. */
export async function createUser(db: Pool): Promise<string> {
  const id = randomUUID()
  await db.query('INSERT INTO users (id, github_id, github_username) VALUES ($1, $2, $3)', [
    id,
    `test-${id}`,
    'test-user',
  ])
  return id
}

/** Removes users and everything they own, children first. */
export async function deleteUsers(db: Pool, userIds: string[]): Promise<void> {
  const owned = 'SELECT id FROM projects WHERE owner_id = ANY($1)'
  const { rows } = await db.query<{ mesh_id: string }>(
    `DELETE FROM commits WHERE project_id IN (${owned}) RETURNING mesh_id`,
    [userIds],
  )
  await db.query('DELETE FROM meshes WHERE id = ANY($1)', [rows.map((r) => r.mesh_id)])
  await db.query('DELETE FROM projects WHERE owner_id = ANY($1)', [userIds])
  await db.query('DELETE FROM users WHERE id = ANY($1)', [userIds])
}

/**
 * Runs role and database-grant changes for throwaway test roles one at a time.
 * Parallel test files editing the same database's grants would otherwise hit
 * "tuple concurrently updated".
 */
export async function changeRolesSerially(db: Pool, statements: string[]): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('meshgit-test-roles'))")
    for (const sql of statements) await client.query(sql)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
