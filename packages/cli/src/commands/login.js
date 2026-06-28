import open from 'open'
import { API_URL, saveCredentials } from '../config.js'

const POLL_INTERVAL = 2000
const POLL_TIMEOUT = 5 * 60 * 1000

export async function login() {
  // 1. Get a device code from the backend
  const initRes = await fetch(`${API_URL}/api/auth/cli-initiate`, { method: 'POST' })
  if (!initRes.ok) {
    console.error('Failed to reach MeshGit server. Is it running?')
    process.exit(1)
  }
  const { device_code, user_code, url } = await initRes.json()

  console.log(`\nYour authorization code: ${user_code}`)
  console.log(`The browser page will show this code — only proceed if they match.\n`)
  console.log(`Opening browser...`)
  console.log(`If it doesn't open, visit: ${url}\n`)
  await open(url)

  // 2. Poll until JWT is ready
  const deadline = Date.now() + POLL_TIMEOUT
  process.stdout.write('Waiting for authentication')

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
    process.stdout.write('.')

    const pollRes = await fetch(`${API_URL}/api/auth/cli-poll?code=${device_code}`)

    if (pollRes.status === 401) {
      console.error('\nCode expired. Run meshgit login again.')
      process.exit(1)
    }

    const data = await pollRes.json()

    if (data.token) {
      // Decode username from JWT payload (no verification needed client-side here)
      const payload = JSON.parse(Buffer.from(data.token.split('.')[1], 'base64').toString())
      saveCredentials({ token: data.token, username: payload.githubUsername })
      console.log(`\n✓ Logged in as @${payload.githubUsername}`)
      return
    }
  }

  console.error('\nTimed out waiting for login. Try again.')
  process.exit(1)
}
