/** Per-user spending caps on the resources that cost money: disk, CPU, and rows. */
export interface Quotas {
  /** Total stored mesh bytes across all of a user's commits. */
  readonly maxStorageBytes: number
  /** Uploads in the last 24 hours. Each one runs mesh cleaning in the geometry service. */
  readonly maxUploadsPerDay: number
  /** Mesh cleanings started in the last 24 hours, including ones that failed. */
  readonly maxProcessingPerDay: number
  readonly maxProjects: number
}

export const DEFAULT_QUOTAS: Quotas = Object.freeze({
  maxStorageBytes: 2 * 1024 ** 3,
  maxUploadsPerDay: 100,
  maxProcessingPerDay: 200,
  maxProjects: 50,
})
