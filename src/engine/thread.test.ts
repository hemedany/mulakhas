import { IDBObjectStore } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { groqChatModels, groqModels, verboseJson, voiceNote, whisperBy, writerBy } from './fixtures'
import { createEngine } from './index'
import { deviceWithKey, fakeNetwork, freshDevice, json, names } from './testing'

const NOTE_1 = verboseJson([{ text: ' يا بنتي أول شي بتنقعي البرغل نص ساعة', start: 0, end: 6.4 }])
const NOTE_2 = verboseJson([{ text: ' استعملي لحم غنم', start: 0, end: 3.1 }])

describe('hearing Voice notes', () => {
  it('orders Voice notes added together by their date and hears each one once', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-0003.ogg': NOTE_1, 'PTT-0004.ogg': NOTE_2 }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([voiceNote('PTT-0004.ogg', 2000), voiceNote('PTT-0003.ogg', 1000)])
    await engine.thread.idle()

    const messages = engine.thread.get().messages
    expect(messages.map(m => m.kind === 'text' ? m.text : m.name)).toEqual(['PTT-0003.ogg', 'PTT-0004.ogg'])
    expect(messages.map(m => m.kind !== 'text' && m.state)).toEqual(['heard', 'heard'])
    expect(messages[0].kind !== 'text' && messages[0].transcript?.text).toBe('يا بنتي أول شي بتنقعي البرغل نص ساعة')

    const calls = net.requests.filter(r => r.url.pathname.endsWith('/audio/transcriptions'))
    expect(calls).toHaveLength(2)
    const form = calls[0].init?.body as FormData
    expect(form.get('model')).toBe('whisper-large-v3')
    expect(form.get('response_format')).toBe('verbose_json')
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe('Bearer gsk_test_key')
  })
})

describe('ordering', () => {
  it('orders WhatsApp media by the date and number in their names, whatever the file dates say', async () => {
    const engine = await createEngine(freshDevice())

    // File dates on phones are often when the file was saved or copied, not when it was sent.
    await engine.thread.addFiles([
      voiceNote('PTT-20261011-WA0010.opus', 1),
      voiceNote('VID-20261010-WA0002.mp4', 3, 'video/mp4'),
      voiceNote('PTT-20261011-WA0009.opus', 2),
    ])

    expect(engine.thread.get().messages.map(m => m.kind !== 'text' && m.name)).toEqual([
      'VID-20261010-WA0002.mp4',
      'PTT-20261011-WA0009.opus',
      'PTT-20261011-WA0010.opus',
    ])
  })

  it('orders other files by their dates, and same-dated ones by the number in their names', async () => {
    const engine = await createEngine(freshDevice())

    await engine.thread.addFiles([voiceNote('kitchen 10.m4a', 5), voiceNote('kitchen 9.m4a', 5), voiceNote('first.m4a', 1)])

    expect(engine.thread.get().messages.map(m => m.kind !== 'text' && m.name)).toEqual(['first.m4a', 'kitchen 9.m4a', 'kitchen 10.m4a'])
  })
})

describe('the Thread survives reloads', () => {
  it('restores Messages, order, states, Transcripts and files after a reload', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-0003.ogg': NOTE_1 }))
    const device = deviceWithKey(net)
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('PTT-0003.ogg', 1000)])
    await engine.thread.addText(0, 'Use lamb, not beef!')
    await engine.thread.idle()

    const reopened = await createEngine(device)

    const [text, note] = reopened.thread.get().messages
    expect(text).toMatchObject({ kind: 'text', text: 'Use lamb, not beef!' })
    expect(note).toMatchObject({ kind: 'voice', name: 'PTT-0003.ogg', state: 'heard' })
    expect(note.kind !== 'text' && note.transcript?.duration).toBe(6.4)
    expect((await reopened.thread.media(note.id))?.size).toBe(6)
  })

  it('hears again a Voice note that was being heard when the page closed', async () => {
    const stalled = fakeNetwork()
    stalled.on(() => new Promise<Response>(() => {})) // the request never comes back
    const device = deviceWithKey(stalled)
    const first = await createEngine(device)
    await first.thread.addFiles([voiceNote('PTT-0003.ogg', 1000)])
    expect(first.thread.get().messages[0]).toMatchObject({ state: 'hearing' })

    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-0003.ogg': NOTE_1 }))
    const reopened = await createEngine({ ...device, fetch: net.fetch })
    await reopened.thread.idle()

    expect(reopened.thread.get().messages[0]).toMatchObject({ state: 'heard' })
  })
})

