import { describe, expect, it } from 'vitest'
import { chatAnswer, groqChatModels, verboseJson, voiceNote, whisperBy, writerBy } from './fixtures'
import { createEngine } from './index'
import { fakeNetwork, freshDevice, json } from './testing'

function setup(lang = 'en') {
  const net = fakeNetwork()
  const device = freshDevice({ fetch: net.fetch })
  device.localStorage.setItem('m2.groqKey', 'gsk_test_key')
  device.localStorage.setItem('m2.uiLang', lang)
  return { net, device }
}

const chatBodies = (net: ReturnType<typeof fakeNetwork>) =>
  net.requests.filter(r => r.url.pathname.endsWith('/chat/completions')).map(r => JSON.parse(String(r.init?.body)))

const NOTE_1 = verboseJson([{ text: ' يا بنتي أول شي بتنقعي البرغل نص ساعة', start: 0, end: 10 }])
const NOTE_2 = verboseJson([
  { text: ' الحشوة بتقلي البصل مع اللحمة', start: 0, end: 30, avg_logprob: -0.1 },
  { text: ' و شوية بهار حلو', start: 30, end: 40, avg_logprob: -1.2 },
])
const RECIPE = '# Kibbeh bil sanieh\n\n**Ingredients**\n- 500 g lamb'

describe('writing the Result', () => {
  it('sends the Transcripts in Thread order with Text messages in place, plus the Request and Mode', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1, 'b.ogg': NOTE_2 }))
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1), voiceNote('b.ogg', 2)])
    await engine.thread.addText(1, 'Use lamb, not beef!')

    const result = await engine.thread.summarize({ mode: 'summary', preset: 'recipe', request: 'Make it for 6 people' })

    expect(result.text).toBe(RECIPE)
    const [body] = chatBodies(net)
    expect(body.model).toBe('openai/gpt-oss-120b')
    const user: string = body.messages.at(-1).content
    const order = ['Message 1 of 3', 'يا بنتي', 'Message 2 of 3', 'Use lamb, not beef!', 'Message 3 of 3', 'الحشوة'].map(s => user.indexOf(s))
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]))).toBe(true)
    expect(user).toContain('ONE complete recipe')
    expect(user).toContain('Make it for 6 people')
  })

  it('marks Unclear passages for the writer, so it can flag them instead of guessing', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'b.ogg': NOTE_2 }))
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('b.ogg', 1)])

    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    const [body] = chatBodies(net)
    expect(body.messages.at(-1).content).toContain('⟦unclear: و شوية بهار حلو⟧')
    expect(body.messages[0].content).toContain('[unclear')
  })

  it('waits for Messages still being heard before writing', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(async (url, init) => {
      if (!url.pathname.endsWith('/audio/transcriptions')) return undefined
      await new Promise(r => setTimeout(r, 20))
      return whisperBy({ 'a.ogg': NOTE_1 })(url, init)
    })
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    const paths = net.requests.map(r => r.url.pathname.split('/').pop())
    expect(paths.indexOf('transcriptions')).toBeLessThan(paths.indexOf('completions'))
    expect(chatBodies(net)[0].messages.at(-1).content).toContain('يا بنتي')
  })

  it('asks for the Result in the interface language unless the Request names one', async () => {
    const { net, device } = setup('ar')
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    await engine.thread.summarize({ mode: 'summary', preset: 'points', request: '' })

    const user: string = chatBodies(net)[0].messages.at(-1).content
    expect(user).toContain('Write the Result in Arabic, unless the Request asks for another language.')
  })

  it('keeps every word in Exact words mode', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on(writerBy('### Message 1'))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    await engine.thread.summarize({ mode: 'exact', preset: 'recipe', request: '' })

    const user: string = chatBodies(net)[0].messages.at(-1).content
    expect(user).toContain('do NOT summarize')
    expect(user).not.toContain('ONE complete recipe')
    // Each message stays in its own language; only the labels follow the interface.
    expect(user).not.toContain('Write the Result in English')
    expect(user).toContain('keep the messages themselves in their own language')
  })

  it('treats the Exact words preset as Exact words, wherever it was picked', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on(writerBy('### Message 1'))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    await engine.thread.summarize({ mode: 'summary', preset: 'exact', request: '' })

    expect(chatBodies(net)[0].messages.at(-1).content).toContain('do NOT summarize')
  })
})

