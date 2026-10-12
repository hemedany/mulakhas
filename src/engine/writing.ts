// Writing the Result, in one go when the Thread fits what the key may send Groq in a minute, and
// in parts when it doesn't: a Summary condenses the Messages in batches (keeping their numbers,
// corrections and unclear markers) and is written from those notes; Exact words, which must not
// be shortened, writes each batch word for word and joins them in order.
import type { Lang } from './langs'
import type { Message } from './thread'
import {
  CONDENSE_PROMPT, SYSTEM_PROMPT, WRITE_MAX_TOKENS, WriteError, condensePrompt, isExact, messageBlock, promptFrom,
  type TooLarge, type WriteOptions, type Written,
} from './writer'

/** What a key may send one writer in a minute, as far as Mulakhas knows. */
export interface Budget {
  /** Tokens per minute. */
  limit: number
  /** Tokens per character of prompt, for estimating before sending. */
  tokensPerChar: number
}

// Groq's free-tier tokens-per-minute for the writers Mulakhas prefers (October 2026). A paid key
// gets more; whatever Groq says when a request is too large replaces these.
const FREE_TIER_LIMIT: Record<string, number> = {
  'openai/gpt-oss-120b': 8000,
  'llama-3.3-70b-versatile': 12_000,
  'openai/gpt-oss-20b': 8000,
  'llama-3.1-8b-instant': 6000,
}
const UNKNOWN_MODEL_LIMIT = 6000

/** A first guess, until Groq says otherwise: about a token per three characters, a little high for English, about right for Arabic. */
export const startingBudget = (model: string): Budget => ({ limit: FREE_TIER_LIMIT[model] ?? UNKNOWN_MODEL_LIMIT, tokensPerChar: 1 / 3 })

/** Room kept free under the limit, for estimates that run short. */
const HEADROOM = 0.9
/** The most a batch's notes may take. */
const CONDENSE_MAX_TOKENS = 1024
/** Condensed notes that still don't fit are condensed again, this many times at most. */
const MOST_ROUNDS = 3

export interface Part {
  n: number
  of: number
}

export interface WritingDeps {
  /** One request to the writer, retried while Groq is busy. */
  send: (prompt: string, settings: { system: string; maxTokens: number }) => Promise<Written>
  /** What the key may send per minute; corrected in place when Groq says a request is too large. */
  budget: Budget
  /** Before each part when writing in parts. */
  onPart: (part: Part) => unknown
}

const tokensIn = (text: string, budget: Budget) => Math.ceil(text.length * budget.tokensPerChar)
const fits = (prompt: string, system: string, maxTokens: number, budget: Budget) =>
  tokensIn(system + prompt, budget) + maxTokens <= budget.limit * HEADROOM

/** Groq said a request was too large: take its limit, and what the request really cost, as the budget from now on. */
function learn(budget: Budget, tooLarge: TooLarge, sent: string, maxTokens: number) {
  budget.limit = tooLarge.limit
  // Groq counts the room left for the answer in what was requested; what remains is the prompt's real cost.
  const perChar = (tooLarge.requested - maxTokens) / sent.length
  if (perChar > 0) budget.tokensPerChar = Math.min(1, Math.max(budget.tokensPerChar, perChar))
}

export async function writeThread(messages: Message[], options: WriteOptions, lang: Lang, deps: WritingDeps): Promise<Written> {
  const blocks = messages.map((m, i) => messageBlock(m, i + 1, messages.length))
  const whole = promptFrom(blocks, options, lang)
  if (fits(whole, SYSTEM_PROMPT, WRITE_MAX_TOKENS, deps.budget)) {
    try {
      return await deps.send(whole, { system: SYSTEM_PROMPT, maxTokens: WRITE_MAX_TOKENS })
    } catch (e) {
      if (!(e instanceof WriteError && e.tooLarge)) throw e
      learn(deps.budget, e.tooLarge, SYSTEM_PROMPT + whole, WRITE_MAX_TOKENS)
    }
  }
  return isExact(options) ? exactInParts(blocks, options, lang, deps) : condensedInParts(blocks, options, lang, deps)
}

/** In parts, an answer gets at most half of what may be sent per minute, so each part's prompt has room too. */
const answerRoom = (budget: Budget) => Math.min(WRITE_MAX_TOKENS, Math.floor((budget.limit * HEADROOM) / 2))

async function exactInParts(blocks: string[], options: WriteOptions, lang: Lang, { send, budget, onPart }: WritingDeps): Promise<Written> {
  const maxTokens = answerRoom(budget)
  const room = budget.limit * HEADROOM - maxTokens - tokensIn(SYSTEM_PROMPT + promptFrom([], options, lang, { continuing: true }), budget)
  const batches = batchesOf(blocks, room, budget)
  const written: Written[] = []
  for (const [i, batch] of batches.entries()) {
    await onPart({ n: i + 1, of: batches.length })
    written.push(await send(promptFrom(batch, options, lang, { continuing: i > 0 }), { system: SYSTEM_PROMPT, maxTokens }))
  }
  return { text: written.map(w => w.text).join('\n\n'), cutOff: written.some(w => w.cutOff) }
}

async function condensedInParts(blocks: string[], options: WriteOptions, lang: Lang, { send, budget, onPart }: WritingDeps): Promise<Written> {
  let notes = blocks
  for (let round = 1; round <= MOST_ROUNDS; round++) {
    const room = budget.limit * HEADROOM - CONDENSE_MAX_TOKENS - tokensIn(CONDENSE_PROMPT + condensePrompt([], options), budget)
    const batches = batchesOf(notes, room, budget)
    const condensed: string[] = []
    for (const [i, batch] of batches.entries()) {
      await onPart({ n: i + 1, of: batches.length + 1 })
      condensed.push((await send(condensePrompt(batch, options), { system: CONDENSE_PROMPT, maxTokens: CONDENSE_MAX_TOKENS })).text)
    }
    notes = condensed
    const final = promptFrom(notes, options, lang, { condensed: true })
    const maxTokens = answerRoom(budget)
    if (fits(final, SYSTEM_PROMPT, maxTokens, budget)) {
      await onPart({ n: batches.length + 1, of: batches.length + 1 })
      return send(final, { system: SYSTEM_PROMPT, maxTokens })
    }
  }
  throw new WriteError('too-big')
}

/**
 * Consecutive blocks grouped so each group fits `room` tokens. A block too big on its own is cut
 * at spaces into pieces, each under its Message's label so the writer knows where it belongs.
 */
export function batchesOf(blocks: string[], room: number, budget: Budget): string[][] {
  const roomChars = Math.max(200, Math.floor(room / budget.tokensPerChar))
  const pieces = blocks.flatMap(block => {
    if (block.length <= roomChars) return [block]
    const newline = block.indexOf('\n')
    const label = newline > 0 ? block.slice(0, newline) : ''
    const body = newline > 0 ? block.slice(newline + 1) : block
    const step = roomChars - label.length - 20
    const out: string[] = []
    for (let at = 0; at < body.length;) {
      let end = Math.min(body.length, at + step)
      const space = body.lastIndexOf(' ', end)
      if (end < body.length && space > at) end = space
      out.push(`${label}${out.length ? ' (continued)' : ''}\n${body.slice(at, end).trim()}`)
      at = end
    }
    return out
  })
  const batches: string[][] = []
  let size = Infinity
  for (const piece of pieces) {
    if (size + piece.length > roomChars) {
      batches.push([])
      size = 0
    }
    batches.at(-1)!.push(piece)
    size += piece.length + 2
  }
  return batches
}
