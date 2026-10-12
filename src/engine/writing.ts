// Writing the Result. The whole Thread is tried in one go first: a paid key may take it all, and a
// free one says, when it refuses, its real limit and what the prompt cost. Too big for the key, it
// is written in parts: a Summary condenses groups of Messages into notes (their numbers kept by
// Mulakhas, not left to the model) and is written from the notes; Exact words, which must not be
// shortened, writes each group word for word and joins them in order. See ADR-0006.
import type { Lang } from './langs'
import type { Message } from './thread'
import {
  CONDENSE_PROMPT, SYSTEM_PROMPT, WRITE_MAX_TOKENS, WRITE_RESULT, WriteError, condensePrompt, isExact, messageBlock, numberOf, promptFrom,
  type Block, type TooLarge, type WriteOptions, type WriteSettings, type Written,
} from './writer'

/** What a key may send one writer in a minute, as far as Mulakhas knows. */
export interface Budget {
  /** Tokens per minute. */
  limit: number
  /** Tokens per character of prompt, for estimating before sending. */
  tokensPerChar: number
}

// Groq's free-tier tokens per minute for the writers Mulakhas prefers (October 2026). Whatever
// Groq says when it refuses a request as too large replaces these.
const FREE_TIER_LIMIT: Record<string, number> = {
  'openai/gpt-oss-120b': 8000,
  'llama-3.3-70b-versatile': 12_000,
  'openai/gpt-oss-20b': 8000,
  'llama-3.1-8b-instant': 6000,
}
const UNKNOWN_MODEL_LIMIT = 6000

/** A first guess, until Groq says otherwise: about a token per three characters, a little high for English, about right for Arabic. */
export const startingBudget = (model: string): Budget => ({ limit: FREE_TIER_LIMIT[model] ?? UNKNOWN_MODEL_LIMIT, tokensPerChar: 1 / 3 })

/** The share of the limit planned for; the rest covers estimates that run short. */
const USABLE_SHARE = 0.9
/** Beyond any writer's context window: not worth trying in one go. */
const TOO_BIG_TO_TRY = 100_000
/** Notes that still don't fit are condensed again, this many times at most. */
const MOST_ROUNDS = 3
/** A part Groq still refuses as too large means planning the parts again, this many times at most. */
const MOST_PLANS = 3

/** Which part of a Result written in parts is being written. */
export interface WritingPart {
  n: number
  of: number
}

export interface WritingDeps {
  /** One request to the writer, retried while Groq is busy. */
  send: (prompt: string, settings: WriteSettings) => Promise<Written>
  /** What the key may send per minute; corrected in place when Groq says a request is too large. */
  budget: Budget
  /** Before each part when writing in parts. */
  onPart: (part: WritingPart) => unknown
  /** Parts already written for this Thread (by prompt), so Try again doesn't write them again. */
  written: Map<string, Written>
}

const tokensIn = (text: string, budget: Budget) => Math.ceil(text.length * budget.tokensPerChar)
/** Tokens a prompt may take under a system prompt, with `writeRoom` tokens left for what is written back. */
const roomFor = (budget: Budget, system: string, writeRoom: number) => budget.limit * USABLE_SHARE - tokensIn(system, budget) - writeRoom
const fits = (prompt: string, settings: WriteSettings, budget: Budget) => tokensIn(prompt, budget) <= roomFor(budget, settings.system, settings.maxTokens)
const tooLargeIn = (e: unknown): TooLarge | null => (e instanceof WriteError ? e.tooLarge : null)

/** Groq refused a request as too large: its limit, and what the request really cost, are the budget from now on. */
function learn(budget: Budget, tooLarge: TooLarge, sent: string, maxTokens: number) {
  budget.limit = tooLarge.limit
  // Groq counts the room left for writing in what was requested; what remains is the prompt's real cost.
  const perChar = (tooLarge.requested - maxTokens) / sent.length
  if (perChar > 0) budget.tokensPerChar = Math.min(1, perChar)
}

