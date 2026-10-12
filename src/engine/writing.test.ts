import { describe, expect, it } from 'vitest'
import { chatAnswer, groqChatModels } from './fixtures'
import { createEngine, type EngineDeps } from './index'
import { deviceWithKey, fakeNetwork, json } from './testing'
import { CONDENSE_PROMPT } from './writer'

type Body = { model: string; max_completion_tokens: number; messages: { role: string; content: string }[] }

const chatBodies = (net: ReturnType<typeof fakeNetwork>): Body[] =>
  net.requests.filter(r => r.url.pathname.endsWith('/chat/completions')).map(r => JSON.parse(String(r.init?.body)))

const isCondensing = (body: Body) => body.messages[0].content === CONDENSE_PROMPT
const prompt = (body: Body) => body.messages.at(-1)!.content
/** What Groq's free tier counts for a request: its messages (about a token per 2.5 characters here) plus the room asked for. */
const tokensOf = (body: Body) => Math.ceil(JSON.stringify(body.messages).length / 2.5) + body.max_completion_tokens

/** Groq's free tier: refuses a request over `limit()` tokens a minute as too large, in its own words. */
function freeTier(limit: () => number, refused: Body[] = []) {
  return (url: URL, init: RequestInit | undefined) => {
    if (!url.pathname.endsWith('/chat/completions')) return undefined
    const body: Body = JSON.parse(String(init?.body))
    if (tokensOf(body) <= limit()) return undefined
    refused.push(body)
    return json({
      error: {
        message: `Request too large for model \`${body.model}\` in organization \`org_01fake\` service tier \`on_demand\` on tokens per minute (TPM): Limit ${limit()}, Requested ${tokensOf(body)}, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing`,
        type: 'tokens',
        code: 'rate_limit_exceeded',
      },
    }, 413)
  }
}

/** The writer: condensing answers with JSON notes for each Message it was given (bar `leaveOut`), writing with `result`. */
function writer(result: string, { leaveOut = [] as number[] } = {}) {
  return (url: URL, init: RequestInit | undefined) => {
    if (!url.pathname.endsWith('/chat/completions')) return undefined
    const body: Body = JSON.parse(String(init?.body))
    if (!isCondensing(body)) return json(chatAnswer(result, body.model))
    const numbers = [...new Set([...prompt(body).matchAll(/===== Message (\d+) of/g)].map(m => Number(m[1])))]
    const notes = numbers.filter(n => !leaveOut.includes(n)).map(n => ({ message: n, notes: `notes on message ${n}` }))
    return json(chatAnswer(JSON.stringify({ notes }), body.model))
  }
}

const sent = (net: ReturnType<typeof fakeNetwork>, refused: Body[]) => chatBodies(net).filter(b => !refused.some(r => JSON.stringify(r) === JSON.stringify(b)))

/** A Thread of long Text messages: `count` of them, each about `chars` characters of Levantine Arabic. */
async function longThread(device: EngineDeps, count: number, chars = 6000) {
  const engine = await createEngine(device)
  for (let i = 0; i < count; i++) await engine.thread.addText(i, `${i + 1}: ${'بدك تحط الرز بعد ما يغلي المي '.repeat(Math.ceil(chars / 30)).slice(0, chars)}`)
  return engine
}

const summary = { mode: 'summary', preset: null, request: '' } as const

