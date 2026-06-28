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
  // 6-digit code the CLI displays and the browser confirmation page echoes back;
  // the user verifies they match before authorizing (RFC 8628 §6.1 phishing mitigation)
  const userCode = crypto.randomInt(100000, 1000000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await pool.query(
    'INSERT INTO cli_auth_codes (device_code, state_token, user_code, expires_at) VALUES ($1, $2, $3, $4)',
    [deviceCode, stateToken, userCode, expiresAt]
  )

  res.json({
    device_code: deviceCode,
    user_code: userCode,
    url: `${BACKEND_URL()}/api/auth/cli-login?state=${stateToken}`,
  })
})

// Show a confirmation page — user must verify the code matches their terminal
// before we start the GitHub OAuth redirect.
router.get('/cli-login', async (req, res) => {
  const { state } = req.query

  const { rows } = await pool.query(
    'SELECT user_code FROM cli_auth_codes WHERE state_token = $1 AND expires_at > NOW()',
    [state]
  )
  if (!rows.length) return res.status(400).send('Invalid or expired login link.')

  // Bind a CSRF nonce to this browser session so /cli-confirm can verify the
  // user actually loaded this page — a cross-origin form POST cannot read or
  // set this cookie, blocking CSRF bypass of the user_code verification step.
  const csrfNonce = crypto.randomBytes(16).toString('hex')
  req.session.cli_csrf = csrfNonce

  res.send(`<!DOCTYPE html><html><head><title>MeshGit Authorization</title>
<style>
  body{font-family:monospace;max-width:420px;margin:4rem auto;padding:1rem;color:#1a1a2e}
  h2{margin-bottom:.5rem}
  .code{font-size:2rem;letter-spacing:.3em;background:#f0ebfa;padding:.6rem 1.2rem;
        border-radius:6px;display:inline-block;margin:1rem 0}
  p{line-height:1.6;color:#444}
  .btn{display:block;width:100%;padding:.8rem;background:#7c3aed;color:#fff;
       border:none;border-radius:6px;font-size:1rem;cursor:pointer;margin-top:1.5rem}
  .btn:hover{background:#6d28d9}
  .warning{font-size:.85rem;color:#666;margin-top:1.5rem}
</style></head><body>
<h2>MeshGit CLI Authorization</h2>
<p>Your terminal should display this code:</p>
<div class="code">${rows[0].user_code}</div>
<p><strong>Only continue if your terminal shows exactly this code.</strong></p>
<form method="POST" action="/api/auth/cli-confirm">
  <input type="hidden" name="state" value="${state}">
  <input type="hidden" name="csrf_nonce" value="${csrfNonce}">
  <button type="submit" class="btn">Yes, authorize this device</button>
</form>
<p class="warning">If you did not run <code>meshgit login</code>, close this page — someone may be trying to hijack your account.</p>
</body></html>`)
})

// User confirmed the code — verify CSRF nonce then start GitHub OAuth redirect
router.post('/cli-confirm', async (req, res, next) => {
  const { state, csrf_nonce } = req.body
  if (!state) return res.status(400).send('Missing state.')

  // Reject if the nonce is missing or doesn't match what we set in /cli-login.
  // A cross-origin CSRF form POST cannot read or supply this value.
  if (!req.session.cli_csrf || csrf_nonce !== req.session.cli_csrf) {
    return res.status(403).send('Invalid CSRF token. Please use the link from your terminal.')
  }
  delete req.session.cli_csrf

  const { rows } = await pool.query(
    'SELECT device_code FROM cli_auth_codes WHERE state_token = $1 AND expires_at > NOW()',
    [state]
  )
  if (!rows.length) return res.status(400).send('Invalid or expired session.')

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
