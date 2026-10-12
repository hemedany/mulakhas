import { describe, expect, it } from 'vitest'
import { geminiModels, geminiWatching, groqChatModels, uploadedFile, verboseJson, watched, whisperBy, writerBy } from './fixtures'
import { createEngine, type Engine } from './index'
import { isSilent } from './transcript'
import { deviceWithKey, fakeNetwork, json, soundFile } from './testing'

function withGoogleKey(net: ReturnType<typeof fakeNetwork>) {
  const device = deviceWithKey(net)
  device.localStorage.setItem('m2.geminiKey', 'AIza_test_key')
  return device
}

const toGoogle = (net: ReturnType<typeof fakeNetwork>) => net.requests.filter(r => r.url.host === 'generativelanguage.googleapis.com')
const toWhisper = (net: ReturnType<typeof fakeNetwork>) => net.requests.filter(r => r.url.pathname.endsWith('/audio/transcriptions'))

const media = (engine: Engine) => {
  const [m] = engine.thread.get().messages
  if (!m || m.kind === 'text') throw new Error('expected a Video')
  return m
}

const COOKING = watched(
  [
    { start: 0, end: 4, text: 'هلأ منحط البرغل بالمي' },
    { start: 4, end: 9, text: 'وبعدين شي ربع ساعة', clear: false },
  ],
  'Hands pour fine bulgur into a bowl of water, then a kitchen timer is set to 15 minutes.',
)

const clip = () => soundFile('VID-20261012-WA0007.mp4', 12, { type: 'video/mp4' })

