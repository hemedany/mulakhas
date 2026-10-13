// Dictation: speaking a Request or Follow-up instead of typing it. It only ever fills those boxes;
// it never adds a Message to the Thread. Where the browser has no speech engine, the app records,
// finds the pauses, and Whisper writes down each phrase (see src/ui/dictation/useDictation.ts).
import type { KeysStore } from './keys'
import type { Lang } from './langs'
import { ProviderError, type Fetch } from './providers'
import { HearError, asUpload, transcribe, type HearFailure } from './whisper'

/** The speech engines' names for the interface languages (Arabic as spoken in Syria, like most users). */
export const SPEECH_LANG: Record<Lang, string> = { en: 'en-US', ar: 'ar-SY', fr: 'fr-FR', de: 'de-DE', tr: 'tr-TR', es: 'es-ES' }

export type DictationFailure = 'no-key' | HearFailure

export class DictationError extends ProviderError<DictationFailure> {}

/** Dictated words added to what was already in the box. */
export function withSpoken(before: string, spoken: string) {
  const said = spoken.replace(/\s+/g, ' ').trim()
  if (!said) return before
  const kept = before.replace(/\s+$/, '')
  return kept ? `${kept} ${said}` : said
}

/** Louder than this (as RMS, 0..1) can be speech, however quiet the room. */
const QUIETEST_SPEECH = 0.01
/** Noisier than this, the room is someone already talking; the room is taken to be this noisy at most. */
const NOISIEST_ROOM = 0.04
/** Speech is this many times louder than the room's own noise. */
const ABOVE_NOISE = 2.5
/** The first readings, before anyone speaks, tell how noisy the room is. */
const LISTENING_TO_ROOM_MS = 300
/** A pause this long ends a phrase. */
const PAUSE_MS = 800
/** A phrase longer than this is cut anyway, so words keep appearing while someone talks on. */
const LONGEST_PHRASE_MS = 25_000

/**
 * Finds where phrases end in a stream of loudness readings taken from the microphone. It learns
 * the room's noise first, and keeps learning while nobody speaks, so a fan or traffic isn't taken
 * for talking.
 */
export class PauseDetector {
  private started: number | null = null
  private roomReadings: number[] = []
  private noise = 0
  private phraseStart: number | null = null
  private quietSince: number | null = null

  /** Feeds one reading (RMS, 0..1) taken at `at` ms. True when a phrase has just ended. */
  hear(level: number, at: number): boolean {
    this.started ??= at
    if (at - this.started < LISTENING_TO_ROOM_MS) {
      this.roomReadings.push(level)
      this.noise = Math.min(NOISIEST_ROOM, this.roomReadings.reduce((a, b) => a + b, 0) / this.roomReadings.length)
      return false
    }
    const speaking = level >= Math.max(QUIETEST_SPEECH, this.noise * ABOVE_NOISE)
    if (!speaking && this.phraseStart === null) this.noise = Math.min(NOISIEST_ROOM, this.noise * 0.9 + level * 0.1)
    if (speaking) {
      this.phraseStart ??= at
      this.quietSince = null
      return at - this.phraseStart >= LONGEST_PHRASE_MS && this.end()
    }
    if (this.phraseStart === null) return false
    this.quietSince ??= at
    return at - this.quietSince >= PAUSE_MS && this.end()
  }

  /** Whether some speech has been heard since the last phrase ended. */
  get inPhrase() {
    return this.phraseStart !== null
  }

  private end() {
    this.phraseStart = null
    this.quietSince = null
    return true
  }
}

/** The engine's part in dictation: writing down one phrase with Whisper, in the interface language. */
export interface Dictation {
  /** What was said in `audio`. `before` is what was dictated just before it, for continuity. */
  transcribe(audio: Blob, lang: Lang, before?: string): Promise<string>
}

export function createDictation(fetch: Fetch, keys: KeysStore): Dictation {
  return {
    async transcribe(audio, lang, before) {
      const key = keys.get().groq
      if (!key) throw new DictationError('no-key')
      const upload = asUpload(audio, 'dictation')
      if (!upload) throw new DictationError('unsupported')
      try {
        return (await transcribe(fetch, key, upload, { language: lang, prompt: before })).text
      } catch (e) {
        throw e instanceof HearError ? new DictationError(e.failure, e.retryAfterMs) : e
      }
    },
  }
}
