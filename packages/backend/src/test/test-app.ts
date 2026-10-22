import type { Express } from 'express'
import { vi } from 'vitest'
import { createApp, type AppDeps } from '../app.js'
import pool from '../db/pool.js'
import { createCommitEvents } from '../features/commits/commit-events.js'
import type { GeometryClient } from '../shared/geometry/geometry-client.js'
import type { MeshStorage } from '../shared/storage.js'
import { fakeAuth } from './fake-auth.js'

const unusedStorage: MeshStorage = {
  store: () => Promise.reject(new Error('storage not configured in this test')),
  read: () => Promise.reject(new Error('storage not configured in this test')),
}

export const fakeGeometry = (): GeometryClient => ({
  clean: vi.fn(async (file: Buffer) => ({ data: file, vertexCount: 8, faceCount: 12 })),
})

/** An app wired to the test database with fake auth and stubbed collaborators. */
export function testApp(overrides: Partial<AppDeps> = {}): Express {
  return createApp({
    config: { frontendUrl: 'http://localhost:5173' },
    auth: fakeAuth,
    db: pool,
    geometry: fakeGeometry(),
    storage: unusedStorage,
    events: createCommitEvents(),
    ...overrides,
  })
}
