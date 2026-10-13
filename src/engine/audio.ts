// Converting what Groq can't take as it is: files over its size limit, and formats Whisper rejects
// (.mov, .3gp, .aac...). The browser decodes the sound; Mulakhas turns it into mono 16 kHz 16-bit
// WAV, which is what Whisper listens at anyway, in parts of about ten minutes cut at a pause, so no
// word is split between two parts.

/** Whisper listens at 16 kHz, so nothing it would hear is lost. */
export const SAMPLE_RATE = 16_000
/** Ten minutes of mono 16-bit 16 kHz WAV is about 19 MB, under Groq's limit. */
const PART_SECONDS = 600
/** How far before each ten-minute mark to look for a pause to cut at. */
const SEARCH_SECONDS = 30
/** The stretch whose loudness is compared when looking for that pause (a tenth of a second). */
const WINDOW = SAMPLE_RATE / 10
/** A last part shorter than this joins the one before it instead (eleven minutes is still about 21 MB). */
const SHORTEST_PART_SECONDS = 60

/** The sound of a file as mono 16 kHz samples. Rejects when the browser can't decode it. */
export type DecodeAudio = (audio: Blob) => Promise<Float32Array>

/** One part of a sound, as samples [from, to) of the whole. */
export interface Part {
  from: number
  to: number
}

export const secondsOf = (samples: number) => samples / SAMPLE_RATE

/** Where to cut a sound into parts of about ten minutes: at the quietest moment in the half-minute before each mark. */
export function partsOf(samples: Float32Array): Part[] {
  const length = PART_SECONDS * SAMPLE_RATE
  let count = Math.max(1, Math.ceil(samples.length / length))
  if (count > 1 && samples.length - (count - 1) * length < SHORTEST_PART_SECONDS * SAMPLE_RATE) count--
  const edges = [0, ...Array.from({ length: count - 1 }, (_, k) => quietestBefore(samples, (k + 1) * length)), samples.length]
  return edges.slice(1).map((to, k) => ({ from: edges[k], to }))
}

function quietestBefore(samples: Float32Array, mark: number) {
  let cut = mark
  let quietest = Infinity
  for (let at = mark; at >= mark - SEARCH_SECONDS * SAMPLE_RATE; at -= WINDOW) {
    let energy = 0
    for (let i = at - WINDOW / 2; i < at + WINDOW / 2; i++) energy += samples[i] * samples[i]
    if (energy < quietest) {
      quietest = energy
      cut = at
    }
  }
  return cut
}

/** The whole sound as 16-bit PCM, in a Blob so the browser can keep it out of the page's memory. */
export function toPcm(samples: Float32Array): Blob {
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return new Blob([pcm.buffer])
}

/** One part of the PCM as a mono 16 kHz WAV file. */
export function wavOf(pcm: Blob, { from, to }: Part): Blob {
  const bytes = (to - from) * 2
  const header = new DataView(new ArrayBuffer(44))
  const ascii = (at: number, text: string) => { for (let i = 0; i < text.length; i++) header.setUint8(at + i, text.charCodeAt(i)) }
  ascii(0, 'RIFF')
  header.setUint32(4, 36 + bytes, true)
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
  header.setUint32(40, bytes, true)
  return new Blob([header.buffer, pcm.slice(from * 2, to * 2)], { type: 'audio/wav' })
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
  let mono = decoded.getChannelData(0)
  if (decoded.numberOfChannels > 1) {
    mono = new Float32Array(decoded.length)
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c)
      for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels
    }
  }
  return decoded.sampleRate === SAMPLE_RATE ? mono : downsample(mono, decoded.sampleRate)
}

/** Lets one decode run at a time: decoding two long Videos at once can use up a phone's memory. */
export function oneAtATime(decode: DecodeAudio): DecodeAudio {
  let queue: Promise<unknown> = Promise.resolve()
  return audio => {
    const run = queue.then(() => decode(audio))
    queue = run.catch(() => {})
    return run
  }
}
