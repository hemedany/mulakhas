import { describe, expect, it } from 'vitest'
import { downsample, toPcm, wavOf } from './audio'

describe('the WAV parts sent to Whisper', () => {
  it('are mono 16 kHz 16-bit PCM with a correct header, cut from the whole sound', async () => {
    const pcm = toPcm(new Float32Array([0, 1, -1, 0.5, -0.5, 2]))

    const wav = new DataView(await wavOf(pcm, { from: 1, to: 5 }).arrayBuffer())

    const ascii = (at: number) => String.fromCharCode(...[0, 1, 2, 3].map(i => wav.getUint8(at + i)))
    expect([ascii(0), ascii(8), ascii(12), ascii(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect([wav.getUint16(20, true), wav.getUint16(22, true), wav.getUint32(24, true), wav.getUint16(34, true)]).toEqual([1, 1, 16_000, 16])
    expect([wav.getUint32(4, true), wav.getUint32(40, true)]).toEqual([36 + 8, 8])
    expect([0, 1, 2, 3].map(i => wav.getInt16(44 + i * 2, true))).toEqual([32767, -32768, 16383, -16384])
  })

  it('come from sound lowered to 16 kHz by averaging, whatever rate the browser decoded at', () => {
    expect([...downsample(new Float32Array([0.3, 0.6, 0.9, -0.3, -0.6, -0.9]), 48_000)].map(v => +v.toFixed(3))).toEqual([0.6, -0.6])
  })
})
