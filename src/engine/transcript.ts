// What Mulakhas heard in one Voice note or Video: from Whisper, or from Gemini watching a Video.

export interface Segment {
  start: number
  end: number
  text: string
  /** 0..1, from Whisper's average token log-probability. Gemini doesn't measure it (always 1). */
  confidence: number
  /** Heard with low confidence (Whisper) or marked unsure (Gemini): an Unclear passage. */
  unclear: boolean
}

export interface Transcript {
  text: string
  /** As the model names it ("Arabic", "English"), or null if it did not say. */
  language: string | null
  /** Seconds of sound. */
  duration: number
  segments: Segment[]
  /** Gemini watched it (a Video). Absent: Whisper heard it, and its clarity is measured. */
  watched?: true
  /** For a Video Gemini watched: what it shows, for someone who can't see it. */
  shown?: string
}

/** Nothing was said: no passages at all once Whisper's silence is left out. */
export const isSilent = (transcript: Transcript) => transcript.text.trim() === ''
