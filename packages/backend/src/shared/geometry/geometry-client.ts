import { AppError } from '../http/errors.js'

export interface CleanedMesh {
  data: Buffer
  vertexCount: number
  faceCount: number
}

export interface GeometryClient {
  /** Repairs an uploaded STL (non-manifold edges, holes) and returns the cleaned mesh. */
  clean(file: Buffer): Promise<CleanedMesh>
}

const CLEAN_TIMEOUT_MS = 5 * 60 * 1000
// The user's filename never leaves this service.
const UPLOAD_NAME = 'upload.stl'
const MAX_DETAIL_LENGTH = 200

export function createGeometryClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): GeometryClient {
  return {
    async clean(file) {
      const form = new FormData()
      form.append(
        'file',
        new Blob([file as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }),
        UPLOAD_NAME,
      )

      let res: Response
      try {
        res = await fetchImpl(`${baseUrl}/clean`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(CLEAN_TIMEOUT_MS),
        })
      } catch {
        throw new AppError(502, 'Geometry service unavailable')
      }

      if (res.status >= 500) throw new AppError(502, 'Geometry service error')
      if (!res.ok) throw new AppError(422, 'Mesh cleaning failed', await readDetail(res))

      return {
        data: Buffer.from(await res.arrayBuffer()),
        vertexCount: toCount(res.headers.get('x-vertex-count')),
        faceCount: toCount(res.headers.get('x-face-count')),
      }
    },
  }
}

/** Forwards only a short string `detail` (the service's user-facing message). */
async function readDetail(res: Response): Promise<string | undefined> {
  try {
    const detail: unknown = (await res.json()).detail
    return typeof detail === 'string' ? detail.slice(0, MAX_DETAIL_LENGTH) : undefined
  } catch {
    return undefined
  }
}

function toCount(header: string | null): number {
  const n = Number.parseInt(header ?? '', 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