describe('Unclear passages', () => {
  it('flags segments heard with low confidence, and only those', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({
      'PTT-0004.ogg': verboseJson([
        { text: ' الحشوة: بتقلي البصل مع اللحمة', start: 0, end: 4, avg_logprob: -0.15 },
        { text: ' و شوية بهار حلو', start: 4, end: 6.5, avg_logprob: -1.1 },
        { text: ' وشوية سماق', start: 6.5, end: 8, avg_logprob: -0.2, compression_ratio: 2.9 },
      ]),
    }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([voiceNote('PTT-0004.ogg', 1000)])
    await engine.thread.idle()

    const [note] = engine.thread.get().messages
    const segments = note.kind !== 'text' ? note.transcript!.segments : []
    expect(segments.map(s => s.unclear)).toEqual([false, true, true])
    expect(segments[0].confidence).toBeCloseTo(Math.exp(-0.15))
  })
})

describe('without a key, and when hearing fails', () => {
  it('keeps Voice notes waiting without a Groq key, and hears them once one is connected', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-0003.ogg': NOTE_1 }))
    net.on(groqModels)
    const engine = await createEngine(freshDevice({ fetch: net.fetch }))

    await engine.thread.addFiles([voiceNote('PTT-0003.ogg', 1000)])
    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'waiting' })
    expect(net.requests).toHaveLength(0)

    await engine.keys.connect('groq', 'gsk_new')
    await engine.thread.idle()

    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard' })
  })

  it('shows why a Voice note failed, and hears it on Try again', async () => {
    let online = false
    const net = fakeNetwork()
    net.on((url, init) => (online ? whisperBy({ 'PTT-0003.ogg': NOTE_1 })(url, init) : undefined))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([voiceNote('PTT-0003.ogg', 1000)])
    await engine.thread.idle()
    const [failed] = engine.thread.get().messages
    expect(failed).toMatchObject({ state: 'failed', failure: 'unreachable' })

    online = true
    await engine.thread.retry(failed.id)
    await engine.thread.idle()

    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard', failure: undefined })
  })

  it('waits as long as Groq asks when it is busy, then hears the note', async () => {
    let calls = 0
    const net = fakeNetwork()
    net.on((url, init) => {
      if (!url.pathname.endsWith('/audio/transcriptions')) return undefined
      return ++calls === 1
        ? new Response('{"error":{"message":"Rate limit reached","code":"rate_limit_exceeded"}}', { status: 429, headers: { 'retry-after': '7' } })
        : whisperBy({ 'PTT-0003.ogg': NOTE_1 })(url, init)
    })
    const waits: number[] = []
    const engine = await createEngine({ ...deviceWithKey(net), sleep: async ms => { waits.push(ms) } })

    await engine.thread.addFiles([voiceNote('PTT-0003.ogg', 1000)])
    await engine.thread.idle()

    expect(waits).toEqual([7000])
    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard' })
  })

  it('sends WhatsApp .opus voice notes as .ogg, which Groq accepts', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-20261011-WA0003.ogg': NOTE_1 }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([voiceNote('PTT-20261011-WA0003.opus', 1000, '')])
    await engine.thread.idle()

    expect(engine.thread.get().messages[0]).toMatchObject({ name: 'PTT-20261011-WA0003.opus', kind: 'voice', state: 'heard' })
  })
})

