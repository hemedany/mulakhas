// Follow-ups: questions the user asks about a Result after it is made. Groq answers from the
// Thread's Transcripts and the Result, with the earlier Follow-ups for context; when the Thread is
// too big for the key to send again, from the Result alone.
import type { Message } from './thread'
import { WriteError, asText, messageBlock, type WriteFailure, type WriteSettings } from './writer'
import { sendFullestFitting, type WritingDeps } from './writing'

export interface FollowUp {
  id: string
  question: string
  state: 'asking' | 'answered' | 'failed'
  /** Markdown, once answered. */
  answer?: string
  failure?: WriteFailure
  /** While Groq has asked us to wait: when the next try happens. */
  retryAt?: number
}

export const FOLLOW_UP_PROMPT = `You are Mulakhas. Earlier you wrote a Result from a thread of messages (voice notes, videos and text messages, often in Levantine Arabic). The user now asks a follow-up question about it. Answer from the messages themselves and the Result. Be direct and brief, and use a short list only when it helps.

HONESTY: never guess silently. Passages marked ⟦unclear: …⟧ were heard with low confidence, so say when your answer rests on one. If the messages don't say, say so.

Answer in the language of the question, in clean Markdown, without a title.`

const SETTINGS: WriteSettings = { system: FOLLOW_UP_PROMPT, maxTokens: 2048, thinking: 'medium' }

/** The question and what it is about: the Messages (or a note that they were left out), the Result, and the Follow-ups before it. */
function followUpPrompt(messages: Message[] | null, result: string, earlier: FollowUp[], question: string) {
  const thread = messages
    ? `THE MESSAGES, IN ORDER:\n\n${messages.map((m, i) => asText(messageBlock(m, i + 1, messages.length))).join('\n\n')}`
    : 'THE MESSAGES: too long to include again. Answer from the Result, and say so if it doesn\'t cover the question.'
  const answered = earlier.filter(f => f.state === 'answered')
  const before = answered.length ? `\n\nEARLIER FOLLOW-UPS:\n\n${answered.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}` : ''
  return `${thread}\n\nTHE RESULT YOU WROTE:\n${result}${before}\n\nTHE FOLLOW-UP QUESTION:\n${question}`
}

export async function answerFollowUp(messages: Message[], result: string, earlier: FollowUp[], question: string, deps: Pick<WritingDeps, 'send' | 'budget'>): Promise<string> {
  const written = await sendFullestFitting([followUpPrompt(messages, result, earlier, question), followUpPrompt(null, result, earlier, question)], SETTINGS, deps)
  if (!written.text) throw new WriteError('unknown')
  return written.text
}