export async function writeThread(messages: Message[], options: WriteOptions, lang: Lang, deps: WritingDeps): Promise<Written> {
  const { budget } = deps
  // Every request learns from a refusal; a part written before is not written again.
  const send = async (prompt: string, settings: WriteSettings) => {
    const key = `${settings.system}\n${settings.maxTokens}\n${prompt}`
    const earlier = deps.written.get(key)
    if (earlier) return earlier
    try {
      const written = await deps.send(prompt, settings)
      deps.written.set(key, written)
      return written
    } catch (e) {
      const tooLarge = tooLargeIn(e)
      if (tooLarge) learn(budget, tooLarge, settings.system + prompt, settings.maxTokens)
      throw e
    }
  }

  const blocks = messages.map((m, i) => messageBlock(m, i + 1, messages.length))
  const whole = promptFrom(blocks, options, lang)
  if (tokensIn(whole, budget) < TOO_BIG_TO_TRY) {
    try {
      return await send(whole, WRITE_RESULT)
    } catch (e) {
      if (!tooLargeIn(e)) throw e
    }
  }
  for (let plan = 1; ; plan++) {
    try {
      const parts = new PartCounter(deps.onPart)
      return isExact(options)
        ? await exactInParts(blocks, options, lang, budget, send, parts)
        : await condensedInParts(blocks, options, lang, budget, send, parts)
    } catch (e) {
      if (!tooLargeIn(e) || plan >= MOST_PLANS) throw e
    }
  }
}

/** Numbers the parts as they are written; when notes are condensed again, the count grows rather than starting over. */
class PartCounter {
  private done = 0
  private readonly onPart: WritingDeps['onPart']
  constructor(onPart: WritingDeps['onPart']) {
    this.onPart = onPart
  }
  /** Before writing a part, with `stillToCome` parts after this one, as far as is known. */
  async next(stillToCome: number) {
    this.done++
    await this.onPart({ n: this.done, of: this.done + stillToCome })
  }
}

type Send = (prompt: string, settings: WriteSettings) => Promise<Written>

async function exactInParts(blocks: Block[], options: WriteOptions, lang: Lang, budget: Budget, send: Send, parts: PartCounter): Promise<Written> {
  // Exact words comes back about as long as it goes in, plus labels and a little thinking.
  const room = roomFor(budget, SYSTEM_PROMPT + promptFrom([], options, lang, { continuing: true }), 0)
  const groups = groupsOf(blocks, room * 0.45, budget)
  const settings: WriteSettings = { system: SYSTEM_PROMPT, maxTokens: Math.floor(room * 0.55), thinking: 'low' }
  let text = ''
  let cutOff = false
  for (const [i, group] of groups.entries()) {
    await parts.next(groups.length - i - 1)
    const written = await send(promptFrom(group, options, lang, { continuing: i > 0 }), settings)
    text = i === 0 ? written.text : `${text}\n\n${carryingOn(written.text, text)}`
    cutOff ||= written.cutOff
  }
  return { text, cutOff }
}

/**
 * A later part of Exact words, joined to what came before: without a title of its own, and without
 * repeating the heading of a Message that was cut between the two parts.
 */
