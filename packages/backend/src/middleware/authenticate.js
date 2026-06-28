import jwt from 'jsonwebtoken'
import pool from '../db.js'

export async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' })
  }
  let payload
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  // Reject tokens issued before the user's last logout
  const { rows } = await pool.query(
    'SELECT tokens_invalidated_at FROM users WHERE id = $1',
    [payload.userId]
  )
  if (!rows.length) {
    return res.status(401).json({ error: 'User not found' })
  }
  const invalidatedAt = rows[0].tokens_invalidated_at
  if (invalidatedAt && payload.iat * 1000 < new Date(invalidatedAt).getTime()) {
    return res.status(401).json({ error: 'Token has been revoked' })
  }

  req.user = payload
  next()
}
