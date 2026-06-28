import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'crypto'
import pool from '../db.js'
import { storeMesh } from '../storage.js'
import { decrypt } from '../lib/tokenCrypto.js'
import { pushCommitToGitHub } from '../lib/githubSync.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.stl')) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Only STL files are accepted'), { status: 400 }))
    }
  },
})

router.get('/', async (req, res, next) => {
  try {
    const { project_id } = req.query
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    const { rows: [project] } = await pool.query(
      'SELECT id FROM projects WHERE id = $1 AND owner_id = $2',
      [project_id, req.user.userId]
    )
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const { rows } = await pool.query(
      `SELECT c.id, c.parent_id, c.message, c.created_at,
              m.vertex_count, m.face_count, m.file_size
       FROM commits c
       JOIN meshes m ON m.id = c.mesh_id
       WHERE c.project_id = $1
       ORDER BY c.created_at DESC`,
      [project_id]
    )
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const { project_id, message } = req.body
    if (!project_id) return res.status(400).json({ error: 'project_id required' })
    if (!req.file) return res.status(400).json({ error: 'STL file required' })

    const { rows: [project] } = await pool.query(
      'SELECT id, github_repo_owner, github_repo_name FROM projects WHERE id = $1 AND owner_id = $2',
      [project_id, req.user.userId]
    )
    if (!project) return res.status(404).json({ error: 'Project not found' })

    // Forward to geometry service for cleaning
    const form = new FormData()
    form.append(
      'file',
      new Blob([req.file.buffer], { type: 'application/octet-stream' }),
      req.file.originalname
    )
    const geometryUrl = process.env.GEOMETRY_SERVICE_URL || 'http://geometry:8000'
    const cleanRes = await fetch(`${geometryUrl}/clean`, { method: 'POST', body: form })
    if (!cleanRes.ok) {
      const text = await cleanRes.text().catch(() => '')
      let detail = text
      try { detail = JSON.parse(text).detail ?? text } catch {}
      return res.status(422).json({ error: 'Mesh cleaning failed', detail })
    }

    const cleanedBuffer = Buffer.from(await cleanRes.arrayBuffer())
    const vertexCount = parseInt(cleanRes.headers.get('x-vertex-count') || '0', 10)
    const faceCount = parseInt(cleanRes.headers.get('x-face-count') || '0', 10)

    // Write to DB + disk atomically (DB first; roll back on failure)
    const meshId = randomUUID()
    const client = await pool.connect()
    let commit
    try {
      await client.query('BEGIN')

      await client.query(
        'INSERT INTO meshes (id, file_size, vertex_count, face_count) VALUES ($1, $2, $3, $4)',
        [meshId, cleanedBuffer.length, vertexCount, faceCount]
      )

      const { rows: [parent] } = await client.query(
        'SELECT id FROM commits WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
        [project_id]
      )

      const { rows: [savedCommit] } = await client.query(
        `INSERT INTO commits (project_id, parent_id, mesh_id, author_id, message)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [project_id, parent?.id || null, meshId, req.user.userId, message || '']
      )
      commit = savedCommit

      await storeMesh(project_id, meshId, cleanedBuffer)

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    // Mirror to GitHub if the project is linked — fire-and-forget, don't block the response
    if (project.github_repo_owner && project.github_repo_name) {
      const { rows: [userRow] } = await pool.query(
        'SELECT github_access_token FROM users WHERE id = $1',
        [req.user.userId]
      )
      if (userRow?.github_access_token) {
        pushCommitToGitHub({
          token: decrypt(userRow.github_access_token),
          owner: project.github_repo_owner,
          repo: project.github_repo_name,
          meshId,
          projectId: project_id,
          message: message || '',
        }).catch((err) => console.error('[github-sync] push failed:', err.message))
      }
    }

    res.status(201).json({ ...commit, vertex_count: vertexCount, face_count: faceCount, file_size: cleanedBuffer.length })
  } catch (err) { next(err) }
})

router.get('/history', (_req, res) => res.status(501).json({ error: 'Not implemented' }))

export default router