function carryingOn(part: string, before: string) {
  const lines = part.split('\n')
  while (lines.length && (/^#\s/.test(lines[0]) || !lines[0].trim())) lines.shift()
  const lastHeading = before.split('\n').filter(l => l.startsWith('### ')).at(-1)
  if (lastHeading && lines[0]?.trim() === lastHeading.trim()) lines.shift()
  return lines.join('\n').trim()
}

async function condensedInParts(blocks: Block[], options: WriteOptions, lang: Lang, budget: Budget, send: Send, parts: PartCounter): Promise<Written> {
  const result: WriteSettings = { ...WRITE_RESULT, maxTokens: Math.min(WRITE_MAX_TOKENS, Math.floor((budget.limit * USABLE_SHARE) / 2)) }
  let notes = blocks
  for (let round = 1; round <= MOST_ROUNDS; round++) {
    // Notes come back shorter than what goes in.
    const room = roomFor(budget, CONDENSE_PROMPT + condensePrompt([], options), 0)
    const settings: WriteSettings = { system: CONDENSE_PROMPT, maxTokens: Math.floor(room * 0.45), thinking: 'low' }
    const groups = groupsOf(notes, room * 0.55, budget)
    const condensed: Block[] = []
    for (const [i, group] of groups.entries()) {
      await parts.next(groups.length - i) // the rest of this round, then the Result
      condensed.push(...notesFor(group, (await send(condensePrompt(group, options), settings)).text))
    }
    notes = condensed
    const final = promptFrom(notes, options, lang, { condensed: true })
    if (fits(final, result, budget)) {
      await parts.next(0)
      return send(final, result)
    }
  }
  throw new WriteError('too-big')
}

/**
 * The notes for each Message of a group, under its own label (so its number survives whatever the
 * model writes). A Message the notes leave out keeps its own text, so nothing is lost.
 */
function notesFor(group: Block[], answer: string): Block[] {
  const found = new Map<number, string>()
  try {
    const json = JSON.parse(answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1))
    for (const entry of json.notes ?? []) {
      const n = Number(entry.message)
      if (Number.isFinite(n) && typeof entry.notes === 'string' && entry.notes.trim()) found.set(n, [found.get(n), entry.notes.trim()].filter(Boolean).join('\n'))
    }
  } catch {
    // Not the JSON asked for: every Message in the group keeps its own text.
  }
  const given = new Set<number>()
  return group.flatMap(block => {
    const n = numberOf(block)
    const notes = found.get(n)
    if (notes === undefined) return [block]
    if (given.has(n)) return [] // the pieces of a Message cut in two share one set of notes
    given.add(n)
    return [{ label: block.label.replace(/ =====( \(continued\))?$/, ' (condensed notes) ====='), body: notes }]
  })
}

/**
 * Consecutive blocks grouped so each group fits `room` tokens. A block too big on its own is cut
 * at spaces into pieces, each under its Message's label so the writer knows where it belongs.
 */
function groupsOf(blocks: Block[], room: number, budget: Budget): Block[][] {
  const roomChars = Math.max(200, Math.floor(room / budget.tokensPerChar))
  const sizeOf = (block: Block) => block.label.length + block.body.length + 3
  const pieces = blocks.flatMap(block => {
    if (sizeOf(block) <= roomChars) return [block]
    const step = Math.max(100, roomChars - block.label.length - 20)
    const out: Block[] = []
    for (let at = 0; at < block.body.length;) {
      let end = Math.min(block.body.length, at + step)
      const space = block.body.lastIndexOf(' ', end)
      if (end < block.body.length && space > at) end = space
      out.push({ label: out.length ? `${block.label} (continued)` : block.label, body: block.body.slice(at, end).trim() })
      at = end
    }
    return out
  })
  const groups: Block[][] = []
  let size = Infinity
  for (const piece of pieces) {
    if (size + sizeOf(piece) > roomChars) {
      groups.push([])
      size = 0
    }
    groups.at(-1)!.push(piece)
    size += sizeOf(piece)
  }
  return groups
}

/**
 * Sends the fullest of `prompts` (fullest first) that the key takes: one estimated not to fit is
 * skipped, one Groq refuses as too large teaches the budget and gives way to the next.
 */
export async function sendFullestFitting(prompts: string[], settings: WriteSettings, { send, budget }: Pick<WritingDeps, 'send' | 'budget'>): Promise<Written> {
  for (const [i, prompt] of prompts.entries()) {
    const last = i === prompts.length - 1
    if (!last && !fits(prompt, settings, budget)) continue
    try {
      return await send(prompt, settings)
    } catch (e) {
      const tooLarge = tooLargeIn(e)
      if (!tooLarge || last) throw e
      learn(budget, tooLarge, settings.system + prompt, settings.maxTokens)
    }
  }
  throw new WriteError('too-big')
}
