// Follow-ups: questions the user asks about a Result after it is made. Groq answers from the
// Thread's Transcripts and the Result, with the last few Follow-ups for context; when that is too
// big for the key, from the Result alone, and failing that from its first page (see ADR-0006).
import type { Lang } from './langs'
import type { Message } from './thread'
import { LANGUAGE_NAME, WriteError, asText, messageBlock, type WriteFailure, type WriteSettings, type Written } from './writer'
import { sendFullestFitting, type WritingDeps } from './writing'

export interface FollowUp {
  id: string
  question: string
  state: 'asking' | 'answered' | 'failed'
  /** Markdown, once answered. */
  answer?: string
  /** The answer ran out of room, so its end is missing. */
  cutOff?: boolean
  failure?: WriteFailure
  /** While Groq has asked us to wait: when the next try happens. */
  retryAt?: number
}

/** A Follow-up as History keeps it. */
export interface SavedFollowUp {
  question: string
  answer: string
}

/** What a Follow-up is about: the Thread, the Result, the Follow-ups before it, and the question. */
export interface FollowUpContext {
  messages: Message[]
  result: string
  earlier: FollowUp[]
  question: string
  /** The interface language, which the answer is in unless the question asks otherwise. */
  lang: Lang
}

export const FOLLOW_UP_PROMPT = `You are Mulakhas. Earlier you wrote a Result from a thread of messages (voice notes, videos and text messages, often in Levantine Arabic). The user now asks a follow-up question about it. Answer from the messages themselves and the Result. Be direct and brief, and use a short list only when it helps.

HONESTY: never guess silently. Passages marked ⟦unclear: …⟧ were heard with low confidence, so say when your answer rests on one. If the messages don't say, say so.

Respond in clean Markdown, without a title.`

const SETTINGS: WriteSettings = { system: FOLLOW_UP_PROMPT, maxTokens: 2048, thinking: 'medium' }

/** Only the last few Follow-ups go along as context, so a long exchange doesn't outgrow the key. */
const MOST_EARLIER = 5
/** About a page: how much of the Result goes when even all of it is too big for the key. */
const RESULT_PAGE = 6000

function followUpPrompt({ messages, result, earlier, question, lang }: FollowUpContext, { withMessages, resultChars }: { withMessages: boolean; resultChars?: number }) {
  const thread = withMessages
    ? `THE MESSAGES, IN ORDER:\n\n${messages.map((m, i) => asText(messageBlock(m, i + 1, messages.length))).join('\n\n')}`
    : 'THE MESSAGES: too long to include again. Answer from the Result, and say so if it doesn\'t cover the question.'
  const shown = resultChars && result.length > resultChars ? `${result.slice(0, resultChars)}\n(… the Result goes on; only its start is included)` : result
  const answered = earlier.filter(f => f.state === 'answered').slice(-MOST_EARLIER)
  const before = answered.length ? `\n\nEARLIER FOLLOW-UPS:\n\n${answered.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}` : ''
  const language = `Answer in ${LANGUAGE_NAME[lang]}, unless the question is clearly in another language or asks for one.`
  return `${thread}\n\nTHE RESULT YOU WROTE:\n${shown}${before}\n\n${language}\n\nTHE FOLLOW-UP QUESTION:\n${question}`
}

export async function answerFollowUp(context: FollowUpContext, deps: Pick<WritingDeps, 'send' | 'budget'>): Promise<Written> {
  const written = await sendFullestFitting([
    followUpPrompt(context, { withMessages: true }),
    followUpPrompt(context, { withMessages: false }),
    followUpPrompt(context, { withMessages: false, resultChars: RESULT_PAGE }),
  ], SETTINGS, deps)
  if (!written.text) throw new WriteError('unknown')
  return written
}
