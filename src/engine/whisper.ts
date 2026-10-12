// Hearing: Groq Whisper turns one Voice note into a Transcript with per-segment confidence.
import { GROQ_API, retryAfterMs, type Fetch } from './providers'

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

export type HearFailure = 'rejected' | 'busy' | 'unreachable' | 'unsupported' | 'undecodable' | 'too-big' | 'unknown'

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

// What Groq's Whisper takes as it is, by extension (October 2026).
const ACCEPTED_NAME = /\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm)$/i
// For files whose name doesn't say (some Share-ins): the extension Groq expects for their type.
const EXTENSION_OF_TYPE: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav',
  'audio/x-wav': 'wav', 'audio/flac': 'flac', 'audio/webm': 'webm', 'video/mp4': 'mp4', 'video/webm': 'webm',
}

/**
 * The file as Groq will take it, or null when it has to be converted first. WhatsApp names voice
 * notes .opus (Ogg Opus); Groq takes the same audio as an .ogg file of type audio/ogg.
 */
export function asUpload(audio: Blob, name: string): File | null {
  if (/\.(opus|oga)$/i.test(name)) return new File([audio], name.replace(/\.(opus|oga)$/i, '.ogg'), { type: 'audio/ogg' })
  if (ACCEPTED_NAME.test(name)) return new File([audio], name, { type: audio.type })
  const extension = EXTENSION_OF_TYPE[audio.type.split(';')[0]]
  return extension ? new File([audio], `${name.replace(/\.[^.]*$/, '') || 'audio'}.${extension}`, { type: audio.type }) : null
}

/** Sends one upload, already in a form Groq takes, to Whisper. */
export async function transcribe(fetch: Fetch, key: string, upload: File): Promise<Transcript> {
  if (upload.size > WHISPER_MAX_BYTES) throw new HearError('too-big')
  const form = new FormData()
  form.append('file', upload)
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
