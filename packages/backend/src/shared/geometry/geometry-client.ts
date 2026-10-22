import { AppError } from '../http/errors.js'

export interface CleanedMesh {
  data: Buffer
  vertexCount: number
  faceCount: number
}

export interface GeometryClient {
  /** Repairs an uploaded STL (non-manifold edges, holes) and returns the cleaned mesh. */
  clean(file: Buffer, filename: string): Promise<CleanedMesh>
}

const CLEAN_TIMEOUT_MS = 5 * 60 * 1000

export function createGeometryClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): GeometryClient {
  return {
    async clean(file, filename) {
      const form = new FormData()
      form.append(
        'file',
        new Blob([file as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }),
        filename,
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

      if (!res.ok) {
        throw new AppError(422, 'Mesh cleaning failed', await readDetail(res))
      }

      return {
        data: Buffer.from(await res.arrayBuffer()),
        vertexCount: toCount(res.headers.get('x-vertex-count')),
        faceCount: toCount(res.headers.get('x-face-count')),
      }
    },
  }
}

async function readDetail(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  try {
    const detail: unknown = JSON.parse(text).detail
    return typeof detail === 'string' ? detail : text
  } catch {
    return text
  }
}

function toCount(header: string | null): number {
  const n = Number.parseInt(header ?? '', 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
