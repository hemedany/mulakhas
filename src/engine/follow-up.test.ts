import { describe, expect, it, vi } from 'vitest'
import { chatAnswer, groqChatModels, verboseJson, voiceNote, whisperBy } from './fixtures'
import { FOLLOW_UP_PROMPT } from './follow-up'
import { createEngine, type EngineDeps } from './index'
import { deviceWithKey, fakeNetwork, json } from './testing'

type Body = { messages: { role: string; content: string }[]; model: string }
const chatBodies = (net: ReturnType<typeof fakeNetwork>): Body[] =>
  net.requests.filter(r => r.url.pathname.endsWith('/chat/completions')).map(r => JSON.parse(String(r.init?.body)))
const isFollowUp = (body: Body) => body.messages[0].content === FOLLOW_UP_PROMPT
const prompt = (body: Body) => body.messages.at(-1)!.content

const RECIPE = '# Kibbeh\n\n- 500 g lamb\n- 2 cups bulgur'

/** Writes RECIPE for the Result, and answers Follow-ups with `answers` in turn; with none left, never answers. */
function groq(net: ReturnType<typeof fakeNetwork>, answers: (string | Response)[]) {
  net.on(groqChatModels)
  net.on(whisperBy({ 'a.ogg': verboseJson([{ text: ' نص كيلو لحمة', start: 0, end: 3 }, { text: ' و كاسة برغل', start: 3, end: 5, avg_logprob: -1.1 }]) }))
  net.on((url, init) => {
    if (!url.pathname.endsWith('/chat/completions')) return undefined
    const body: Body = JSON.parse(String(init?.body))
    if (!isFollowUp(body)) return json(chatAnswer(RECIPE, body.model))
    const next = answers.shift()
    if (next === undefined) return new Promise<undefined>(() => {})
    return next instanceof Response ? next : json(chatAnswer(next, body.model))
  })
}

async function withResult(device: EngineDeps) {
  const engine = await createEngine(device)
  await engine.thread.addFiles([voiceNote('a.ogg', 1)])
  await engine.thread.summarize({ mode: 'summary', preset: 'recipe', request: '' })
  return engine
}

