import { describe, expect, it, vi } from 'vitest'
import { DictationError } from '@/engine'
import { finalText, liveSession, phraseSession, type Microphone, type SessionEvents, type SpeechEngine, type SpeechResultList } from './sessions'

function recorder() {
  const spoken: string[] = []
  const done: (string | undefined)[] = []
  const events: SessionEvents = { onSpoken: s => spoken.push(s), onWriting: () => {}, onDone: p => done.push(p) }
  return { spoken, done, events }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

/** A speech engine the test speaks through. */
class FakeEngine implements SpeechEngine {
  static made: FakeEngine[] = []
  lang = ''
  continuous = false
  interimResults = false
  onresult: SpeechEngine['onresult'] = null
  onerror: SpeechEngine['onerror'] = null
  onend: SpeechEngine['onend'] = null
  starts: string[] = []
  constructor() { FakeEngine.made.push(this) }
  start() { this.starts.push(this.lang) }
  stop() { this.onend?.() }
  abort() { this.onend?.() }
  /** Results so far in this engine session: [transcript, final?]. */
  says(...results: [string, boolean][]) {
    const list = Object.assign(results.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })), { length: results.length }) as unknown as SpeechResultList
    this.onresult?.({ results: list })
  }
}
const engine = () => FakeEngine.made.at(-1)!

describe('live dictation', () => {
  it('shows words as they are spoken, and keeps them across the restarts Chrome forces after a silence', () => {
    const { spoken, done, events } = recorder()
    const session = liveSession(FakeEngine, ['en-US'], events, () => {})

    engine().says(['make a', false])
    engine().says(['make a recipe', true])
    engine().onend!() // Chrome stops after a silence: it is started again
    engine().says(['with the steps', false])
    session.stop()

    expect(spoken).toEqual(['make a', 'make a recipe', 'make a recipe with the steps'])
    expect(engine().starts).toEqual(['en-US', 'en-US'])
    expect(done).toEqual([undefined])
  })

  it('doesn’t repeat words Chrome on Android sends again in each final result', () => {
    expect(finalText(['make', 'make a', 'make a recipe', 'with steps'])).toBe('make a recipe with steps')
  })

  it('tries Saudi Arabic when the engine doesn’t know Syrian Arabic', () => {
    const { events } = recorder()
    liveSession(FakeEngine, ['ar-SY', 'ar-SA'], events, () => {})

    engine().onerror!({ error: 'language-not-supported' })
    engine().onend!()

    expect(engine().starts).toEqual(['ar-SY', 'ar-SA'])
  })

  it('gives way to phrases when the engine refuses before anything is heard', () => {
    const { done, events } = recorder()
    const refused = vi.fn()
    liveSession(FakeEngine, ['en-US'], events, refused)

    engine().onerror!({ error: 'not-allowed' }) // an in-app browser, or Safari with Dictation off
    engine().onend!()

    expect(refused).toHaveBeenCalledOnce()
    expect(done).toEqual([])
  })

  it('stops showing words once cancelled', () => {
    const { spoken, done, events } = recorder()
    const session = liveSession(FakeEngine, ['en-US'], events, () => {})
    engine().says(['make a', false])

    session.cancel()

    expect(spoken).toEqual(['make a'])
    expect(done).toEqual([undefined])
  })
})

/**
 * A microphone playing `levels`, one per reading; each phrase taken down comes out as audio saying
 * "phrase N", so the fake Whisper can tell them apart.
 */
function fakeMicrophone(levels: number[], { denied = false } = {}) {
  let reading = 0
  let phrases = 0
  let closed = false
  const microphone: Microphone = {
    async open() {
      if (denied) throw new DOMException('Permission denied', 'NotAllowedError')
      return {
        level: () => levels[Math.min(reading, levels.length - 1)],
        startPhrase: () => {
          const n = ++phrases
          return async () => new Blob([`phrase ${n}`], { type: 'audio/webm' })
        },
        close: () => { closed = true },
      }
    },
  }
  let tick = () => {}
  let clock = 0
  const sleeps: number[] = []
  return {
    deps: {
      microphone,
      every: (_ms: number, onTick: () => void) => { tick = onTick; return () => { tick = () => {} } },
      now: () => clock,
      sleep: async (ms: number) => { sleeps.push(ms) },
    },
    /** Plays every reading, 100 ms apart. */
    async play() {
      for (; reading < levels.length; reading++, clock += 100) {
        tick()
        await flush()
      }
    },
    sleeps,
    closed: () => closed,
  }
}

