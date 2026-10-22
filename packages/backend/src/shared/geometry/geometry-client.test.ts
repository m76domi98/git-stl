import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../http/errors.js'
import { createGeometryClient } from './geometry-client.js'

const stl = Buffer.from('solid cube')

function respond(body: BodyInit, init: ResponseInit) {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(body, init))
}

const cleanWith = (fetchImpl: typeof fetch) =>
  createGeometryClient('http://geo', fetchImpl)
    .clean(stl)
    .catch((e: unknown) => e)

describe('createGeometryClient', () => {
  it('posts the file to /clean under a fixed name and returns the cleaned mesh', async () => {
    const fetchImpl = respond('cleaned', {
      headers: { 'x-vertex-count': '8', 'x-face-count': '12' },
    })

    const result = await createGeometryClient('http://geo', fetchImpl).clean(stl)

    expect(result).toEqual({ data: Buffer.from('cleaned'), vertexCount: 8, faceCount: 12 })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('http://geo/clean')
    expect(init?.method).toBe('POST')
    expect(((init?.body as FormData).get('file') as File).name).toBe('upload.stl')
  })

  it('defaults missing or bad counts to 0', async () => {
    const fetchImpl = respond('x', { headers: { 'x-vertex-count': 'abc' } })
    const result = await createGeometryClient('http://geo', fetchImpl).clean(stl)
    expect([result.vertexCount, result.faceCount]).toEqual([0, 0])
  })

  it('throws 422 with a short string detail when the mesh is rejected', async () => {
    const fetchImpl = respond(JSON.stringify({ detail: 'Could not parse STL' }), { status: 422 })

    const err = await cleanWith(fetchImpl)

    expect(err).toBeInstanceOf(AppError)
    expect(err).toMatchObject({
      status: 422,
      message: 'Mesh cleaning failed',
      details: 'Could not parse STL',
    })
  })

  it('truncates long details and drops non-string ones', async () => {
    const long = await cleanWith(
      respond(JSON.stringify({ detail: 'x'.repeat(500) }), { status: 400 }),
    )
    const array = await cleanWith(
      respond(JSON.stringify({ detail: [{ loc: ['body'] }] }), { status: 422 }),
    )
    const html = await cleanWith(respond('<html>proxy error</html>', { status: 400 }))

    expect((long as AppError).details).toHaveLength(200)
    expect((array as AppError).details).toBeUndefined()
    expect((html as AppError).details).toBeUndefined()
  })

  it('maps service failures to 502 without passing the body through', async () => {
    const err = await cleanWith(respond('Traceback (most recent call last)...', { status: 500 }))
    expect(err).toMatchObject({ status: 502, details: undefined })
  })

  it('throws 502 when the service cannot be reached', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))
    expect(await cleanWith(fetchImpl)).toMatchObject({ status: 502 })
  })
})
