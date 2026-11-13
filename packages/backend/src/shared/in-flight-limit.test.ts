import { describe, expect, it } from 'vitest'
import { createInFlightLimit } from './in-flight-limit.js'

describe('createInFlightLimit', () => {
  it('hands out slots up to the cap for each key separately', () => {
    const limit = createInFlightLimit(2)
    expect(limit.tryAcquire('a')).toBeTypeOf('function')
    expect(limit.tryAcquire('a')).toBeTypeOf('function')
    expect(limit.tryAcquire('a')).toBeNull()
    expect(limit.tryAcquire('b')).toBeTypeOf('function')
  })

  it('frees a slot on release, and ignores a second release of the same slot', () => {
    const limit = createInFlightLimit(1)
    const release = limit.tryAcquire('a')!
    release()
    release()
    const again = limit.tryAcquire('a')
    expect(again).toBeTypeOf('function')
    expect(limit.tryAcquire('a')).toBeNull()
  })
})