describe('Follow-ups', () => {
  it('asks Groq with the Transcripts, the Result and the question, and keeps the answer under the Result', async () => {
    const net = fakeNetwork()
    groq(net, ['Two cups of **fine** bulgur, though that part was hard to hear.'])
    const engine = await withResult(deviceWithKey(net))

    await engine.thread.askFollowUp('How much bulgur?')

    const asked = prompt(chatBodies(net).find(isFollowUp)!)
    expect(asked).toContain('===== Message 1 of 1: VOICE NOTE (transcript) =====\nنص كيلو لحمة ⟦unclear: و كاسة برغل⟧')
    expect(asked).toContain(`THE RESULT YOU WROTE:\n${RECIPE}`)
    expect(asked).toContain('THE FOLLOW-UP QUESTION:\nHow much bulgur?')
    expect(engine.thread.get().result!.followUps).toMatchObject([{ question: 'How much bulgur?', state: 'answered', answer: 'Two cups of **fine** bulgur, though that part was hard to hear.' }])
  })

  it('gives each Follow-up the ones answered before it', async () => {
    const net = fakeNetwork()
    groq(net, ['Two cups.', 'About an hour.'])
    const engine = await withResult(deviceWithKey(net))

    await engine.thread.askFollowUp('How much bulgur?')
    await engine.thread.askFollowUp('And how long in the oven?')

    const second = prompt(chatBodies(net).filter(isFollowUp)[1])
    expect(second).toContain('EARLIER FOLLOW-UPS:\n\nQ: How much bulgur?\nA: Two cups.')
    expect(second).toContain('THE FOLLOW-UP QUESTION:\nAnd how long in the oven?')
  })

  it('saves answered Follow-ups with the Result in History, and keeps them across a reload', async () => {
    const net = fakeNetwork()
    groq(net, ['Two cups.'])
    const device = deviceWithKey(net)
    const engine = await withResult(device)

    await engine.thread.askFollowUp('How much bulgur?')

    const reopened = await createEngine(device)
    expect(reopened.thread.get().result!.followUps).toMatchObject([{ state: 'answered', answer: 'Two cups.' }])
    expect((await reopened.history.list())[0].followUps).toMatchObject([{ question: 'How much bulgur?', answer: 'Two cups.' }])
  })

  it('shows a failed Follow-up in place, and answers it on Try again', async () => {
    const net = fakeNetwork()
    groq(net, [json({ error: { message: 'Invalid API Key', code: 'invalid_api_key' } }, 401), 'Two cups.'])
    const engine = await withResult(deviceWithKey(net))

    await engine.thread.askFollowUp('How much bulgur?')
    const [failed] = engine.thread.get().result!.followUps!
    expect(failed).toMatchObject({ state: 'failed', failure: 'rejected' })

    await engine.thread.retryFollowUp(failed.id)
    expect(engine.thread.get().result!.followUps).toMatchObject([{ id: failed.id, state: 'answered', answer: 'Two cups.' }])
  })

  it('asks from the Result alone when the Thread is too big for the key to send again', async () => {
    const net = fakeNetwork()
    const tooLarge = json({ error: { message: 'Request too large for model `openai/gpt-oss-120b` in organization `org_01fake` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 41210, please reduce your message size and try again.', type: 'tokens', code: 'rate_limit_exceeded' } }, 413)
    groq(net, [tooLarge, 'From the Result: two cups.'])
    const engine = await withResult(deviceWithKey(net))

    await engine.thread.askFollowUp('How much bulgur?')

    const [full, short] = chatBodies(net).filter(isFollowUp)
    expect(prompt(full)).toContain('THE MESSAGES, IN ORDER:')
    expect(prompt(short)).not.toContain('نص كيلو لحمة')
    expect(prompt(short)).toContain(`THE RESULT YOU WROTE:\n${RECIPE}`)
    expect(engine.thread.get().result!.followUps).toMatchObject([{ state: 'answered', answer: 'From the Result: two cups.' }])
  })

  it('asks again a Follow-up that was being answered when the page closed', async () => {
    const before = fakeNetwork()
    groq(before, []) // Groq never answers the Follow-up: the page closes meanwhile
    const device = deviceWithKey(before)
    const engine = await withResult(device)
    void engine.thread.askFollowUp('How much bulgur?')
    await vi.waitFor(() => expect(chatBodies(before).some(isFollowUp)).toBe(true))

    const after = fakeNetwork()
    groq(after, ['Two cups.'])
    const reopened = await createEngine({ ...device, fetch: after.fetch })

    await vi.waitFor(() => expect(reopened.thread.get().result!.followUps).toMatchObject([{ question: 'How much bulgur?', state: 'answered', answer: 'Two cups.' }]))
  })

  it('keeps in History the files the Result was written from, even after the Thread changes', async () => {
    const net = fakeNetwork()
    groq(net, ['Two cups.'])
    const engine = await withResult(deviceWithKey(net))
    await engine.thread.remove(engine.thread.get().messages[0].id)

    await engine.thread.askFollowUp('How much bulgur?')

    expect((await engine.history.list())[0]).toMatchObject({ files: ['a.ogg'], followUps: [{ question: 'How much bulgur?', answer: 'Two cups.' }] })
  })

  it('doesn’t bring back a Result the user deleted from History', async () => {
    const net = fakeNetwork()
    groq(net, ['Two cups.'])
    const engine = await withResult(deviceWithKey(net))
    await engine.history.remove(engine.thread.get().result!.id)

    await engine.thread.askFollowUp('How much bulgur?')

    expect(await engine.history.list()).toEqual([])
  })

  it('asks again a Follow-up refused for its key once a new Groq key is connected', async () => {
    const net = fakeNetwork()
    groq(net, [json({ error: { message: 'Invalid API Key', code: 'invalid_api_key' } }, 401), 'Two cups.'])
    const engine = await withResult(deviceWithKey(net))
    await engine.thread.askFollowUp('How much bulgur?')
    expect(engine.thread.get().result!.followUps).toMatchObject([{ state: 'failed', failure: 'rejected' }])

    await engine.keys.connect('groq', 'gsk_new_test_key')

    await vi.waitFor(() => expect(engine.thread.get().result!.followUps).toMatchObject([{ state: 'answered', answer: 'Two cups.' }]))
  })

  it('answers in the interface language unless the question asks otherwise', async () => {
    const net = fakeNetwork()
    groq(net, ['كاستين.'])
    const device = deviceWithKey(net)
    device.localStorage.setItem('m2.uiLang', 'ar')
    const engine = await withResult(device)

    await engine.thread.askFollowUp('قديش برغل؟')

    expect(prompt(chatBodies(net).find(isFollowUp)!)).toContain('Answer in Arabic, unless the question is clearly in another language or asks for one.')
  })

  it('answers Follow-ups asked one after another in order, each with the ones before it', async () => {
    const net = fakeNetwork()
    groq(net, ['Two cups.', 'About an hour.'])
    const engine = await withResult(deviceWithKey(net))

    const first = engine.thread.askFollowUp('How much bulgur?')
    await engine.thread.askFollowUp('And how long in the oven?')
    await first

    expect(prompt(chatBodies(net).filter(isFollowUp)[1])).toContain('Q: How much bulgur?\nA: Two cups.')
    expect(engine.thread.get().result!.followUps.map(f => f.answer)).toEqual(['Two cups.', 'About an hour.'])
  })

  it('asks from the start of the Result when even the whole Result is too big for the key', async () => {
    const net = fakeNetwork()
    const tooLarge = () => json({ error: { message: 'Request too large for model `openai/gpt-oss-120b` in organization `org_01fake` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 30210, please reduce your message size and try again.', type: 'tokens', code: 'rate_limit_exceeded' } }, 413)
    groq(net, [tooLarge(), tooLarge(), 'From its start: two cups.'])
    const engine = await withResult(deviceWithKey(net))

    await engine.thread.askFollowUp('How much bulgur?')

    const asked = chatBodies(net).filter(isFollowUp).map(prompt)
    expect(asked).toHaveLength(3)
    expect(engine.thread.get().result!.followUps).toMatchObject([{ state: 'answered', answer: 'From its start: two cups.' }])
  })

  it('flags an answer that ran out of room', async () => {
    const net = fakeNetwork()
    const cut = chatAnswer('Two cups, and then', 'openai/gpt-oss-120b') as { choices: { finish_reason: string }[] }
    cut.choices[0].finish_reason = 'length'
    groq(net, [json(cut)])
    const engine = await withResult(deviceWithKey(net))

    await engine.thread.askFollowUp('How much bulgur?')

    expect(engine.thread.get().result!.followUps).toMatchObject([{ state: 'answered', cutOff: true }])
  })
})
