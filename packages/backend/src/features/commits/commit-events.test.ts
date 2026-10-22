import { describe, expect, it, vi } from 'vitest'
import { createCommitEvents } from './commit-events.js'
import type { CommitCreatedEvent } from './commits.types.js'

const event = { authorId: 'u1' } as CommitCreatedEvent

describe('createCommitEvents', () => {
  it('runs every listener and logs failures instead of throwing', async () => {
    const log = vi.fn()
    const events = createCommitEvents(log)
    const good = vi.fn()
    events.onCommitCreated(async () => {
      throw new Error('nope')
    })
    events.onCommitCreated(good)

    expect(() => events.emitCommitCreated(event)).not.toThrow()

    await vi.waitFor(() => expect(log).toHaveBeenCalledOnce())
    expect(good).toHaveBeenCalledWith(event)
  })
})
