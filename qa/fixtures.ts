// What the browser smoke tests share: a fresh app, Groq stubbed at the network, voice notes to add,
// and a check that nothing went wrong in the page along the way.
import { test as base, expect, type Page } from '@playwright/test'
import { KEYS } from '../src/engine/storage-keys.ts'

export { expect }

/** Not a real key: Groq is stubbed. */
export const FAKE_GROQ_KEY = 'gsk_fake_test_key_for_qa'
export const HEARD = 'يا بنتي أول شي بتنقعي البرغل نص ساعة'
export const RESULT_TITLE = 'Kibbeh for eight'
export const QUESTION = 'How long in the oven?'
export const ANSWER = 'About forty minutes at 200°C, until the top is golden.'

/** Every test fails if the page logs an error or throws. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(`${m.text()} ${m.location().url}`.trim()) })
    await use(errors)
    expect(errors).toEqual([])
  }, { auto: true }],
})

/** Opens Mulakhas as a returning visitor would: the tour seen, in `lang`, with a Groq key unless `key` is false. */
export async function openApp(page: Page, { lang = 'en', key = true } = {}) {
  await page.addInitScript(({ keys, lang, groqKey }) => {
    if (sessionStorage.getItem('qa-ready')) return // set up once: later reloads keep what the test changed
    localStorage.setItem(keys.uiLang, lang)
    localStorage.setItem(keys.tutorialSeen, '1')
    if (groqKey) localStorage.setItem(keys.groqKey, groqKey)
    sessionStorage.setItem('qa-ready', '1')
  }, { keys: KEYS, lang, groqKey: key ? FAKE_GROQ_KEY : '' })
  await page.goto('./')
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST' }

/**
 * Groq, stubbed for the whole browser context (so the service worker's requests are caught too):
 * every model a key could have, Whisper hearing `HEARD`, and the text model writing a Result titled
 * `RESULT_TITLE`, or `ANSWER` when asked `QUESTION`. Google is never reached: no Gemini key is set.
 */
export async function stubGroq(page: Page) {
  const calls = { transcriptions: 0, chats: 0 }
  await page.context().route('https://api.groq.com/**', async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const json = (body: unknown) => route.fulfill({ json: body, headers: CORS })
    const url = request.url()
    if (url.endsWith('/models')) return json({ data: [{ id: 'openai/gpt-oss-120b' }, { id: 'whisper-large-v3' }] })
    if (url.endsWith('/audio/transcriptions')) {
      calls.transcriptions++
      return json({ text: ` ${HEARD}`, language: 'Arabic', duration: 9, segments: [{ start: 0, end: 9, text: ` ${HEARD}`, avg_logprob: -0.2, compression_ratio: 1.2, no_speech_prob: 0.01 }] })
    }
    if (url.endsWith('/chat/completions')) {
      calls.chats++
      const content = request.postData()?.includes(QUESTION) ? ANSWER : `# ${RESULT_TITLE}\n\n**Ingredients**\n- 1 kg fine bulgur, soaked for half an hour\n\n**Method**\n1. Knead, press and layer.`
      return json({ choices: [{ message: { content }, finish_reason: 'stop' }] })
    }
    return route.fulfill({ status: 404, headers: CORS })
  })
  return calls
}

/** A second of tone as a 16 kHz WAV, under a WhatsApp voice note's name. */
export function voiceNote(name: string) {
  const rate = 16_000
  const bytes = rate * 2
  const buffer = Buffer.alloc(44 + bytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + bytes, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(rate, 24)
  buffer.writeUInt32LE(rate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(bytes, 40)
  for (let i = 0; i < rate; i++) buffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2)
  return { name, mimeType: 'audio/wav', buffer }
}
