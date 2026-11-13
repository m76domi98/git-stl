/** Per-user spending caps on the resources that cost money: disk, CPU, and rows. */
export interface Quotas {
  /** Total stored mesh bytes across all of a user's commits. */
  readonly maxStorageBytes: number
  /** Uploads in the last 24 hours. Each one runs mesh cleaning in the geometry service. */
  readonly maxUploadsPerDay: number
  /** Mesh cleanings started in the last 24 hours, including ones that failed. */
  readonly maxProcessingPerDay: number
  /** Mesh cleanings one user can have running at the same time. */
  readonly maxConcurrentCleans: number
  readonly maxProjects: number
}

/**
 * The highest value each cap may be set to. Generous, but low enough that a
 * stray extra digit in the environment can't quietly turn a cap off.
 */
export const QUOTA_CEILINGS = Object.freeze({
  storageMb: 1024 * 1024,
  uploadsPerDay: 10_000,
  processingPerDay: 20_000,
  projects: 10_000,
  concurrentCleans: 16,
})

export const DEFAULT_QUOTAS: Quotas = Object.freeze({
  maxStorageBytes: 2 * 1024 ** 3,
  maxUploadsPerDay: 100,
  maxProcessingPerDay: 200,
  maxConcurrentCleans: 2,
  maxProjects: 50,
})
