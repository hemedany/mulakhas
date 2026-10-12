import { describe, expect, it } from 'vitest'
import { createEngine } from './index'
import { fakeNetwork, freshDevice, json } from './testing'

// Shapes copied from the providers' real answers (October 2026).
const GROQ_MODELS = { object: 'list', data: [{ id: 'whisper-large-v3', object: 'model' }, { id: 'openai/gpt-oss-120b', object: 'model' }] }
const GROQ_BAD_KEY = { error: { message: 'Invalid API Key', type: 'invalid_request_error', code: 'invalid_api_key' } }

describe('connecting an Own key', () => {
  it('saves a Groq key that Groq accepts', async () => {
    const net = fakeNetwork()
    net.on(url => (url.host === 'api.groq.com' ? json(GROQ_MODELS) : undefined))
    const engine = await createEngine(freshDevice({ fetch: net.fetch }))

    const outcome = await engine.keys.connect('groq', '  gsk_live_key_pasted_with_spaces  ')

    expect(outcome).toEqual({ ok: true })
    expect(engine.keys.get().groq).toBe('gsk_live_key_pasted_with_spaces')
    // Sent only to Groq, as a bearer token, never in the URL.
    expect(net.requests.map(r => r.url.host)).toEqual(['api.groq.com'])
    expect(net.requests[0].url.href).not.toContain('gsk_live')
    expect(new Headers(net.requests[0].init?.headers).get('authorization')).toBe('Bearer gsk_live_key_pasted_with_spaces')
  })

  it('tells a busy provider apart from a bad key or a dropped connection', async () => {
    const net = fakeNetwork()
    net.on(url => (url.host === 'api.groq.com' ? json({ error: { message: 'Rate limit reached', type: 'tokens', code: 'rate_limit_exceeded' } }, 429) : undefined))
    const engine = await createEngine(freshDevice({ fetch: net.fetch }))

    expect(await engine.keys.connect('groq', 'gsk_fine_key')).toEqual({ ok: false, reason: 'busy' })
    expect(engine.keys.get().groq).toBeNull()
  })

  it('refuses a Groq key that Groq rejects, and keeps the previous one', async () => {
    const net = fakeNetwork()
    net.on(url => (url.host === 'api.groq.com' ? json(GROQ_BAD_KEY, 401) : undefined))
    const device = freshDevice({ fetch: net.fetch })
    device.localStorage.setItem('m2.groqKey', 'gsk_working_old_key')
    const engine = await createEngine(device)

    const outcome = await engine.keys.connect('groq', 'gsk_typo')

    expect(outcome).toEqual({ ok: false, reason: 'rejected' })
    expect(engine.keys.get().groq).toBe('gsk_working_old_key')
  })

  it('tells a dropped connection apart from a bad key', async () => {
    const engine = await createEngine(freshDevice()) // no handlers: every request fails

    const outcome = await engine.keys.connect('groq', 'gsk_fine_but_offline')

    expect(outcome).toEqual({ ok: false, reason: 'unreachable' })
    expect(engine.keys.get().groq).toBeNull()
  })

  it('sends a Gemini key only to Google, in a header and never in the URL', async () => {
    const net = fakeNetwork()
    // Shape per the Gemini API reference (models.list), trimmed.
    net.on(url => (url.host === 'generativelanguage.googleapis.com'
      ? json({ models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent', 'countTokens'] }], nextPageToken: 'Ch5tb2RlbHMv' })
      : undefined))
    const engine = await createEngine(freshDevice({ fetch: net.fetch }))

    const outcome = await engine.keys.connect('gemini', 'AIza-video-key')

    expect(outcome).toEqual({ ok: true })
    expect(net.requests).toHaveLength(1)
    const [{ url, init }] = net.requests
    expect(url.host).toBe('generativelanguage.googleapis.com')
    expect(url.href).not.toContain('AIza-video-key')
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe('AIza-video-key')
  })

  it('forgets a removed key, on this device too', async () => {
    const device = freshDevice()
    device.localStorage.setItem('m2.geminiKey', 'AIza-old')
    const engine = await createEngine(device)

    engine.keys.remove('gemini')
    const reopened = await createEngine(device)

    expect(reopened.keys.get().gemini).toBeNull()
  })

  it('does not call anyone for an empty paste', async () => {
    const net = fakeNetwork()
    const engine = await createEngine(freshDevice({ fetch: net.fetch }))

    expect(await engine.keys.connect('groq', '   ')).toEqual({ ok: false, reason: 'empty' })
    expect(net.requests).toHaveLength(0)
  })
})
