import { describe, expect, it } from 'vitest'
import { recording, verboseJson, voiceNote, whisperBy } from './fixtures'
import { createEngine } from './index'
import { deviceWithKey, fakeNetwork, json } from './testing'

const uploads = (net: ReturnType<typeof fakeNetwork>) =>
  net.requests
    .filter(r => r.url.pathname.endsWith('/audio/transcriptions'))
    .map(r => (r.init!.body as FormData).get('file') as File)

const MB = 1024 * 1024

describe('big and unusual files', () => {
  it('hears a file over 25 MB in parts of about ten minutes and stitches them into one Transcript, in order', async () => {
    const net = fakeNetwork()
    // 21 minutes: parts 0–10:00, 9:55–20:00 and 19:55–21:00, each overlapping the one before by five seconds.
    net.on(whisperBy({
      'lecture-1.wav': verboseJson([{ text: ' one', start: 0, end: 10 }, { text: ' two', start: 590, end: 598 }]),
      // Both of these lie mostly in the overlap the part before already heard.
      'lecture-2.wav': verboseJson([{ text: ' two again', start: 0, end: 3 }, { text: ' three', start: 10, end: 20 }]),
      'lecture-3.wav': verboseJson([{ text: ' three again', start: 0, end: 4 }, { text: ' four', start: 10, end: 30 }]),
    }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([recording('lecture.ogg', 1260, { bytes: 26 * MB })])
    await engine.thread.idle()

    expect(uploads(net).map(f => [f.name, f.type, f.size])).toEqual([
      ['lecture-1.wav', 'audio/wav', 44 + 600 * 16_000 * 2],
      ['lecture-2.wav', 'audio/wav', 44 + 605 * 16_000 * 2],
      ['lecture-3.wav', 'audio/wav', 44 + 65 * 16_000 * 2],
    ])
    const [message] = engine.thread.get().messages
    expect(message).toMatchObject({ state: 'heard', part: undefined, transcript: { text: 'one two three four', duration: 1260 } })
    if (message.kind === 'text') throw new Error('expected a Voice note')
    expect(message.transcript!.segments.map(s => [s.text, s.start, s.end])).toEqual([
      ['one', 0, 10], ['two', 590, 598], ['three', 605, 615], ['four', 1205, 1225],
    ])
  })

  it('shows which part is being heard', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({
      'long-1.wav': verboseJson([{ text: ' a', start: 0, end: 1 }]),
      'long-2.wav': verboseJson([{ text: ' b', start: 10, end: 11 }]),
    }))
    const engine = await createEngine(deviceWithKey(net))
    const seen: unknown[] = []
    engine.thread.subscribe(({ messages: [m] }) => { if (m && m.kind !== 'text' && m.part) seen.push(m.part) })

    await engine.thread.addFiles([recording('long.ogg', 900, { bytes: 26 * MB })])
    await engine.thread.idle()

    expect(seen).toEqual([{ n: 1, of: 2 }, { n: 2, of: 2 }])
  })

  it('sends a WhatsApp .opus voice note as it is, under a name and type Groq accepts', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-20261011-WA0003.ogg': verboseJson([{ text: ' hi', start: 0, end: 1 }]) }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([voiceNote('PTT-20261011-WA0003.opus', 1, 'audio/ogg; codecs=opus')])
    await engine.thread.idle()

    expect(uploads(net).map(f => [f.name, f.type])).toEqual([['PTT-20261011-WA0003.ogg', 'audio/ogg']])
    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard' })
  })

  it('hears the soundtrack of .mov and .3gp Videos by converting them, and sends .mp4 and .webm as they are', async () => {
    const net = fakeNetwork()
    const said = verboseJson([{ text: ' مرحبا', start: 0, end: 2 }])
    net.on(whisperBy({ 'clip.wav': said, 'old-phone.wav': said, 'party.mp4': said, 'screen.webm': said }))
    const engine = await createEngine(deviceWithKey(net)) // no Gemini key

    await engine.thread.addFiles([
      recording('clip.mov', 30, { type: 'video/quicktime', lastModified: 1 }),
      recording('old-phone.3gp', 12, { type: 'video/3gpp', lastModified: 2 }),
      recording('party.mp4', 40, { type: 'video/mp4', lastModified: 3 }),
      recording('screen.webm', 8, { type: 'video/webm', lastModified: 4 }),
    ])
    await engine.thread.idle()

    expect(uploads(net).map(f => f.name).sort()).toEqual(['clip.wav', 'old-phone.wav', 'party.mp4', 'screen.webm'])
    expect(engine.thread.get().messages.map(m => (m.kind === 'text' ? m.text : [m.kind, m.state]))).toEqual([
      ['video', 'heard'], ['video', 'heard'], ['video', 'heard'], ['video', 'heard'],
    ])
  })

  it('converts a file Groq says it cannot read, then hears it', async () => {
    const net = fakeNetwork()
    net.on((_url, init) => {
      const file = init?.body instanceof FormData ? (init.body.get('file') as File) : null
      return file?.name === 'odd.m4a' ? json({ error: { message: 'could not process file - is it a valid media file?', type: 'invalid_request_error' } }, 400) : undefined
    })
    net.on(whisperBy({ 'odd.wav': verboseJson([{ text: ' heard after all', start: 0, end: 3 }]) }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([recording('odd.m4a', 20, { type: 'audio/mp4' })])
    await engine.thread.idle()

    expect(uploads(net).map(f => f.name)).toEqual(['odd.m4a', 'odd.wav'])
    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard', transcript: { text: 'heard after all' } })
  })

  it('gives a file that cannot be decoded a clear failure of its own', async () => {
    const net = fakeNetwork()
    const engine = await createEngine(deviceWithKey(net))

    // Too big to send as it is, and not something the browser can play.
    await engine.thread.addFiles([new File([new Uint8Array(26 * MB)], 'broken.amr', { type: 'audio/amr', lastModified: 1 })])
    await engine.thread.idle()

    expect(uploads(net)).toEqual([])
    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'failed', failure: 'undecodable' })
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
