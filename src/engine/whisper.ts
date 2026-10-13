// Hearing: Groq Whisper turns one Voice note into a Transcript with per-segment confidence.
import { GROQ_API, ProviderError, retryAfterMs, type Fetch } from './providers'
import type { Transcript } from './transcript'

export type HearFailure = 'rejected' | 'busy' | 'unreachable' | 'unsupported' | 'undecodable' | 'too-long' | 'too-big' | 'unknown'

export class HearError extends ProviderError<HearFailure> {}

export const WHISPER_MODEL = 'whisper-large-v3'
/** Whisper reads at most 224 tokens of prompt; the end of what came before is what matters. */
const WHISPER_PROMPT_CHARS = 400
/** Groq's free tier takes files up to 25 MB; this leaves room for however it counts them. Bigger ones are converted. */
export const WHISPER_MAX_BYTES = 24_000_000

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

// Whisper's own test for a stretch with nothing said in it (its no-speech and log-probability
// thresholds). A recording made only of such stretches is silent; anywhere else they stay, marked unclear.
const soundsSilent = (s: VerboseSegment) => s.no_speech_prob > 0.6 && s.avg_logprob < -1
// What Whisper is known to write over silence (sign-offs from the subtitles it learned from): left out wherever it hears little speech.
const INVENTED = /thanks? for watching|amara\.org|اشتركوا في القناة|ترجمة نانسي قنقر|شكرا للمشاهدة/i
const isInvented = (s: VerboseSegment) => s.no_speech_prob > 0.3 && INVENTED.test(s.text)

export function toTranscript(body: { text?: string; language?: string; duration?: number; segments?: VerboseSegment[] }): Transcript {
  const heard = (body.segments ?? []).filter(s => !isInvented(s))
  const segments = (heard.every(soundsSilent) ? [] : heard).map(s => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
    confidence: Math.exp(Math.min(0, s.avg_logprob)),
    unclear: s.avg_logprob < UNCLEAR_LOGPROB || s.compression_ratio > UNCLEAR_COMPRESSION || (s.no_speech_prob > UNCLEAR_NO_SPEECH && s.text.trim() !== ''),
  }))
  return {
    // Whisper's own text unless it came in segments (some of which may have been left out above).
    text: (body.segments?.length ? segments.map(s => s.text).join(' ') : body.text ?? '').trim(),
    language: body.language ?? null,
    duration: body.duration ?? segments.at(-1)?.end ?? 0,
    segments,
    heardBy: 'whisper',
  }
}

// What Groq's Whisper takes as it is, by extension (October 2026).
const ACCEPTED_NAME = /\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm)$/i
// For files whose name doesn't say (some Share-ins): the extension Groq expects for their type.
const EXTENSION_OF_TYPE: Record<string, string> = {
  'audio/ogg': 'ogg', 'audio/opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav',
  'audio/x-wav': 'wav', 'audio/flac': 'flac', 'audio/webm': 'webm', 'video/mp4': 'mp4', 'video/webm': 'webm',
}

/** A file name without its extension. */
export const stemOf = (name: string) => name.replace(/\.[^.]*$/, '') || 'audio'

/**
 * The file as Groq will take it, or null when it has to be converted first. WhatsApp names voice
 * notes .opus (Ogg Opus); Groq takes the same audio as an .ogg file of type audio/ogg.
 */
export function asUpload(audio: Blob, name: string): File | null {
  if (/\.(opus|oga)$/i.test(name)) return new File([audio], name.replace(/\.(opus|oga)$/i, '.ogg'), { type: 'audio/ogg' })
  if (ACCEPTED_NAME.test(name)) return new File([audio], name, { type: audio.type })
  const extension = EXTENSION_OF_TYPE[audio.type.split(';')[0]]
  return extension ? new File([audio], `${stemOf(name)}.${extension}`, { type: audio.type }) : null
}

/**
 * Sends one upload, already in a form Groq takes, to Whisper. `language` (ISO 639-1) says what is
 * spoken when it is known; `prompt` is text that came just before, for continuity.
 */
export async function transcribe(fetch: Fetch, key: string, upload: File, { language, prompt }: { language?: string; prompt?: string } = {}): Promise<Transcript> {
  if (upload.size > WHISPER_MAX_BYTES) throw new HearError('too-big')
  const form = new FormData()
  form.append('file', upload)
  if (language) form.append('language', language)
  if (prompt) form.append('prompt', prompt.slice(-WHISPER_PROMPT_CHARS))
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
