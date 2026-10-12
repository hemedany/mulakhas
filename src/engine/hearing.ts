// Hearing one Voice note or Video. It goes to Whisper as it is when Groq can take it; otherwise
// (over 25 MB, or a format Whisper rejects) the browser decodes it and Whisper hears it in parts,
// whose Transcripts are stitched back into one.
import { SAMPLE_RATE, partsOf, toWav, type DecodeAudio, type Part } from './audio'
import { HearError, WHISPER_MAX_BYTES, asUpload, type Transcript } from './whisper'

export interface HearingDeps {
  decode: DecodeAudio
  /** Sends one upload to Whisper, trying again while Groq is busy. */
  send: (upload: File) => Promise<Transcript>
  /** Before each part of a recording heard in several: which part (from 1) of how many. */
  onPart: (part: number, of: number) => unknown
}

const stem = (name: string) => name.replace(/\.[^.]*$/, '') || 'audio'

export async function hearFile(audio: Blob, name: string, { decode, send, onPart }: HearingDeps): Promise<Transcript> {
  const upload = audio.size <= WHISPER_MAX_BYTES ? asUpload(audio, name) : null
  if (upload) {
    try {
      return await send(upload)
    } catch (e) {
      // A familiar name with a sound inside Groq can't read: convert it instead.
      if (!(e instanceof HearError && e.failure === 'unsupported')) throw e
    }
  }

  let samples: Float32Array
  try {
    samples = await decode(audio)
  } catch {
    throw new HearError('undecodable')
  }
  if (!samples.length) throw new HearError('undecodable')

  const parts = partsOf(samples.length)
  const heard: Transcript[] = []
  for (const [i, part] of parts.entries()) {
    if (parts.length > 1) await onPart(i + 1, parts.length)
    const partName = parts.length > 1 ? `${stem(name)}-${i + 1}.wav` : `${stem(name)}.wav`
    heard.push(await send(new File([toWav(samples, part.from, part.to)], partName, { type: 'audio/wav' })))
  }
  return stitch(heard, parts)
}

/**
 * One Transcript from the parts' Transcripts: times moved to where each part starts in the
 * recording, and each overlap heard once, from whichever part it lies nearer the middle of.
 */
export function stitch(heard: Transcript[], parts: Part[]): Transcript {
  const segments = heard.flatMap((transcript, i) => {
    const offset = parts[i].from / SAMPLE_RATE
    return transcript.segments
      .map(s => ({ ...s, start: s.start + offset, end: s.end + offset }))
      .filter(s => {
        const middle = (s.start + s.end) / 2
        return middle >= parts[i].keepFrom && middle < parts[i].keepTo
      })
  })
  return {
    text: segments.map(s => s.text).join(' '),
    language: heard.find(t => t.language)?.language ?? null,
    duration: parts.at(-1)!.to / SAMPLE_RATE,
    segments,
  }
}
