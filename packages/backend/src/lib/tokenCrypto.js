import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function key() {
  const k = process.env.GITHUB_TOKEN_ENCRYPTION_KEY
  if (!k) throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY env var is required')
  const buf = Buffer.from(k, 'hex')
  if (buf.length !== 32) throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  return buf
}

export function encrypt(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`
}

export function decrypt(encrypted) {
  const [ivHex, tagHex, ctHex] = encrypted.split(':')
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8')
}
