// Hearing: Groq Whisper turns one Voice note into a Transcript with per-segment confidence.
import { GROQ_API, type Fetch } from './providers'

export interface Segment {
  start: number
  end: number
  text: string
  /** 0..1, from the segment's average token log-probability. */
  confidence: number
  /** Heard with low confidence: flagged as an Unclear passage. */
  unclear: boolean
}

export interface Transcript {
  text: string
  /** As Whisper names it ("Arabic", "English"), or null if it did not say. */
  language: string | null
  /** Seconds of audio. */
  duration: number
  segments: Segment[]
}

export type HearFailure = 'rejected' | 'busy' | 'unreachable' | 'unsupported' | 'too-big' | 'unknown'

export class HearError extends Error {
  readonly failure: HearFailure
  readonly retryAfterMs: number | null
  constructor(failure: HearFailure, retryAfterMs: number | null = null) {
    super(failure)
    this.failure = failure
    this.retryAfterMs = retryAfterMs
  }
}

export const WHISPER_MODEL = 'whisper-large-v3'
/** Groq's free tier accepts files up to 25 MB. */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024

// Starting thresholds, from Whisper's own decoding heuristics (log-prob -1.0, compression 2.4,
// no-speech 0.6), made stricter for flagging: tune against real WhatsApp notes.
const UNCLEAR_LOGPROB = -0.6
const UNCLEAR_COMPRESSION = 2.4
const UNCLEAR_NO_SPEECH = 0.6

interface VerboseSegment {
  start: number
  end: number
  text: string
  avg_logprob: number
  compression_ratio: number
  no_speech_prob: number
}

export function toTranscript(body: { text?: string; language?: string; duration?: number; segments?: VerboseSegment[] }): Transcript {
  const segments = (body.segments ?? []).map(s => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
    confidence: Math.exp(Math.min(0, s.avg_logprob)),
    unclear: s.avg_logprob < UNCLEAR_LOGPROB || s.compression_ratio > UNCLEAR_COMPRESSION || (s.no_speech_prob > UNCLEAR_NO_SPEECH && s.text.trim() !== ''),
  }))
  return {
    text: (body.text ?? segments.map(s => s.text).join(' ')).trim(),
    language: body.language ?? null,
    duration: body.duration ?? segments.at(-1)?.end ?? 0,
    segments,
  }
}

/** WhatsApp names voice notes .opus (Ogg Opus); Groq accepts the same audio labelled .ogg. */
export function uploadName(name: string) {
  return name.replace(/\.(opus|oga)$/i, '.ogg')
}

function retryAfterMs(res: Response) {
  const s = Number(res.headers.get('retry-after'))
  return Number.isFinite(s) && s > 0 ? s * 1000 : null
}

export async function transcribe(fetch: Fetch, key: string, audio: Blob, name: string): Promise<Transcript> {
  if (audio.size > WHISPER_MAX_BYTES) throw new HearError('too-big')
  const form = new FormData()
  form.append('file', audio, uploadName(name))
  form.append('model', WHISPER_MODEL)
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  form.append('temperature', '0')

  let res: Response
  try {
    res = await fetch(`${GROQ_API}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form })
  } catch {
    throw new HearError('unreachable')
  }
  if (res.ok) return toTranscript(await res.json())
  if (res.status === 401 || res.status === 403) throw new HearError('rejected')
  if (res.status === 413) throw new HearError('too-big')
  if (res.status === 400 || res.status === 415 || res.status === 422) throw new HearError('unsupported')
  if (res.status === 429 || res.status >= 500) throw new HearError('busy', retryAfterMs(res))
  throw new HearError('unknown')
}
