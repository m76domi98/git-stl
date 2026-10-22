import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMeshStorage, type MeshStorage } from './storage.js'

const PROJECT = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const MESH = '0a1b2c3d-4e5f-4061-8273-94a5b6c7d8e9'

describe('createMeshStorage', () => {
  let dir: string
  let storage: MeshStorage

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'meshgit-storage-'))
    storage = createMeshStorage(dir)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('stores a mesh under its project and reads it back', async () => {
    await storage.store(PROJECT, MESH, Buffer.from('solid cube'))

    expect(await readdir(join(dir, PROJECT))).toEqual([`${MESH}.stl`])
    expect((await storage.read(PROJECT, MESH)).toString()).toBe('solid cube')
  })

  it('never overwrites an existing mesh', async () => {
    await storage.store(PROJECT, MESH, Buffer.from('first'))

    await expect(storage.store(PROJECT, MESH, Buffer.from('second'))).rejects.toThrow(/EEXIST/)
    expect((await storage.read(PROJECT, MESH)).toString()).toBe('first')
  })

  it('rejects ids that are not canonical lowercase UUIDs', async () => {
    const bad = ['../etc', `${PROJECT}/..`, PROJECT.toUpperCase(), '']
    for (const id of bad) {
      await expect(storage.store(id, MESH, Buffer.from(''))).rejects.toThrow(/invalid/i)
      await expect(storage.read(PROJECT, id)).rejects.toThrow(/invalid/i)
    }
  })
})
