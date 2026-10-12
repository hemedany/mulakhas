// Converting what Groq can't take as it is: files over 25 MB, and formats Whisper rejects
// (.mov, .3gp, .aac, .amr...). The browser decodes the sound; Mulakhas turns it into mono 16 kHz
// WAV, which is what Whisper listens at anyway, in parts of about ten minutes.

/** Whisper listens at 16 kHz, so nothing it would hear is lost. */
export const SAMPLE_RATE = 16_000
/** Ten minutes of mono 16-bit 16 kHz WAV is about 19 MB, under Groq's 25 MB. */
export const PART_SECONDS = 600
/** Each part starts this much before the previous one ends, so a word cut at the edge is heard whole once. */
export const OVERLAP_SECONDS = 5
/** A last part shorter than this joins the one before it instead (eleven minutes is still about 21 MB). */
const SHORTEST_PART_SECONDS = 60

/** The sound of a file as mono 16 kHz samples. Rejects when the browser can't decode it. */
export type DecodeAudio = (audio: Blob) => Promise<Float32Array>

export interface Part {
  /** The samples sent to Whisper, [from, to). */
  from: number
  to: number
  /** The stretch of the whole recording (seconds) this part's Transcript speaks for: the overlaps are split down the middle. */
  keepFrom: number
  keepTo: number
}

/** Splits a recording of `samples` samples into the parts Whisper hears one by one. */
export function partsOf(samples: number): Part[] {
  const length = PART_SECONDS * SAMPLE_RATE
  const overlap = OVERLAP_SECONDS * SAMPLE_RATE
  let count = Math.max(1, Math.ceil(samples / length))
  if (count > 1 && samples - (count - 1) * length < SHORTEST_PART_SECONDS * SAMPLE_RATE) count--
  return Array.from({ length: count }, (_, k) => {
    const start = k * length
    const last = k === count - 1
    const end = last ? samples : start + length
    return {
      from: Math.max(0, start - overlap),
      to: end,
      keepFrom: k === 0 ? 0 : (start - overlap / 2) / SAMPLE_RATE,
      keepTo: last ? Infinity : (end - overlap / 2) / SAMPLE_RATE,
    }
  })
}

/** Mono 16-bit PCM WAV of samples [from, to). */
export function toWav(samples: Float32Array, from = 0, to = samples.length): Blob {
  const count = to - from
  const buffer = new ArrayBuffer(44 + count * 2)
  const header = new DataView(buffer)
  const ascii = (at: number, text: string) => { for (let i = 0; i < text.length; i++) header.setUint8(at + i, text.charCodeAt(i)) }
  ascii(0, 'RIFF')
  header.setUint32(4, 36 + count * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  header.setUint32(16, 16, true) // size of this chunk
  header.setUint16(20, 1, true) // PCM
  header.setUint16(22, 1, true) // mono
  header.setUint32(24, SAMPLE_RATE, true)
  header.setUint32(28, SAMPLE_RATE * 2, true) // bytes per second
  header.setUint16(32, 2, true) // bytes per sample
  header.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  header.setUint32(40, count * 2, true)
  const pcm = new Int16Array(buffer, 44, count)
  for (let i = 0; i < count; i++) {
    const s = Math.max(-1, Math.min(1, samples[from + i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

/** Lowers the sample rate to 16 kHz by averaging each new sample's share of the old ones, which also keeps out aliasing. */
export function downsample(samples: Float32Array, rate: number): Float32Array {
  const ratio = rate / SAMPLE_RATE
  const out = new Float32Array(Math.floor(samples.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio)
    const b = Math.min(samples.length, Math.max(a + 1, Math.floor((i + 1) * ratio)))
    let sum = 0
    for (let j = a; j < b; j++) sum += samples[j]
    out[i] = sum / (b - a)
  }
  return out
}

/** Decodes with the browser's own decoders (whatever it can play), mixed down to mono at 16 kHz. */
export async function decodeInBrowser(audio: Blob): Promise<Float32Array> {
  const data = await audio.arrayBuffer()
  // Decoding into a 16 kHz context makes the browser resample it; a browser that refuses so low a rate gets 48 kHz.
  let context: OfflineAudioContext
  try {
    context = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  } catch {
    context = new OfflineAudioContext(1, 1, 48_000)
  }
  const decoded = await context.decodeAudioData(data)
  const mono = new Float32Array(decoded.length)
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const channel = decoded.getChannelData(c)
    for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels
  }
  return decoded.sampleRate === SAMPLE_RATE ? mono : downsample(mono, decoded.sampleRate)
}
