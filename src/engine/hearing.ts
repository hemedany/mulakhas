// Hearing one Voice note or Video. It goes to Whisper as it is when Groq can take it; otherwise
// (too big, or a format Whisper rejects) the browser decodes it and Whisper hears it in parts,
// whose Transcripts are joined back into one. Parts already heard are kept, so a reload or a
// failure part-way carries on from the next part instead of sending everything again.
import { partsOf, secondsOf, toPcm, wavOf, type DecodeAudio, type Part } from './audio'
import type { Transcript } from './transcript'
import { HearError, WHISPER_MAX_BYTES, asUpload, stemOf } from './whisper'

/** A Voice note or Video heard in parts: how many there are, and the Transcripts of those heard so far. */
export interface PartsHeard {
  of: number
  heard: Transcript[]
}

/**
 * Starting to decode the same file this many times without finishing means the page closed while
 * decoding it, again and again: the phone can't manage a file that long.
 */
const MOST_DECODE_TRIES = 2

export interface HearingDeps {
  decode: DecodeAudio
  /** Sends one upload to Whisper, trying again while Groq is busy. */
  send: (upload: File) => Promise<Transcript>
  /** What was heard before a reload or a failure. */
  progress: PartsHeard | undefined
  /** Before each part: what is heard so far. */
  onProgress: (progress: PartsHeard) => unknown
  /** How many times decoding this file has started without finishing. */
  decodeTries: number
  onDecodeTries: (tries: number) => unknown
}

export async function hearFile(audio: Blob, name: string, deps: HearingDeps): Promise<Transcript> {
  const upload = audio.size <= WHISPER_MAX_BYTES ? asUpload(audio, name) : null
  if (upload) {
    try {
      return await deps.send(upload)
    } catch (e) {
      // A sound inside a familiar name that Groq can't read, or a file Groq finds too big after all: convert it.
      if (!(e instanceof HearError && (e.failure === 'unsupported' || e.failure === 'too-big'))) throw e
    }
  }

  const { pcm, parts } = await decodeIntoParts(audio, deps)
  const heard = deps.progress?.of === parts.length ? [...deps.progress.heard] : []
  for (const part of parts.slice(heard.length)) {
    if (parts.length > 1) await deps.onProgress({ of: parts.length, heard: [...heard] })
    const partName = parts.length > 1 ? `${stemOf(name)}-${heard.length + 1}.wav` : `${stemOf(name)}.wav`
    heard.push(await deps.send(new File([wavOf(pcm, part)], partName, { type: 'audio/wav' })))
  }
  return joined(heard, parts)
}

/** Decodes the file and keeps only what the parts need: where to cut, and the sound as 16-bit PCM. */
async function decodeIntoParts(audio: Blob, { decode, decodeTries, onDecodeTries }: HearingDeps) {
  if (decodeTries >= MOST_DECODE_TRIES) throw new HearError('too-long')
  await onDecodeTries(decodeTries + 1)
  let samples: Float32Array
  try {
    samples = await decode(audio)
  } catch {
    throw new HearError('undecodable')
  }
  await onDecodeTries(0)
  if (!samples.length) throw new HearError('undecodable')
  return { parts: partsOf(samples), pcm: toPcm(samples) }
}

/** One Transcript from the parts': each part's times moved to where it starts in the whole. */
function joined(heard: Transcript[], parts: Part[]): Transcript {
  return {
    text: heard.map(t => t.text).filter(Boolean).join(' '),
    language: heard.find(t => t.language)?.language ?? null,
    duration: secondsOf(parts.at(-1)!.to),
    heardBy: 'whisper',
    segments: heard.flatMap((t, i) => {
      const startsAt = secondsOf(parts[i].from)
      return t.segments.map(s => ({ ...s, start: s.start + startsAt, end: s.end + startsAt }))
    }),
  }
}
