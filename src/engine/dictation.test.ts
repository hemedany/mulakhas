import { describe, expect, it } from 'vitest'
import { uploadedFile, verboseJson, voiceNote, whisperBy } from './fixtures'
import { PauseDetector, withSpoken } from './dictation'
import { toTranscript } from './whisper'
import { createEngine } from './index'
import { deviceWithKey, fakeNetwork, freshDevice, names } from './testing'

/** Loudness readings every 100 ms: `[level, how many ms]` stretches one after another. */
function readings(...stretches: [number, number][]) {
  const out: [number, number][] = []
  let at = 0
  for (const [level, ms] of stretches) for (let t = 0; t < ms; t += 100, at += 100) out.push([level, at])
  return out
}
const phraseEnds = (detector: PauseDetector, levels: [number, number][]) => levels.filter(([level, at]) => detector.hear(level, at)).map(([, at]) => at)

describe('finding the pauses between phrases', () => {
  it('ends a phrase after a pause, not after a breath', () => {
    const detector = new PauseDetector()
    const ends = phraseEnds(detector, readings([0.002, 1000], [0.2, 1500], [0.003, 300], [0.2, 1000], [0.003, 1500]))
    expect(ends).toEqual([4600]) // one phrase: the 300 ms breath didn't end it, the 800 ms pause did
  })

  it('hears no phrase in silence or in a steady noisy room', () => {
    expect(phraseEnds(new PauseDetector(), readings([0.001, 5000]))).toEqual([])
    const noisy = new PauseDetector()
    expect(phraseEnds(noisy, readings([0.03, 3000], [0.2, 1000], [0.03, 1000]))).toEqual([4800])
  })

  it('cuts someone who talks on without pausing, so words keep appearing', () => {
    expect(phraseEnds(new PauseDetector(), readings([0.2, 26_000])).length).toBe(1)
  })
})

describe('dictated text', () => {
  it('is added after what is already in the box', () => {
    expect(withSpoken('', '  بدي الوصفة  ')).toBe('بدي الوصفة')
    expect(withSpoken('Make a recipe', 'with  the  steps')).toBe('Make a recipe with the steps')
    expect(withSpoken('Make a recipe ', '')).toBe('Make a recipe ')
  })
})

describe('dictating with Whisper', () => {
  it('writes down a phrase in the interface language, and never adds a Message to the Thread', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'dictation.webm': verboseJson([{ text: ' بدي الوصفة كاملة', start: 0, end: 2 }]) }))
    const device = deviceWithKey(net)
    device.localStorage.setItem('m2.uiLang', 'ar')
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    const before = names(engine)

    const said = await engine.dictation.transcribe(new Blob([new Uint8Array(64)], { type: 'audio/webm;codecs=opus' }), 'ar', 'اعملي')

    expect(said).toBe('بدي الوصفة كاملة')
    const sent = net.requests.filter(r => uploadedFile(r.init)?.name === 'dictation.webm')[0].init!.body as FormData
    expect([sent.get('language'), sent.get('prompt')]).toEqual(['ar', 'اعملي'])
    expect(names(engine)).toEqual(before)
  })

  it('says a Groq key is needed when there is none', async () => {
    const engine = await createEngine(freshDevice())

    await expect(engine.dictation.transcribe(new Blob([new Uint8Array(8)], { type: 'audio/ogg' }), 'en')).rejects.toMatchObject({ failure: 'no-key' })
  })

  it('keeps Whisper’s text when it comes without segments', () => {
    expect(toTranscript({ text: ' with the steps', segments: [] }).text).toBe('with the steps')
  })
})
