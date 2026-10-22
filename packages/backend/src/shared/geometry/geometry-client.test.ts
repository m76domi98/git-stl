import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../http/errors.js'
import { createGeometryClient } from './geometry-client.js'

const stl = Buffer.from('solid cube')

function respond(body: BodyInit, init: ResponseInit) {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(body, init))
}

describe('createGeometryClient', () => {
  it('posts the file to /clean and returns the cleaned mesh with counts', async () => {
    const fetchImpl = respond('cleaned', {
      headers: { 'x-vertex-count': '8', 'x-face-count': '12' },
    })

    const result = await createGeometryClient('http://geo', fetchImpl).clean(stl, 'cube.stl')

    expect(result).toEqual({ data: Buffer.from('cleaned'), vertexCount: 8, faceCount: 12 })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('http://geo/clean')
    expect(init?.method).toBe('POST')
    expect((init?.body as FormData).get('file')).toBeInstanceOf(Blob)
  })

  it('defaults missing or bad counts to 0', async () => {
    const fetchImpl = respond('x', { headers: { 'x-vertex-count': 'abc' } })
    const result = await createGeometryClient('http://geo', fetchImpl).clean(stl, 'a.stl')
    expect([result.vertexCount, result.faceCount]).toEqual([0, 0])
  })

  it('throws 422 with the service detail when cleaning fails', async () => {
    const fetchImpl = respond(JSON.stringify({ detail: 'Could not parse STL' }), { status: 422 })

    const err = await createGeometryClient('http://geo', fetchImpl)
      .clean(stl, 'a.stl')
      .catch((e) => e)

    expect(err).toBeInstanceOf(AppError)
    expect(err).toMatchObject({
      status: 422,
      message: 'Mesh cleaning failed',
      details: 'Could not parse STL',
    })
  })

  it('falls back to the raw body when the error is not JSON', async () => {
    const fetchImpl = respond('boom', { status: 500 })
    const err = await createGeometryClient('http://geo', fetchImpl)
      .clean(stl, 'a.stl')
      .catch((e) => e)
    expect(err.details).toBe('boom')
  })

  it('throws 502 when the service cannot be reached', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    const err = await createGeometryClient('http://geo', fetchImpl)
      .clean(stl, 'a.stl')
      .catch((e) => e)
    expect(err).toMatchObject({ status: 502 })
  })
})
