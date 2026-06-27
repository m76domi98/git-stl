import { Router } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import passport from '../auth/passport.js'
import pool from '../db.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()

const BACKEND_URL = () => process.env.BACKEND_URL || 'http://localhost:3001'
const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:5173'

const sign = (user) =>
  jwt.sign(
    { userId: user.id, githubUsername: user.github_username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  )

// ── Web OAuth ──────────────────────────────────────────────
router.get('/github', passport.authenticate('github', { state: true }))

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/', state: true }),
  (req, res) => {
    // FIX 1: Never put the JWT in the URL. Store it server-side behind a
    // short-lived opaque exchange code; the frontend redeems it via POST.
    const exchangeCode = crypto.randomBytes(16).toString('hex')
    req.session.exchange = {
      code: exchangeCode,
      token: sign(req.user),
      expiresAt: Date.now() + 60_000, // 60 seconds
    }
    res.redirect(`${FRONTEND_URL()}?exchange=${exchangeCode}`)
  }
)

// Frontend POSTs the opaque exchange code to receive the JWT in the body
router.post('/exchange', (req, res) => {
  const { code } = req.body
  const ex = req.session.exchange

  if (!ex || ex.code !== code || Date.now() > ex.expiresAt) {
    return res.status(401).json({ error: 'Invalid or expired exchange code' })
  }

  const { token } = ex
  delete req.session.exchange
  res.json({ token })
})

router.get('/me', authenticate, (req, res) => {
  res.json(req.user)
})

router.post('/logout', authenticate, async (req, res) => {
  await pool.query(
    'UPDATE users SET tokens_invalidated_at = NOW() WHERE id = $1',
    [req.user.userId]
  )
  res.json({ ok: true })
})

// ── CLI device-auth flow ───────────────────────────────────
router.post('/cli-initiate', async (_req, res) => {
  const deviceCode = crypto.randomBytes(20).toString('hex')
  const stateToken = crypto.randomBytes(20).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await pool.query(
    'INSERT INTO cli_auth_codes (device_code, state_token, expires_at) VALUES ($1, $2, $3)',
    [deviceCode, stateToken, expiresAt]
  )

  // FIX 2: The browser receives a state_token, never the device_code.
  // The device_code stays on the CLI side only.
  res.json({
    device_code: deviceCode,
    url: `${BACKEND_URL()}/api/auth/cli-login?state=${stateToken}`,
  })
})

router.get('/cli-login', async (req, res, next) => {
  const { state } = req.query

  // Validate that this state_token was actually issued by us and is still live
  const { rows } = await pool.query(
    'SELECT device_code FROM cli_auth_codes WHERE state_token = $1 AND expires_at > NOW()',
    [state]
  )
  if (!rows.length) return res.status(400).send('Invalid or expired login link.')

  // Bind the validated state to the session — the callback reads from here,
  // never from the URL, so an attacker cannot substitute their own state.
  req.session.cli_state = state

  passport.authenticate('github', {
    callbackURL: `${BACKEND_URL()}/api/auth/cli-callback`,
  })(req, res, next)
})

router.get(
  '/cli-callback',
  (req, res, next) =>
    passport.authenticate('github', {
      session: false,
      failureRedirect: '/',
      callbackURL: `${BACKEND_URL()}/api/auth/cli-callback`,
    })(req, res, next),
  async (req, res) => {
    const state = req.session.cli_state
    if (!state) return res.status(400).send('Missing session state.')

    const token = sign(req.user)
    const { rowCount } = await pool.query(
      'UPDATE cli_auth_codes SET jwt = $1 WHERE state_token = $2 AND expires_at > NOW()',
      [token, state]
    )

    if (rowCount === 0) return res.status(400).send('State expired.')
    delete req.session.cli_state

    res.send('<html><body style="font-family:monospace;padding:2rem"><h2>✓ Logged in</h2><p>You can close this tab and return to the terminal.</p></body></html>')
  }
)

router.get('/cli-poll', async (req, res) => {
  const { code } = req.query
  if (!code) return res.status(400).json({ error: 'Missing code' })

  const { rows } = await pool.query(
    'SELECT jwt, expires_at FROM cli_auth_codes WHERE device_code = $1',
    [code]
  )

  if (!rows.length || new Date(rows[0].expires_at) < new Date()) {
    return res.status(401).json({ error: 'Code expired or not found' })
  }

  if (!rows[0].jwt) return res.json({ pending: true })

  await pool.query('DELETE FROM cli_auth_codes WHERE device_code = $1', [code])
  res.json({ token: rows[0].jwt })
})

export default router
