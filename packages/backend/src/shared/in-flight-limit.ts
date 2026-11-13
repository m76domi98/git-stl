/**
 * Caps how many of one kind of job a single key (a user) can have running at
 * once. Lives in memory, so with several backend instances the cap is per instance.
 */
export interface InFlightLimit {
  /** Takes a slot and returns its release function, or null when `key` is at the cap. */
  tryAcquire(key: string): (() => void) | null
}

export function createInFlightLimit(max: number): InFlightLimit {
  const running = new Map<string, number>()
  return {
    tryAcquire(key) {
      const count = running.get(key) ?? 0
      if (count >= max) return null
      running.set(key, count + 1)
      let released = false
      return () => {
        if (released) return
        released = true
        const left = (running.get(key) ?? 1) - 1
        if (left === 0) running.delete(key)
        else running.set(key, left)
      }
    },
  }
}
