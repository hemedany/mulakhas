// The Reliability report: clarity is measured from how confidently Whisper heard each passage,
// never graded by a model. Gemini doesn't measure how sure it is, so a Video it watched has no
// clarity, only the passages Gemini itself marked unsure. A silent recording has nothing to rate.
import type { Message } from './thread'
import { isSilent, type Transcript } from './transcript'

export interface ReliabilityRow {
  /** The Message's position in the Thread. */
  n: number
  name: string
  /** 0..100, the duration-weighted confidence of its segments; null for a Video Gemini watched. */
  clarity: number | null
  /** The Unclear passages, as heard. */
  unclear: string[]
}

export function clarity(transcript: Transcript): number | null {
  if (transcript.heardBy === 'gemini') return null
  const parts = transcript.segments.map(s => ({ weight: Math.max(0.01, s.end - s.start), confidence: s.confidence }))
  const total = parts.reduce((sum, p) => sum + p.weight, 0)
  if (!total) return 0
  return Math.round((parts.reduce((sum, p) => sum + p.weight * p.confidence, 0) / total) * 100)
}

export function reliabilityReport(messages: Message[]): ReliabilityRow[] {
  return messages.flatMap((m, i) =>
    m.kind !== 'text' && m.state === 'heard' && m.transcript && !isSilent(m.transcript)
      ? [{ n: i + 1, name: m.name, clarity: clarity(m.transcript), unclear: m.transcript.segments.filter(s => s.unclear).map(s => s.text) }]
      : [],
  )
}
