// Writing: a Groq text model turns the Thread's Transcripts and Text messages into the Result.
import type { Lang } from './langs'
import type { Mode } from './history'
import type { PresetId } from './presets'
import { GROQ_API, ProviderError, retryAfterMs, type Fetch } from './providers'
import type { Message } from './thread'

export interface WriteOptions {
  mode: Mode
  preset: PresetId | null
  /** The user's own words; may be empty. */
  request: string
}

export type WriteFailure = 'no-key' | 'empty' | 'nothing-heard' | 'rejected' | 'busy' | 'unreachable' | 'too-big' | 'unknown'

/** Groq's own figures when a request is too large for the key's tokens-per-minute limit. */
export interface TooLarge {
  limit: number
  requested: number
}

export class WriteError extends ProviderError<WriteFailure> {
  readonly tooLarge: TooLarge | null
  constructor(failure: WriteFailure, retryAfterMs: number | null = null, tooLarge: TooLarge | null = null) {
    super(failure, retryAfterMs)
    this.tooLarge = tooLarge
  }
}

export const LANGUAGE_NAME: Record<Lang, string> = { en: 'English', ar: 'Arabic', fr: 'French', de: 'German', tr: 'Turkish', es: 'Spanish' }

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

/** One Message as the writer reads it: a label with its number and kind, then its Transcript or text. */
export interface Block {
  label: string
  body: string
}

export const asText = (block: Block) => `${block.label}\n${block.body}`

export function messageBlock(message: Message, n: number, total: number): Block {
  const label = (kind: string) => `===== Message ${n} of ${total}: ${kind} =====`
  if (message.kind === 'text') return { label: label('TEXT MESSAGE'), body: message.text.trim() || '(empty)' }
  const what = message.kind === 'video' ? 'VIDEO' : 'VOICE NOTE'
  if (message.state !== 'heard' || !message.transcript) return { label: label(what), body: `(this ${what.toLowerCase()} could not be heard)` }
  const { segments, text, heardBy, shown } = message.transcript
  const said = (segments.length ? segments.map(s => (s.unclear ? `⟦unclear: ${s.text}⟧` : s.text)).join(' ') : text) || '(no speech)'
  if (heardBy !== 'gemini') return { label: label(`${what} (transcript)`), body: said }
  return { label: label(`${what} (what is said, then what it shows)`), body: `${said}\n[What the video shows]: ${shown || '(nothing described)'}` }
}

/** The Message number in a Block's label. */
export const numberOf = (block: Block) => Number(/Message (\d+) of/.exec(block.label)?.[1] ?? Number.NaN)

export const isExact = (options: WriteOptions) => options.mode === 'exact' || options.preset === 'exact'

/** The Request in words: Exact words, or a preset and the user's own wishes. */
function requestOf(options: WriteOptions) {
  const wishes = options.request.trim()
  if (isExact(options)) return EXACT_WORDS + (wishes ? `\nAdditional wishes: ${wishes}` : '')
  return [options.preset && options.preset !== 'exact' ? PRESET_PROMPT[options.preset] : null, wishes || null]
    .filter(Boolean).join('\nAdditional wishes: ') || DEFAULT_REQUEST
}

export interface PromptShape {
  /** The blocks are condensed notes, not the Messages themselves. */
  condensed?: boolean
  /** Exact words written in parts: this part carries on from an earlier one. */
  continuing?: boolean
}

/** The writer's whole prompt: the Request, which language to write in, then the Messages' blocks in order. */
export function promptFrom(blocks: Block[], options: WriteOptions, lang: Lang, { condensed = false, continuing = false }: PromptShape = {}) {
  // Exact words keeps every message in the language it was spoken in; only the labels follow the interface.
  const language = isExact(options)
    ? `Write the title and the message labels in ${LANGUAGE_NAME[lang]}; keep the messages themselves in their own language unless the Request asks for a translation.`
    : `Write the Result in ${LANGUAGE_NAME[lang]}, unless the Request asks for another language.`
  const carryOn = continuing
    ? '\n\nThis part carries on from an earlier part of the same Result: do NOT add a title, start directly with the first message below.'
    : ''
  const heading = condensed ? 'THE CONVERSATION (condensed notes on every message, in order):' : 'THE CONVERSATION:'
  return `WHAT THE USER WANTS (the Request):\n${requestOf(options)}\n\n${language}${carryOn}\n\n${heading}\n\n${blocks.map(asText).join('\n\n')}`
}

