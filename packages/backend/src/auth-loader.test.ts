import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { loadAuth, type AuthModuleContext } from './auth-loader.js'
import { loadConfig } from './config.js'
import { createCommitEvents } from './features/commits/commit-events.js'
import type { MeshStorage } from './shared/storage.js'
import { fakeAuth } from './test/fake-auth.js'

function context(authMode: 'dev' | 'github'): AuthModuleContext {
  return {
    config: loadConfig({ DATABASE_URL: 'postgres://x', AUTH_MODE: authMode, NODE_ENV: 'test' }),
    db: {} as Pool,
    storage: {} as MeshStorage,
    events: createCommitEvents(),
  }
}

describe('loadAuth', () => {
  it('uses the dev stub without loading the private module', async () => {
    const load = vi.fn()
    const auth = await loadAuth(context('dev'), load)
    expect(auth.authenticate).toBeTypeOf('function')
    expect(load).not.toHaveBeenCalled()
  })

  it('builds the private module with the app context', async () => {
    const createAuthModule = vi.fn(() => fakeAuth)
    const ctx = context('github')

    const auth = await loadAuth(ctx, async () => ({ createAuthModule }))

    expect(auth).toBe(fakeAuth)
    expect(createAuthModule).toHaveBeenCalledWith(ctx)
  })

  it('explains how to recover when the private module is missing', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Cannot find module'))
    await expect(loadAuth(context('github'), load)).rejects.toThrow(/AUTH_MODE=dev/)
  })

  it('rejects a module without a factory', async () => {
    await expect(loadAuth(context('github'), async () => ({}))).rejects.toThrow(/createAuthModule/)
  })
})
