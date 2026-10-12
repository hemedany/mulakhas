import { describe, expect, it, vi } from 'vitest'
import { uploadedFile, verboseJson, voiceNote, whisperBy } from './fixtures'
import { createEngine, type Engine } from './index'
import { deviceWithKey, fakeNetwork, json, soundFile } from './testing'

const uploads = (net: ReturnType<typeof fakeNetwork>) =>
  net.requests.filter(r => r.url.pathname.endsWith('/audio/transcriptions')).map(r => uploadedFile(r.init)!)

/** Seconds of sound in an uploaded WAV part. */
const secondsIn = (wav: File) => (wav.size - 44) / 2 / 16_000

const media = (engine: Engine) => {
  const [m] = engine.thread.get().messages
  if (!m || m.kind === 'text') throw new Error('expected a Voice note or Video')
  return m
}

const MB = 1_000_000

describe('big and unusual files', () => {
  it('hears a file over Groq’s limit in parts of about ten minutes, joined into one Transcript in order', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({
      'lecture-1.wav': verboseJson([{ text: ' one', start: 0, end: 10 }, { text: ' two', start: 590, end: 598 }]),
      'lecture-2.wav': verboseJson([{ text: ' three', start: 5, end: 15 }]),
      'lecture-3.wav': verboseJson([{ text: ' four', start: 5, end: 25 }]),
    }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([soundFile('lecture.ogg', 1260, { bytes: 26 * MB })])
    await engine.thread.idle()

    expect(uploads(net).map(f => [f.name, f.type, secondsIn(f)])).toEqual([
      ['lecture-1.wav', 'audio/wav', 600],
      ['lecture-2.wav', 'audio/wav', 600],
      ['lecture-3.wav', 'audio/wav', 60],
    ])
    expect(media(engine)).toMatchObject({ state: 'heard', parts: undefined, transcript: { text: 'one two three four', duration: 1260 } })
    expect(media(engine).transcript!.segments.map(s => [s.text, s.start, s.end])).toEqual([
      ['one', 0, 10], ['two', 590, 598], ['three', 605, 615], ['four', 1205, 1225],
    ])
  })

  it('cuts the parts at a pause, so no word is split between two', async () => {
    const net = fakeNetwork()
    const said = verboseJson([{ text: ' words', start: 0, end: 5 }])
    net.on(whisperBy({ 'talk-1.wav': said, 'talk-2.wav': said, 'talk-3.wav': said }))
    const engine = await createEngine(deviceWithKey(net))

    // Talking throughout, with a pause at 9:50 and another at 19:45.
    await engine.thread.addFiles([soundFile('talk.ogg', 1260, { bytes: 26 * MB, quiet: [590, 1185] })])
    await engine.thread.idle()

    const [first, second, third] = uploads(net).map(secondsIn)
    expect(first).toBeGreaterThan(589.5)
    expect(first).toBeLessThan(590.5)
    expect(first + second).toBeGreaterThan(1184.5)
    expect(first + second).toBeLessThan(1185.5)
    expect(first + second + third).toBe(1260)
  })

  it('shows which part is being heard', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({
      'long-1.wav': verboseJson([{ text: ' a', start: 0, end: 1 }]),
      'long-2.wav': verboseJson([{ text: ' b', start: 10, end: 11 }]),
    }))
    const engine = await createEngine(deviceWithKey(net))
    const seen: string[] = []
    engine.thread.subscribe(({ messages: [m] }) => { if (m && m.kind !== 'text' && m.parts) seen.push(`${m.parts.heard.length + 1} of ${m.parts.of}`) })

    await engine.thread.addFiles([soundFile('long.ogg', 900, { bytes: 26 * MB })])
    await engine.thread.idle()

    expect([...new Set(seen)]).toEqual(['1 of 2', '2 of 2'])
  })

  it('carries on from the next part after a reload, without sending the parts already heard again', async () => {
    const before = fakeNetwork()
    before.on((_url, init) => {
      const name = uploadedFile(init)?.name
      if (name === 'lecture-1.wav') return json(verboseJson([{ text: ' one', start: 0, end: 10 }]))
      if (name === 'lecture-2.wav') return new Promise<undefined>(() => {}) // the page closes while this part is being heard
      return undefined
    })
    const device = deviceWithKey(before)
    const first = await createEngine(device)
    await first.thread.addFiles([soundFile('lecture.ogg', 1260, { bytes: 26 * MB })])
    await vi.waitFor(() => expect(media(first).parts?.heard).toHaveLength(1))

    const after = fakeNetwork()
    after.on(whisperBy({ 'lecture-2.wav': verboseJson([{ text: ' two', start: 5, end: 9 }]), 'lecture-3.wav': verboseJson([{ text: ' three', start: 5, end: 9 }]) }))
    const reopened = await createEngine({ ...device, fetch: after.fetch })
    await reopened.thread.idle()

    expect(uploads(after).map(f => f.name)).toEqual(['lecture-2.wav', 'lecture-3.wav'])
    expect(media(reopened)).toMatchObject({ state: 'heard', transcript: { text: 'one two three' } })
  })

  it('says a file is too long for the device when the page keeps closing while decoding it, and can still try again', async () => {
    const stuck = { decodeAudio: () => new Promise<Float32Array>(() => {}) } // decoding never finishes: the page closes
    const net = fakeNetwork()
    net.on(whisperBy({ 'film.wav': verboseJson([{ text: ' at last', start: 0, end: 2 }]) }))
    const device = deviceWithKey(net)
    const engine = await createEngine({ ...device, ...stuck })
    await engine.thread.addFiles([soundFile('film.mov', 60, { type: 'video/quicktime' })])
    await vi.waitFor(() => expect(media(engine).decodeTries).toBe(1))
    const again = await createEngine({ ...device, ...stuck })
    await vi.waitFor(() => expect(media(again).decodeTries).toBe(2))

    const third = await createEngine(device)
    await third.thread.idle()
    expect(media(third)).toMatchObject({ state: 'failed', failure: 'too-long' })

    await third.thread.retry(media(third).id)
    await third.thread.idle()
    expect(media(third)).toMatchObject({ state: 'heard', decodeTries: undefined })
  })

  it('sends a WhatsApp .opus Voice note as it is, under a name and type Groq accepts', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-20261011-WA0003.ogg': verboseJson([{ text: ' hi', start: 0, end: 1 }]) }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([voiceNote('PTT-20261011-WA0003.opus', 1, 'audio/ogg; codecs=opus')])
    await engine.thread.idle()

    expect(uploads(net).map(f => [f.name, f.type])).toEqual([['PTT-20261011-WA0003.ogg', 'audio/ogg']])
    expect(media(engine)).toMatchObject({ state: 'heard' })
  })

  it('hears the soundtrack of .mov and .3gp Videos by converting them, and sends .mp4 and .webm as they are', async () => {
    const net = fakeNetwork()
    const said = verboseJson([{ text: ' مرحبا', start: 0, end: 2 }])
    net.on(whisperBy({ 'clip.wav': said, 'old-phone.wav': said, 'party.mp4': said, 'screen.webm': said }))
    const engine = await createEngine(deviceWithKey(net)) // no Gemini key

    await engine.thread.addFiles([
      soundFile('clip.mov', 30, { type: 'video/quicktime', lastModified: 1 }),
      soundFile('old-phone.3gp', 12, { type: 'video/3gpp', lastModified: 2 }),
      soundFile('party.mp4', 40, { type: 'video/mp4', lastModified: 3 }),
      soundFile('screen.webm', 8, { type: 'video/webm', lastModified: 4 }),
    ])
    await engine.thread.idle()

    expect(uploads(net).map(f => f.name).sort()).toEqual(['clip.wav', 'old-phone.wav', 'party.mp4', 'screen.webm'])
    expect(engine.thread.get().messages.map(m => (m.kind === 'text' ? m.text : [m.kind, m.state]))).toEqual([
      ['video', 'heard'], ['video', 'heard'], ['video', 'heard'], ['video', 'heard'],
    ])
  })

  it.each([
    ['cannot read', 400, { error: { message: 'could not process file - is it a valid media file?', type: 'invalid_request_error' } }],
    ['finds too big', 413, { error: { message: 'Request Entity Too Large' } }],
  ])('converts a file Groq says it %s, then hears it', async (_, status, answer) => {
    const net = fakeNetwork()
    net.on((_url, init) => (uploadedFile(init)?.name === 'odd.m4a' ? json(answer, status) : undefined))
    net.on(whisperBy({ 'odd.wav': verboseJson([{ text: ' heard after all', start: 0, end: 3 }]) }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([soundFile('odd.m4a', 20, { type: 'audio/mp4' })])
    await engine.thread.idle()

    expect(uploads(net).map(f => f.name)).toEqual(['odd.m4a', 'odd.wav'])
    expect(media(engine)).toMatchObject({ state: 'heard', transcript: { text: 'heard after all' } })
  })

  it('gives a file that cannot be decoded a clear failure of its own', async () => {
    const net = fakeNetwork()
    const engine = await createEngine(deviceWithKey(net))

    // Too big to send as it is, and not something the browser can play.
    await engine.thread.addFiles([new File([new Uint8Array(26 * MB)], 'broken.amr', { type: 'audio/amr', lastModified: 1 })])
    await engine.thread.idle()

    expect(uploads(net)).toEqual([])
    expect(media(engine)).toMatchObject({ state: 'failed', failure: 'undecodable' })
  })

  it('names the upload by its type when a shared file has no usable name', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'shared.ogg': verboseJson([{ text: ' hi', start: 0, end: 1 }]) }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([voiceNote('shared', 1, 'audio/ogg')])
    await engine.thread.idle()

    expect(uploads(net).map(f => f.name)).toEqual(['shared.ogg'])
  })
})