/** Condensing part of a big Thread into notes for the final write (see writing.ts). */
export const CONDENSE_PROMPT = `You prepare notes for a writer who will turn a long thread of messages into one Result. You receive some of its messages, in order, each under a label with its number. For each message, write compact notes that keep EVERY detail that could matter for the Request: facts, names, quantities, times, steps and decisions, and above all corrections ("not X, Y"). Keep the language each message was in. Copy ⟦unclear: …⟧ markers as they are.

Answer with JSON only, one entry for every message you receive: {"notes": [{"message": <its number>, "notes": "<the notes>"}]}`

export function condensePrompt(blocks: Block[], options: WriteOptions) {
  return `THE REQUEST THE NOTES ARE FOR:\n${requestOf(options)}\n\nTHE MESSAGES:\n\n${blocks.map(asText).join('\n\n')}`
}

/** Worth pressing Summarize: some Text, or a Voice note or Video that is heard or may still be. */
export function mayWrite(messages: Message[]) {
  return messages.some(m => (m.kind === 'text' ? m.text.trim() !== '' : m.state !== 'failed'))
}

/** Ready to write once hearing has finished: some Text, or something that was heard. */
export function canWrite(messages: Message[]) {
  return messages.some(m => (m.kind === 'text' ? m.text.trim() !== '' : m.state === 'heard'))
}

// Preferred writers, best first; the first one the key can use wins.
const PREFERRED = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant']
const NOT_A_WRITER = /whisper|tts|guard|orpheus|safeguard|playai|distil/i
/** Billions of parameters, read from a model id such as "llama-3.3-70b-versatile"; 0 when it doesn't say. */
const sizeOf = (id: string) => Number(/(\d+)b\b/i.exec(id)?.[1] ?? 0)

export async function chooseWriter(fetch: Fetch, key: string): Promise<string> {
  let ids: string[] = []
  try {
    const res = await fetch(`${GROQ_API}/models`, { headers: { Authorization: `Bearer ${key}` } })
    if (res.ok) ids = ((await res.json()).data ?? []).map((m: { id: string }) => m.id)
  } catch {
    // Fall through to the default; the write itself will report a dropped connection.
  }
  const largest = ids.filter(id => !NOT_A_WRITER.test(id)).sort((a, b) => sizeOf(b) - sizeOf(a))[0]
  return PREFERRED.find(id => ids.includes(id)) ?? largest ?? PREFERRED[0]
}

export interface Written {
  text: string
  /** The model ran out of room before it finished, so the end is missing. */
  cutOff: boolean
}

/** The most the writer may write in one answer. Groq's free tier counts it against the tokens-per-minute limit. */
export const WRITE_MAX_TOKENS = 4096

// "Request too large for model `openai/gpt-oss-120b` … on tokens per minute (TPM): Limit 8000, Requested 9412, …"
const TOO_LARGE = /Limit (\d+), Requested (\d+)/

/** How one request to the writer is made. */
export interface WriteSettings {
  system: string
  /** The most it may write back, thinking included. */
  maxTokens: number
  /** How hard gpt-oss thinks first: less leaves more room for the text when room is tight. */
  thinking: 'low' | 'medium'
}

export const WRITE_RESULT: WriteSettings = { system: SYSTEM_PROMPT, maxTokens: WRITE_MAX_TOKENS, thinking: 'medium' }

export async function write(fetch: Fetch, key: string, model: string, prompt: string, settings: WriteSettings = WRITE_RESULT): Promise<Written> {
  let res: Response
  try {
    res = await fetch(`${GROQ_API}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: settings.system }, { role: 'user', content: prompt }],
        temperature: 0.3,
        max_completion_tokens: settings.maxTokens,
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: settings.thinking } : {}),
      }),
    })
  } catch {
    throw new WriteError('unreachable')
  }
  if (res.ok) {
    const choice = (await res.json()).choices?.[0]
    const text: string = choice?.message?.content?.trim() ?? ''
    const cutOff = choice?.finish_reason === 'length'
    // Thinking can use up all the room before a single word of the Result is written.
    if (!text) throw new WriteError(cutOff ? 'too-big' : 'unknown')
    return { text, cutOff }
  }
  if (res.status === 401 || res.status === 403) throw new WriteError('rejected')
  if (res.status === 413) {
    const found = TOO_LARGE.exec(await res.text().catch(() => ''))
    throw new WriteError('too-big', null, found ? { limit: Number(found[1]), requested: Number(found[2]) } : null)
  }
  if (res.status === 429 || res.status >= 500) throw new WriteError('busy', retryAfterMs(res))
  throw new WriteError('unknown')
}

/** The Result's title: its first heading, else its first words. */
export function titleOf(markdown: string) {
  const heading = /^#{1,3}\s+(.+)$/m.exec(markdown)?.[1]
  return (heading ?? markdown.replace(/[#*_>`]/g, '').trim()).slice(0, 80)
}
