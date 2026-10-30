import { describe, expect, it } from 'vitest'
import { fetchSenderPhoto } from './senderPhotos'

describe('sender photos', () => {
  it('returns the image for directory users and null otherwise', async () => {
    const ok = await fetchSenderPhoto('ada@example.com', 't', async (url) => {
      expect(url).toBe('https://graph.microsoft.com/v1.0/users/ada%40example.com/photos/48x48/$value')
      return new Response(new Blob(['x'], { type: 'image/jpeg' }))
    })
    expect(ok?.type).toBe('image/jpeg')
    expect(await fetchSenderPhoto('outside@gmail.com', 't', async () => new Response('', { status: 404 }))).toBeNull()
  })
})