describe('writing problems', () => {
  it('waits as long as Groq asks when writing is busy, says when it will try again, then writes', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    let calls = 0
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions')) return undefined
      return ++calls === 1
        ? new Response('{"error":{"code":"rate_limit_exceeded"}}', { status: 429, headers: { 'retry-after': '90' } })
        : writerBy(RECIPE)(url, init)
    })
    const T = 1_791_800_000_000
    const shown: unknown[] = []
    let engine!: Awaited<ReturnType<typeof createEngine>>
    engine = await createEngine({ ...device, now: () => T, sleep: async ms => { shown.push([ms, engine.thread.get().writing]) } })
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    const result = await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    expect(shown).toEqual([[90_000, { state: 'writing', retryAt: T + 90_000 }]])
    expect(result.text).toBe(RECIPE)
  })

  it('flags a Result the writer could not finish, here and in History', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions')) return undefined
      const answer = chatAnswer('# Message 1\n\nيا بنتي أول شي', JSON.parse(String(init?.body)).model)
      answer.choices[0].finish_reason = 'length'
      return json(answer)
    })
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    const result = await engine.thread.summarize({ mode: 'exact', preset: null, request: '' })

    expect(result.cutOff).toBe(true)
    expect((await engine.history.list())[0]).toMatchObject({ cutOff: true })
  })

  it('says nothing could be heard, rather than asking for something to be added, when every note failed', async () => {
    const { net, device } = setup()
    net.on(url => (url.pathname.endsWith('/audio/transcriptions') ? json({ error: { message: 'could not process file', type: 'invalid_request_error' } }, 400) : undefined))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1), voiceNote('b.ogg', 2)])

    await expect(engine.thread.summarize({ mode: 'summary', preset: null, request: '' })).rejects.toMatchObject({ failure: 'nothing-heard' })
  })

  it('falls back to the largest model the key can use when none of the preferred ones is there', async () => {
    const { net, device } = setup()
    net.on(url => (url.pathname.endsWith('/models')
      ? json({ object: 'list', data: [{ id: 'whisper-large-v3' }, { id: 'allam-2-7b' }, { id: 'qwen/qwen3-32b' }, { id: 'meta-llama/llama-4-scout-17b-16e-instruct' }] })
      : undefined))
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    expect(chatBodies(net)[0].model).toBe('qwen/qwen3-32b')
  })
})

describe('the Reliability report', () => {
  it('gives each heard Message a clarity measured from Whisper, weighted by how long each part lasts', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1, 'b.ogg': NOTE_2 }))
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1), voiceNote('b.ogg', 2)])

    const { report } = await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    // Note 1: one clear 10s segment (avg_logprob -0.18). Note 2: 30s at -0.1 and 10s at -1.2.
    expect(report).toEqual([
      { n: 1, name: 'a.ogg', clarity: 84, unclear: [] },
      { n: 2, name: 'b.ogg', clarity: 75, unclear: ['و شوية بهار حلو'] },
    ])
  })
})

describe('after writing', () => {
  it('keeps the Result with the Thread across a reload and saves it to History', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    await engine.thread.summarize({ mode: 'summary', preset: 'recipe', request: '' })

    const reopened = await createEngine(device)

    expect(reopened.thread.get().result).toMatchObject({ text: RECIPE, mode: 'summary' })
    const [saved] = await reopened.history.list()
    expect(saved).toMatchObject({ title: 'Kibbeh bil sanieh', mode: 'summary', files: ['a.ogg'], text: RECIPE })
  })

  it('picks a writer from the models the key can use when the preferred one is gone', async () => {
    const { net, device } = setup()
    net.on(url => (url.pathname.endsWith('/models') ? json({ object: 'list', data: [{ id: 'whisper-large-v3' }, { id: 'llama-3.3-70b-versatile' }] }) : undefined))
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    expect(chatBodies(net)[0].model).toBe('llama-3.3-70b-versatile')
  })

  it('reports a rejected key instead of a Result', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on(url => (url.pathname.endsWith('/chat/completions') ? json({ error: { message: 'Invalid API Key', code: 'invalid_api_key' } }, 401) : undefined))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])

    await expect(engine.thread.summarize({ mode: 'summary', preset: null, request: '' })).rejects.toMatchObject({ failure: 'rejected' })
    expect(engine.thread.get()).toMatchObject({ writing: { state: 'failed', failure: 'rejected' } })
    expect(engine.thread.get().result).toBeNull()
  })
})


describe('the Request draft', () => {
  it('keeps the Request, Mode and preset being written across a reload', async () => {
    const { device } = setup()
    const engine = await createEngine(device)

    await engine.thread.setDraft({ request: 'for six people', mode: 'summary', preset: 'recipe' })
    const reopened = await createEngine(device)

    expect(reopened.thread.get().draft).toEqual({ request: 'for six people', mode: 'summary', preset: 'recipe' })
  })
})

describe('History', () => {
  it('forgets a deleted Result', async () => {
    const { net, device } = setup()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': NOTE_1 }))
    net.on(writerBy(RECIPE))
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    const { id } = await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    await engine.history.remove(id)

    expect(await (await createEngine(device)).history.list()).toEqual([])
  })
})
