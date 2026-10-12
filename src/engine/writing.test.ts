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

/** Answers condensing with notes naming the first Message in the batch, and writing with `result`. */
function writerInParts(result: string) {
  return (url: URL, init: RequestInit | undefined) => {
    if (!url.pathname.endsWith('/chat/completions')) return undefined
    const body: Body = JSON.parse(String(init?.body))
    const first = /Message (\d+) of/.exec(prompt(body))?.[1]
    return json(chatAnswer(isCondensing(body) ? `Notes from message ${first}` : result, body.model))
  }
}

/** A Thread of long Text messages: `count` of them, each about `chars` characters of Levantine Arabic. */
async function longThread(device: EngineDeps, count: number, chars = 6000) {
  const engine = await createEngine(device)
  for (let i = 0; i < count; i++) await engine.thread.addText(i, `${i + 1}: ${'بدك تحط الرز بعد ما يغلي المي '.repeat(Math.ceil(chars / 30)).slice(0, chars)}`)
  return engine
}

describe('big Threads written in parts', () => {
  it('condenses a Thread over the budget in batches, in order, then writes the Result from the notes', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels) // gpt-oss-120b: 8,000 tokens a minute on the free tier
    net.on(writerInParts('# Rice'))
    const engine = await longThread(deviceWithKey(net), 6)

    const result = await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    const bodies = chatBodies(net)
    expect(bodies.map(isCondensing)).toEqual([true, true, true, false])
    expect(bodies.slice(0, 3).map(b => [...prompt(b).matchAll(/Message (\d+) of 6/g)].map(m => Number(m[1])))).toEqual([[1, 2], [3, 4], [5, 6]])
    const final = prompt(bodies[3])
    expect(final.indexOf('Notes from message 1')).toBeLessThan(final.indexOf('Notes from message 3'))
    expect(final.indexOf('Notes from message 3')).toBeLessThan(final.indexOf('Notes from message 5'))
    expect(final).not.toContain('بدك تحط الرز')
    expect(result.text).toBe('# Rice')
  })

  it('shows which part is being written', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    net.on(writerInParts('# Rice'))
    const engine = await longThread(deviceWithKey(net), 6)
    const seen: string[] = []
    engine.thread.subscribe(({ writing }) => { if (writing.state === 'writing' && writing.part) seen.push(`${writing.part.n} of ${writing.part.of}`) })

    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    expect([...new Set(seen)]).toEqual(['1 of 4', '2 of 4', '3 of 4', '4 of 4'])
  })

  it('writes Exact words in parts word for word, never condensed, and joins them in order', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    let part = 0
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions')) return undefined
      part++
      return json(chatAnswer(part === 1 ? '# Rice\n\n### Message 1' : `### Message ${part}`, JSON.parse(String(init?.body)).model))
    })
    const engine = await longThread(deviceWithKey(net), 4)

    const result = await engine.thread.summarize({ mode: 'exact', preset: null, request: '' })

    const bodies = chatBodies(net)
    expect(bodies.some(isCondensing)).toBe(false)
    expect(bodies.length).toBeGreaterThan(1)
    expect(bodies.map(b => prompt(b).includes('do NOT add a title'))).toEqual([false, ...bodies.slice(1).map(() => true)])
    expect(result.text).toBe(['# Rice\n\n### Message 1', ...bodies.slice(1).map((_, i) => `### Message ${i + 2}`)].join('\n\n'))
  })

  it('learns the real limit when Groq says a request is too large, and sends parts that fit it', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    let first = true
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions') || !first) return undefined
      first = false
      const body = String(init?.body)
      return json({
        error: {
          message: `Request too large for model \`openai/gpt-oss-120b\` in organization \`org_01fake\` service tier \`on_demand\` on tokens per minute (TPM): Limit 5000, Requested ${Math.round(body.length / 2.2) + 4096}, please reduce your message size and try again.`,
          type: 'tokens',
          code: 'rate_limit_exceeded',
        },
      }, 413)
    })
    net.on(writerInParts('# Rice'))
    const engine = await longThread(deviceWithKey(net), 2, 2500)

    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    const [tooLarge, ...parts] = chatBodies(net)
    expect(isCondensing(tooLarge)).toBe(false)
    expect(parts.map(isCondensing)).toEqual([...parts.slice(0, -1).map(() => true), false])
    // Each part, priced the way Groq priced the first request, fits its 5,000 tokens a minute.
    for (const body of parts) expect(JSON.stringify(body).length / 2.2 + body.max_completion_tokens).toBeLessThanOrEqual(5000)
  })

  it('waits as long as Groq asks when it rate-limits a part, then sends that part again', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    let calls = 0
    net.on((url, init) => {
      if (!url.pathname.endsWith('/chat/completions')) return undefined
      if (++calls === 2) return new Response('{"error":{"message":"Rate limit reached on tokens per minute (TPM). Please try again in 12.5s.","code":"rate_limit_exceeded"}}', { status: 429, headers: { 'retry-after': '13' } })
      return writerInParts('# Rice')(url, init)
    })
    const waits: number[] = []
    const engine = await longThread({ ...deviceWithKey(net), sleep: async ms => { waits.push(ms) } }, 6)

    const result = await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    expect(waits).toEqual([13_000])
    expect(chatBodies(net).map(isCondensing)).toEqual([true, true, true, true, false]) // the second part twice
    expect(result.text).toBe('# Rice')
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

    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    expect(waits).toEqual([2000, 4000])
  })
})