const stretch = (level: number, ms: number) => Array<number>(ms / 100).fill(level)
const ROOM = stretch(0.002, 300)

describe('phrase dictation', () => {
  it('writes down each phrase after its pause, in order', async () => {
    const mic = fakeMicrophone([...ROOM, ...stretch(0.2, 1000), ...stretch(0.002, 900), ...stretch(0.2, 800), ...stretch(0.002, 900)])
    const { spoken, events } = recorder()
    phraseSession('en', async audio => ((await audio.text()) === 'phrase 1' ? 'make a recipe' : 'with the steps'), events, mic.deps)
    await flush()

    await mic.play()

    expect(spoken).toEqual(['make a recipe', 'make a recipe with the steps'])
  })

  it('waits out a busy Whisper and asks again', async () => {
    const mic = fakeMicrophone([...ROOM, ...stretch(0.2, 1000), ...stretch(0.002, 900)])
    const { spoken, events } = recorder()
    let calls = 0
    phraseSession('en', async () => {
      if (++calls === 1) throw new DictationError('busy', 5000)
      return 'make a recipe'
    }, events, mic.deps)
    await flush()

    await mic.play()

    expect(mic.sleeps).toEqual([5000])
    expect(spoken).toEqual(['make a recipe'])
  })

  it('stops listening, and says so, when phrases can’t be written down', async () => {
    const mic = fakeMicrophone([...ROOM, ...stretch(0.2, 1000), ...stretch(0.002, 900), ...stretch(0.2, 500)])
    const { done, events } = recorder()
    phraseSession('en', async () => { throw new DictationError('rejected') }, events, mic.deps)
    await flush()

    await mic.play()
    await flush()

    expect(done).toEqual(['failed'])
    expect(mic.closed()).toBe(true)
  })

  it('drops a phrase still being written down when cancelled after Stop', async () => {
    const mic = fakeMicrophone([...ROOM, ...stretch(0.2, 1000)])
    const { spoken, done, events } = recorder()
    let answer!: (text: string) => void
    const session = phraseSession('en', () => new Promise<string>(resolve => { answer = resolve }), events, mic.deps)
    await flush()
    await mic.play()

    session.stop() // the phrase under way goes to Whisper
    await flush()
    session.cancel()
    answer('make a recipe')
    await flush()
    await flush()

    expect(spoken).toEqual([])
    expect(done).toEqual([undefined])
  })

  it('keeps on Stop a phrase too quiet to count as speech, rather than losing it', async () => {
    const mic = fakeMicrophone([...ROOM, ...stretch(0.004, 1000)])
    const { spoken, events } = recorder()
    const session = phraseSession('en', async () => 'quietly said', events, mic.deps)
    await flush()
    await mic.play()

    session.stop()
    await flush()
    await flush()

    expect(spoken).toEqual(['quietly said'])
  })

  it('doesn’t take a cough for a phrase', async () => {
    const mic = fakeMicrophone([...ROOM, ...stretch(0.3, 100), ...stretch(0.002, 1500)])
    const write = vi.fn(async () => 'cough')
    const { events } = recorder()
    phraseSession('en', write, events, mic.deps)
    await flush()

    await mic.play()

    expect(write).not.toHaveBeenCalled()
  })

  it('says so when the microphone is denied', async () => {
    const mic = fakeMicrophone([], { denied: true })
    const { done, events } = recorder()

    phraseSession('en', async () => '', events, mic.deps)
    await flush()

    expect(done).toEqual(['denied'])
  })

  it('doesn’t send the silence after the last phrase on Stop', async () => {
    const mic = fakeMicrophone([...ROOM, ...stretch(0.2, 1000), ...stretch(0.002, 900), ...stretch(0.002, 2000)])
    const write = vi.fn(async () => 'make a recipe')
    const { events } = recorder()
    const session = phraseSession('en', write, events, mic.deps)
    await flush()
    await mic.play()

    session.stop()
    await flush()
    await flush()

    expect(write).toHaveBeenCalledOnce()
  })
})
