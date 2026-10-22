import type { CommitCreatedEvent } from './commits.types.js'

type Listener = (event: CommitCreatedEvent) => Promise<void> | void
type Logger = (message: string, err: unknown) => void

/**
 * After-commit hooks (e.g. mirroring to GitHub). Listeners run after the
 * response is decided and can never fail the commit itself.
 */
export interface CommitEvents {
  onCommitCreated(listener: Listener): void
  emitCommitCreated(event: CommitCreatedEvent): void
}

export function createCommitEvents(log: Logger = console.error): CommitEvents {
  const listeners: Listener[] = []
  return {
    onCommitCreated(listener) {
      listeners.push(listener)
    },
    emitCommitCreated(event) {
      for (const listener of listeners) {
        Promise.resolve()
          .then(() => listener(event))
          .catch((err: unknown) => log('[commit-events] listener failed', err))
      }
    },
  }
}