describe('Text messages and order', () => {
  it('slots a Text message anywhere, even before the first file, and keeps the order through moves and removals', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'a.ogg': NOTE_1, 'b.ogg': NOTE_2 }))
    const device = deviceWithKey(net)
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1), voiceNote('b.ogg', 2)])

    const first = await engine.thread.addText(0, 'before everything')
    const middle = await engine.thread.addText(2, 'between a and b')
    await engine.thread.setText(middle, 'use lamb')
    await engine.thread.move(first, 3)
    const b = engine.thread.get().messages.find(m => m.kind !== 'text' && m.name === 'b.ogg')!
    await engine.thread.remove(b.id)

    const names = (await createEngine(device)).thread.get().messages.map(m => (m.kind === 'text' ? m.text : m.name))
    expect(names).toEqual(['a.ogg', 'use lamb', 'before everything'])
    expect(await engine.thread.media(b.id)).toBeUndefined()
  })
})

describe('review fixes: retries and keys', () => {
  it('waits as long as Groq asks, even beyond a minute, and says when it will try again', async () => {
    let calls = 0
    const net = fakeNetwork()
    net.on((url, init) => {
      if (!url.pathname.endsWith('/audio/transcriptions')) return undefined
      return ++calls === 1
        ? new Response('{"error":{"code":"rate_limit_exceeded"}}', { status: 429, headers: { 'retry-after': '1800' } })
        : whisperBy({ 'PTT-0003.ogg': NOTE_1 })(url, init)
    })
    const seen: (number | undefined)[] = []
    let engine!: Awaited<ReturnType<typeof createEngine>>
    engine = await createEngine({
      ...deviceWithKey(net),
      sleep: async ms => {
        const m = engine.thread.get().messages[0]
        seen.push(m.kind !== 'text' ? m.retryAt : undefined)
        void ms
      },
      now: () => 1_000_000,
    })

    await engine.thread.addFiles([voiceNote('PTT-0003.ogg', 1000)])
    await engine.thread.idle()

    expect(seen).toEqual([1_000_000 + 1_800_000])
    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard', retryAt: undefined })
  })

  it('hears again Messages that failed on a rejected key once a new key is connected', async () => {
    let goodKey = false
    const net = fakeNetwork()
    net.on(url => (url.pathname.endsWith('/models') ? json({ object: 'list', data: [] }) : undefined))
    net.on((url, init) => {
      if (!url.pathname.endsWith('/audio/transcriptions')) return undefined
      return goodKey ? whisperBy({ 'PTT-0003.ogg': NOTE_1 })(url, init) : json({ error: { code: 'invalid_api_key' } }, 401)
    })
    const engine = await createEngine(deviceWithKey(net))
    await engine.thread.addFiles([voiceNote('PTT-0003.ogg', 1000)])
    await engine.thread.idle()
    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'failed', failure: 'rejected' })

    goodKey = true
    await engine.keys.connect('groq', 'gsk_new_good_key')
    await engine.thread.idle()

    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard' })
  })

  it('does not hear a Message again when Try again reaches one that is already heard', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-0003.ogg': NOTE_1 }))
    const engine = await createEngine(deviceWithKey(net))
    await engine.thread.addFiles([voiceNote('PTT-0003.ogg', 1000)])
    await engine.thread.idle()

    await engine.thread.retry(engine.thread.get().messages[0].id)
    await engine.thread.idle()

    expect(net.requests.filter(r => r.url.pathname.endsWith('/audio/transcriptions'))).toHaveLength(1)
  })

  it('labels the uploaded WhatsApp note as Ogg audio, not just renames it', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-0003.ogg': NOTE_1 }))
    const engine = await createEngine(deviceWithKey(net))

    await engine.thread.addFiles([voiceNote('PTT-0003.opus', 1000, 'application/octet-stream')])
    await engine.thread.idle()

    const form = net.requests[0].init?.body as FormData
    expect((form.get('file') as File).type).toBe('audio/ogg')
  })

  it('moves a Message by one and adds a Text message right next to another', async () => {
    const engine = await createEngine(freshDevice())
    await engine.thread.addFiles([voiceNote('a.ogg', 1), voiceNote('b.ogg', 2)])
    const [a, b] = engine.thread.get().messages

    await engine.thread.moveBy(b.id, -1)
    await engine.thread.addTextNear(a.id, 'above', 'before a')

    expect(engine.thread.get().messages.map(m => (m.kind === 'text' ? m.text : m.name))).toEqual(['b.ogg', 'before a', 'a.ogg'])
  })

  it('still honours a wait Groq asked for when the page is reloaded during it', async () => {
    const T = 1_791_800_000_000
    const busy = fakeNetwork()
    busy.on(url => (url.pathname.endsWith('/audio/transcriptions')
      ? new Response('{"error":{"code":"rate_limit_exceeded"}}', { status: 429, headers: { 'retry-after': '600' } })
      : undefined))
    const device = { ...deviceWithKey(busy), now: () => T }
    let waiting!: () => void
    const startedWaiting = new Promise<void>(resolve => { waiting = resolve })
    const before = await createEngine({ ...device, sleep: () => { waiting(); return new Promise<void>(() => {}) } })
    await before.thread.addFiles([voiceNote('a.ogg', 1)])
    await startedWaiting

    // The page closes four minutes into the ten-minute wait.
    const net = fakeNetwork()
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    const waits: number[] = []
    const after = await createEngine({ ...device, fetch: net.fetch, now: () => T + 240_000, sleep: async ms => { waits.push(ms) } })
    await after.thread.idle()

    expect(waits).toEqual([360_000])
    expect(after.thread.get().messages[0]).toMatchObject({ state: 'heard', retryAt: undefined })
  })
})

