// Writing: a Groq text model turns the Thread's Transcripts and Text messages into the Result.
import type { Lang } from './langs'
import type { Mode } from './history'
import type { PresetId } from './presets'
import { GROQ_API, type Fetch } from './providers'
import type { Message } from './thread'

export interface WriteOptions {
  mode: Mode
  preset: PresetId | null
  /** The user's own words; may be empty. */
  request: string
}

export type WriteFailure = 'no-key' | 'empty' | 'rejected' | 'busy' | 'unreachable' | 'too-big' | 'unknown'

export class WriteError extends Error {
  readonly failure: WriteFailure
  readonly retryAfterMs: number | null
  constructor(failure: WriteFailure, retryAfterMs: number | null = null) {
    super(failure)
    this.failure = failure
    this.retryAfterMs = retryAfterMs
  }
}

const LANGUAGE_NAME: Record<Lang, string> = { en: 'English', ar: 'Arabic', fr: 'French', de: 'German', tr: 'Turkish', es: 'Spanish' }

/** Instructions behind each preset. The Result language is set separately, so none of them names one. */
export const PRESET_PROMPT: Record<Exclude<PresetId, 'exact'>, string> = {
  recipe: 'Combine everything into ONE complete recipe: a title, the full ingredients list with quantities, then clear numbered steps in the right order. Include any tips or warnings that were mentioned.',
  steps: 'Write a detailed step-by-step guide based on everything, numbered and in the correct order.',
  todo: 'List only the action items: the things the listener needs to do.',
  points: 'Summarize everything as short, clear bullet points, in the order things were said.',
  translate: 'Translate everything in full detail, then add a short summary at the end. If everything is already in the Result language, translate it into English instead.',
}

const DEFAULT_REQUEST = 'Summarize all of this clearly, keeping every important detail, in a logical order.'

const EXACT_WORDS = `Produce a cleaned-up, easy-to-read TRANSCRIPT of every message: do NOT summarize, shorten or omit anything.
- Keep each message in the language and dialect it was spoken in, written clearly.
- Remove filler words, repetitions and false starts, and add proper punctuation.
- Label each part "### Message N: voice note / video / text message".`

export const SYSTEM_PROMPT = `You are Mulakhas. You receive a conversation made of messages (voice notes, videos and text messages) in their exact original order, possibly in Arabic dialects (often Levantine), English or a mix, all about one topic. Each voice note or video arrives as a transcript.

Read everything and understand it across all messages, respecting their order: later messages may add to, clarify or CORRECT earlier ones, and corrections win. Merge duplicated information.

HONESTY: never silently guess. Passages marked ⟦unclear: …⟧ were heard with low confidence. If a word, quantity or name is uncertain, write your best reading followed by [unclear], for example "add 2 [unclear: maybe 3?] cups". Missing a word honestly is better than inventing one confidently.

If several speakers can clearly be told apart, label who is speaking (their names if mentioned, otherwise "Speaker 1", "Speaker 2").

Respond in clean Markdown only: headings, bold, bullet and numbered lists. Start with a "# " title.`

function describe(message: Message, n: number, total: number) {
  const head = `===== Message ${n} of ${total}`
  if (message.kind === 'text') return `${head}: TEXT MESSAGE =====\n${message.text.trim() || '(empty)'}`
  const what = message.kind === 'video' ? 'VIDEO' : 'VOICE NOTE'
  if (message.state !== 'heard' || !message.transcript) return `${head}: ${what} =====\n(this ${what.toLowerCase()} could not be heard)`
  const body = message.transcript.segments.length
    ? message.transcript.segments.map(s => (s.unclear ? `⟦unclear: ${s.text}⟧` : s.text)).join(' ')
    : message.transcript.text
  return `${head}: ${what} (transcript) =====\n${body || '(no speech)'}`
}

export function buildRequest(messages: Message[], options: WriteOptions, lang: Lang) {
  const wishes = options.request.trim()
  const ask = options.mode === 'exact'
    ? EXACT_WORDS + (wishes ? `\nAdditional wishes: ${wishes}` : '')
    : [options.preset && options.preset !== 'exact' ? PRESET_PROMPT[options.preset] : null, wishes || null]
      .filter(Boolean).join('\nAdditional wishes: ') || DEFAULT_REQUEST
  const language = `Write the Result in ${LANGUAGE_NAME[lang]}, unless the Request asks for another language.`
  const conversation = messages.map((m, i) => describe(m, i + 1, messages.length)).join('\n\n')
  return `WHAT THE USER WANTS (the Request):\n${ask}\n\n${language}\n\nTHE CONVERSATION:\n\n${conversation}`
}

// Preferred writers, best first; the first one the key can use wins.
const PREFERRED = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant']
const NOT_A_WRITER = /whisper|tts|guard|orpheus|safeguard|playai|distil/i

export async function chooseWriter(fetch: Fetch, key: string): Promise<string> {
  let ids: string[] = []
  try {
    const res = await fetch(`${GROQ_API}/models`, { headers: { Authorization: `Bearer ${key}` } })
    if (res.ok) ids = ((await res.json()).data ?? []).map((m: { id: string }) => m.id)
  } catch {
    // Fall through to the default; the write itself will report a dropped connection.
  }
  return PREFERRED.find(id => ids.includes(id)) ?? ids.find(id => !NOT_A_WRITER.test(id)) ?? PREFERRED[0]
}

function retryAfterMs(res: Response) {
  const s = Number(res.headers.get('retry-after'))
  return Number.isFinite(s) && s > 0 ? s * 1000 : null
}

export async function write(fetch: Fetch, key: string, model: string, user: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${GROQ_API}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: user }],
        temperature: 0.3,
        max_completion_tokens: 4096,
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'medium' } : {}),
      }),
    })
  } catch {
    throw new WriteError('unreachable')
  }
  if (res.ok) {
    const text: string = (await res.json()).choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) throw new WriteError('unknown')
    return text
  }
  if (res.status === 401 || res.status === 403) throw new WriteError('rejected')
  if (res.status === 413) throw new WriteError('too-big')
  if (res.status === 429 || res.status >= 500) throw new WriteError('busy', retryAfterMs(res))
  throw new WriteError('unknown')
}

/** The Result's title: its first heading, else its first words. */
export function titleOf(markdown: string) {
  const heading = /^#{1,3}\s+(.+)$/m.exec(markdown)?.[1]
  return (heading ?? markdown.replace(/[#*_>`]/g, '').trim()).slice(0, 80)
}
