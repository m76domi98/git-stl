import fs from 'fs'
import path from 'path'
import os from 'os'

const CREDENTIALS_PATH = path.join(os.homedir(), '.meshgit', 'credentials.json')

export function saveCredentials(data) {
  const dir = path.dirname(CREDENTIALS_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(data, null, 2), { mode: 0o600 })
}

export function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'))
  } catch {
    return null
  }
}

export const API_URL = process.env.MESHGIT_API_URL || 'http://localhost:3001'