describe('big Threads written in parts', () => {
  it('sends the whole Thread in one go when the key takes it', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    net.on(writer('# Rice'))
    const engine = await longThread(deviceWithKey(net), 6)

    const result = await engine.thread.summarize(summary)

    expect(chatBodies(net)).toHaveLength(1)
    expect(result.text).toBe('# Rice')
  })

  it('condenses a Thread too big for the key in groups, in order, and writes the Result from notes under each Message’s own label', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    const refused: Body[] = []
    net.on(freeTier(() => 8000, refused))
    net.on(writer('# Rice'))
    const engine = await longThread(deviceWithKey(net), 6)

    const result = await engine.thread.summarize(summary)

    const parts = sent(net, refused)
    expect(refused.map(isCondensing)).toEqual([false]) // the whole Thread, once
    expect(parts.map(isCondensing)).toEqual([...parts.slice(0, -1).map(() => true), false])
    const condensed = parts.slice(0, -1).flatMap(b => [...new Set([...prompt(b).matchAll(/Message (\d+) of 6/g)].map(m => Number(m[1])))])
    expect([...new Set(condensed)]).toEqual([1, 2, 3, 4, 5, 6])
    const final = prompt(parts.at(-1)!)
    for (let n = 1; n <= 6; n++) expect(final).toContain(`===== Message ${n} of 6: TEXT MESSAGE (condensed notes) =====\nnotes on message ${n}`)
    expect(final).not.toContain('بدك تحط الرز')
    expect(result.text).toBe('# Rice')
  })

  it('keeps a Message’s own text when the notes leave it out, so nothing is lost', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    const refused: Body[] = []
    net.on(freeTier(() => 8000, refused))
    net.on(writer('# Rice', { leaveOut: [4] }))
    const engine = await longThread(deviceWithKey(net), 6, 2500)

    await engine.thread.summarize(summary)

    const final = prompt(sent(net, refused).at(-1)!)
    expect(final).toContain('===== Message 4 of 6: TEXT MESSAGE =====\n4: بدك تحط الرز')
    expect(final).toContain('notes on message 5')
  })

  it('shows which part is being written, counting up to the last', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    net.on(freeTier(() => 8000))
    net.on(writer('# Rice'))
    const engine = await longThread(deviceWithKey(net), 6)
    const seen: [number, number][] = []
    engine.thread.subscribe(({ writing }) => { if (writing.state === 'writing' && writing.part) seen.push([writing.part.n, writing.part.of]) })

    await engine.thread.summarize(summary)

    const parts = [...new Map(seen.map(([n, of]) => [n, of])).entries()]
    expect(parts.map(([n]) => n)).toEqual(parts.map((_, i) => i + 1))
    expect(parts.at(-1)![0]).toBe(parts.at(-1)![1])
    expect(parts.length).toBeGreaterThan(2)
  })

  it('writes Exact words in parts word for word, never condensed, joined in order without extra titles or repeated headings', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    const refused: Body[] = []
    net.on(freeTier(() => 8000, refused))
    let part = 0
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions')) return undefined
      const body: Body = JSON.parse(String(init?.body))
      part++
      // Each part titles itself and opens with the heading of the Message it starts in, as models do.
      const first = /Message (\d+) of/.exec(prompt(body))![1]
      return json(chatAnswer(`# Rice\n\n### Message ${first}\npart ${part}`, body.model))
    })
    const engine = await longThread(deviceWithKey(net), 1, 15_000) // one Message, cut across parts

    const result = await engine.thread.summarize({ mode: 'exact', preset: null, request: '' })

    const parts = sent(net, refused)
    expect(parts.some(isCondensing)).toBe(false)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.map(b => prompt(b).includes('do NOT add a title'))).toEqual([false, ...parts.slice(1).map(() => true)])
    expect(result.text).toBe(`# Rice\n\n### Message 1\npart 1${parts.slice(1).map((_, i) => `\n\npart ${i + 2}`).join('')}`)
  })

  it('plans the parts again when Groq refuses one as too large, and every part it then takes fits', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    let requests = 0
    net.on(url => { if (url.pathname.endsWith('/chat/completions')) requests++; return undefined })
    const refused: Body[] = []
    // The whole Thread is measured against 8,000; after that the key turns out tighter.
    net.on(freeTier(() => (requests <= 1 ? 8000 : 5000), refused))
    net.on(writer('# Rice'))
    const engine = await longThread(deviceWithKey(net), 6)

    const result = await engine.thread.summarize(summary)

    expect(result.text).toBe('# Rice')
    expect(refused.length).toBeGreaterThan(1)
    for (const body of sent(net, refused)) expect(tokensOf(body)).toBeLessThanOrEqual(5000)
  })

  it('waits as long as Groq asks when it rate-limits a part, then sends that part again', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    const refused: Body[] = []
    net.on(freeTier(() => 8000, refused))
    let condensing = 0
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions') || !isCondensing(JSON.parse(String(init?.body)))) return undefined
      return ++condensing === 2 ? new Response('{"error":{"message":"Rate limit reached on tokens per minute (TPM). Please try again in 12.5s.","code":"rate_limit_exceeded"}}', { status: 429, headers: { 'retry-after': '13' } }) : undefined
    })
    net.on(writer('# Rice'))
    const waits: number[] = []
    const engine = await longThread({ ...deviceWithKey(net), sleep: async ms => { waits.push(ms) } }, 6)

    const result = await engine.thread.summarize(summary)

    expect(waits).toEqual([13_000])
    expect(result.text).toBe('# Rice')
  })

  it('carries on from the parts already written when trying again', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    const refused: Body[] = []
    net.on(freeTier(() => 8000, refused))
    let failFinal = true
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions')) return undefined
      return failFinal && !isCondensing(JSON.parse(String(init?.body))) ? json({ error: { message: 'Service Unavailable' } }, 503) : undefined
    })
    net.on(writer('# Rice'))
    const engine = await longThread(deviceWithKey(net), 6)
    await expect(engine.thread.summarize(summary)).rejects.toMatchObject({ failure: 'busy' })
    const condensedBefore = sent(net, refused).filter(isCondensing).length

    failFinal = false
    await engine.thread.summarize(summary)

    expect(sent(net, refused).filter(isCondensing)).toHaveLength(condensedBefore)
  })

  it('backs off when Groq’s servers fail without saying how long to wait', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    let calls = 0
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions')) return undefined
      return ++calls <= 2 ? json({ error: { message: 'Service Unavailable' } }, 503) : json(chatAnswer('# Short', JSON.parse(String(init?.body)).model))
    })
    const waits: number[] = []
    const engine = await longThread({ ...deviceWithKey(net), sleep: async ms => { waits.push(ms) } }, 1, 200)

    await engine.thread.summarize(summary)

    expect(waits).toEqual([2000, 4000])
  })
})