describe('Videos watched by Gemini', () => {
  it('sends a Video to Gemini, not Whisper, when a Google key is connected, and keeps what it says and shows', async () => {
    const net = fakeNetwork()
    net.on(geminiModels)
    net.on(geminiWatching(COOKING))
    const engine = await createEngine(withGoogleKey(net))

    await engine.thread.addFiles([clip()])
    await engine.thread.idle()

    expect(toWhisper(net)).toEqual([])
    expect(media(engine)).toMatchObject({
      state: 'heard',
      transcript: { watched: true, language: 'Arabic', duration: 12.4, shown: COOKING.shown, text: 'هلأ منحط البرغل بالمي وبعدين شي ربع ساعة' },
    })
    expect(media(engine).transcript!.segments.map(s => s.unclear)).toEqual([false, true])
    // The key stays in a header; the upload is deleted once watched.
    expect(toGoogle(net).every(r => !r.url.search.includes('AIza'))).toBe(true)
    expect(toGoogle(net).some(r => r.init?.method === 'DELETE' && r.url.pathname === '/v1beta/files/v1d30abc')).toBe(true)
  })

  it('watches with the newest Flash model in the key’s live model list', async () => {
    const net = fakeNetwork()
    net.on(geminiModels)
    net.on(geminiWatching(COOKING))
    const engine = await createEngine(withGoogleKey(net))

    await engine.thread.addFiles([clip()])
    await engine.thread.idle()

    const watchedWith = toGoogle(net).find(r => r.url.pathname.endsWith(':generateContent'))!.url.pathname
    expect(watchedWith).toBe('/v1beta/models/gemini-3-flash:generateContent')
  })

  it('hears a Video’s soundtrack with Whisper when no Google key is connected', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'VID-20261012-WA0007.mp4': verboseJson([{ text: ' هلأ منحط البرغل', start: 0, end: 4 }]) }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([clip()])
    await engine.thread.idle()

    expect(toGoogle(net)).toEqual([])
    expect(toWhisper(net)).toHaveLength(1)
    expect(media(engine)).toMatchObject({ state: 'heard', transcript: { text: 'هلأ منحط البرغل' } })
    expect(media(engine).transcript!.watched).toBeUndefined()
  })

  it.each([
    ['unsupported', json({ error: { code: 400, message: 'The video file is not supported.', status: 'INVALID_ARGUMENT' } }, 400)],
    ['rejected', json({ error: { code: 400, message: 'API key not valid.', status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }, 400)],
    ['blocked', json({ promptFeedback: { blockReason: 'SAFETY' } })],
  ])('still hears the sound with Whisper when Gemini can’t watch it (%s), and says why', async (failure, answer) => {
    const net = fakeNetwork()
    net.on(geminiModels)
    net.on(geminiWatching(answer))
    net.on(whisperBy({ 'VID-20261012-WA0007.mp4': verboseJson([{ text: ' بس الصوت', start: 0, end: 2 }]) }))
    const engine = await createEngine(withGoogleKey(net))

    await engine.thread.addFiles([clip()])
    await engine.thread.idle()

    expect(media(engine)).toMatchObject({ state: 'heard', watchFailure: failure, transcript: { text: 'بس الصوت' } })
  })

  it('waits as long as Google asks when it is busy, then watches', async () => {
    const net = fakeNetwork()
    net.on(geminiModels)
    let tries = 0
    const busy = json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '7s' }] } }, 429)
    net.on((url, init) => (url.pathname.endsWith(':generateContent') && ++tries === 1 ? busy : geminiWatching(COOKING)(url, init)))
    const waits: number[] = []
    const engine = await createEngine({ ...withGoogleKey(net), sleep: async ms => { waits.push(ms) } })

    await engine.thread.addFiles([clip()])
    await engine.thread.idle()

    expect(waits).toContain(7000)
    expect(media(engine)).toMatchObject({ state: 'heard', transcript: { watched: true } })
  })

  it('finds no speech in a silent Video heard without a Google key, rather than Whisper’s inventions', async () => {
    const net = fakeNetwork()
    // What Whisper writes over silence: confident it hears nothing, then invents a sign-off anyway.
    net.on(whisperBy({ 'VID-20261012-WA0007.mp4': verboseJson([{ text: ' اشتركوا في القناة', start: 0, end: 12, no_speech_prob: 0.93, avg_logprob: -1.36 }]) }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([clip()])
    await engine.thread.idle()

    expect(media(engine)).toMatchObject({ state: 'heard', transcript: { text: '', segments: [] } })
    expect(isSilent(media(engine).transcript!)).toBe(true)
  })

  it('gives the writer what each watched Video shows, and leaves its clarity unmeasured', async () => {
    const net = fakeNetwork()
    net.on(geminiModels)
    net.on(geminiWatching(COOKING))
    net.on(groqChatModels)
    net.on(writerBy('# Bulgur'))
    const engine = await createEngine(withGoogleKey(net))
    await engine.thread.addFiles([clip()])

    const result = await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    const prompt: string = JSON.parse(String(net.requests.find(r => r.url.pathname.endsWith('/chat/completions'))!.init!.body)).messages.at(-1).content
    expect(prompt).toContain('VIDEO (what is said, then what it shows)')
    expect(prompt).toContain('⟦unclear: وبعدين شي ربع ساعة⟧')
    expect(prompt).toContain(`[What the video shows]: ${COOKING.shown}`)
    expect(result.report).toEqual([{ n: 1, name: 'VID-20261012-WA0007.mp4', clarity: null, unclear: ['وبعدين شي ربع ساعة'] }])
  })

  it('uploads the Video itself, with its type, using the resumable upload', async () => {
    const net = fakeNetwork()
    net.on(geminiModels)
    net.on(geminiWatching(COOKING))
    const engine = await createEngine(withGoogleKey(net))

    await engine.thread.addFiles([clip()])
    await engine.thread.idle()

    const [start, bytes] = toGoogle(net).filter(r => r.url.pathname === '/upload/v1beta/files')
    expect(new Headers(start.init?.headers).get('x-goog-upload-header-content-type')).toBe('video/mp4')
    expect(new Headers(start.init?.headers).get('x-goog-api-key')).toBe('AIza_test_key')
    expect(new Headers(bytes.init?.headers).get('x-goog-upload-command')).toBe('upload, finalize')
    expect((bytes.init!.body as Blob).size).toBe(clip().size)
    expect(uploadedFile(bytes.init)).toBeNull()
  })
})
