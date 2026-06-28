import { Router } from 'express'
import pool from '../db.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, COUNT(c.id)::int AS commit_count
       FROM projects p
       LEFT JOIN commits c ON c.project_id = p.id
       WHERE p.owner_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.userId]
    )
    res.json(rows)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' })
    const { rows: [project] } = await pool.query(
      'INSERT INTO projects (owner_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.userId, name.trim(), description?.trim() || null]
    )
    res.status(201).json(project)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [project] } = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.userId]
    )
    if (!project) return res.status(404).json({ error: 'Project not found' })
    res.json(project)
  } catch (err) { next(err) }
})

export default router