describe('saving on the device', () => {
  it('says when a change could not be saved, and stops saying so once a later save works', async () => {
    const engine = await createEngine(freshDevice())
    const full = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError') })

    const id = await engine.thread.addText(0, 'first')
    expect(engine.thread.get()).toMatchObject({ unsaved: true })

    full.mockRestore()
    await engine.thread.setText(id, 'first, saved')
    expect(engine.thread.get()).toMatchObject({ unsaved: false })
  })
})

describe('keeping files on the device', () => {
  it('keeps Voice notes where the browser won’t store files, as in Safari’s private browsing, and hears them after a reload', async () => {
    const put = IDBObjectStore.prototype.put
    const noFiles = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (value instanceof Blob) throw new DOMException('Error preparing Blob/File data to be stored in object store', 'UnknownError')
      return put.call(this, value, key)
    })
    const before = fakeNetwork()
    before.on(() => new Promise<undefined>(() => {})) // the page closes while it is being heard
    const device = deviceWithKey(before)
    const first = await createEngine(device)
    await first.thread.addFiles([voiceNote('a.ogg', 1)])

    const after = fakeNetwork()
    after.on(whisperBy({ 'a.ogg': NOTE_1 }))
    const reopened = await createEngine({ ...device, fetch: after.fetch })
    await reopened.thread.idle()
    noFiles.mockRestore()

    expect(reopened.thread.get().messages).toMatchObject([{ name: 'a.ogg', state: 'heard' }])
  })
})

describe('after a Result', () => {
  async function withResult() {
    const net = fakeNetwork()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1, 'b.ogg': NOTE_2 }))
    net.on(writerBy('# Done'))
    const engine = await createEngine(deviceWithKey(net))
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    await engine.thread.summarize({ mode: 'summary', preset: null, request: 'keep it short' })
    return engine
  }

  it('starts a fresh Thread when files are added, keeping the Result in History', async () => {
    const engine = await withResult()

    await engine.thread.addFiles([voiceNote('b.ogg', 2)])

    expect(names(engine)).toEqual(['b.ogg'])
    expect(engine.thread.get()).toMatchObject({ result: null, draft: { request: '' } })
    expect((await engine.history.list()).map(r => r.title)).toEqual(['Done'])
  })

  it('starts a fresh Thread when a Text message is added, too', async () => {
    const engine = await withResult()
    const [a] = engine.thread.get().messages

    await engine.thread.addTextNear(a.id, 'below', 'a new question')

    expect(names(engine)).toEqual(['a new question'])
    expect(engine.thread.get().result).toBeNull()
  })

  it('clears everything on Start over', async () => {
    const device = freshDevice()
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    const [a] = engine.thread.get().messages

    await engine.thread.startOver()

    expect(names(await createEngine(device))).toEqual([])
    expect(await engine.thread.media(a.id)).toBeUndefined()
  })
})
