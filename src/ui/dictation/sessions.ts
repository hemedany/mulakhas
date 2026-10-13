// The two ways the browser can take dictation. Live: the browser's own speech engine (Chrome,
// Edge, Safari, Samsung Internet) shows words as they are spoken. Phrases: elsewhere (Firefox,
// Brave, in-app browsers), the microphone is recorded, cut at each pause, and Whisper writes down
// each phrase. Either way only text comes out: dictation never adds a Message to the Thread.
import { DictationError, PauseDetector, withSpoken, type Lang } from '@/engine'

export type DictationProblem = 'denied' | 'no-mic' | 'no-key' | 'failed'

export interface DictationSession {
  /** Stops listening and keeps what was said. */
  stop(): void
  /** Stops listening and drops what was said. */
  cancel(): void
}

export interface SessionEvents {
  /** Everything said so far in this session. */
  onSpoken: (spoken: string) => void
  /** Listening has stopped, but phrases already recorded are still being written down. */
  onWriting: () => void
  /** Finished, with the problem that ended it, if any. */
  onDone: (problem?: DictationProblem) => void
}

// The Web Speech API as browsers expose it (often prefixed); only what Mulakhas uses.
interface SpeechResultList {
  length: number
  [i: number]: { isFinal: boolean; 0: { transcript: string } }
}
interface SpeechEngine {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: SpeechResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type SpeechEngineClass = new () => SpeechEngine

/** The browser's own speech engine, unless it is one known not to work (Brave blocks the service Chrome's engine uses). */
export function speechEngine(): SpeechEngineClass | null {
  if ('brave' in navigator) return null
  const w = window as unknown as { SpeechRecognition?: SpeechEngineClass; webkitSpeechRecognition?: SpeechEngineClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Errors meaning this browser's engine can't be used here at all: switch to phrases instead. */
const ENGINE_UNAVAILABLE = ['network', 'service-not-allowed', 'language-not-supported']

/**
 * Live dictation. Chrome ends a session after a silence even when asked to go on, so while the
 * person hasn't stopped it is started again, keeping what was already said.
 */
export function liveSession(Engine: SpeechEngineClass, lang: string, events: SessionEvents, unavailable: () => void): DictationSession {
  const engine = new Engine()
  engine.lang = lang
  engine.continuous = true
  engine.interimResults = true
  let earlier = '' // said in sessions the engine ended on its own
  let current = ''
  let ending: 'stop' | 'cancel' | null = null
  let problem: DictationProblem | undefined
  let switching = false

  engine.onresult = ({ results }) => {
    let final = ''
    let interim = ''
    for (let i = 0; i < results.length; i++) {
      if (results[i].isFinal) final += `${results[i][0].transcript} `
      else interim += results[i][0].transcript
    }
    current = final
    if (ending !== 'cancel') events.onSpoken(withSpoken(withSpoken(earlier, final), interim))
  }
  engine.onerror = ({ error }) => {
    if (error === 'not-allowed') problem = 'denied'
    else if (error === 'audio-capture') problem = 'no-mic'
    else if (ENGINE_UNAVAILABLE.includes(error) && !earlier && !current) switching = true
    else if (error !== 'no-speech' && error !== 'aborted') problem = 'failed'
  }
  engine.onend = () => {
    if (switching && !ending) return unavailable()
    if (!ending && !problem) {
      earlier = withSpoken(earlier, current)
      current = ''
      try {
        return engine.start()
      } catch {
        // Couldn't go on: finish with what was said.
      }
    }
    events.onDone(ending === 'cancel' ? undefined : problem)
  }
  engine.start()
  return {
    stop() { ending ??= 'stop'; engine.stop() },
    cancel() { ending = 'cancel'; engine.abort() },
  }
}

const READING_MS = 100

interface Microphone {
  /** Ends the phrase being recorded (written down if `keep`) and starts the next unless listening has ended. Resolves once it is handed over. */
  cut(keep: boolean): Promise<void>
  /** Whether speech has been heard since the last pause. */
  inPhrase(): boolean
  release(): void
}

/** Phrase-by-phrase dictation: the microphone recorded, cut at each pause, each phrase written down by Whisper in order. */
export function phraseSession(lang: Lang, transcribe: (audio: Blob, lang: Lang, before?: string) => Promise<string>, events: SessionEvents): DictationSession {
  let ending: 'stop' | 'cancel' | null = null
  let problem: DictationProblem | undefined
  let finished = false
  let spoken = ''
  let writing = Promise.resolve()

  const done = () => {
    if (finished) return
    finished = true
    events.onDone(ending === 'cancel' ? undefined : problem)
  }

  // A function, not a check made once: Cancel can come while a phrase is being written down.
  const cancelled = () => ending === 'cancel'
  const writeDown = (phrase: Blob) => {
    writing = writing.then(async () => {
      if (cancelled() || problem) return
      try {
        spoken = withSpoken(spoken, await transcribe(phrase, lang, spoken))
        if (!cancelled()) events.onSpoken(spoken)
      } catch (e) {
        problem = e instanceof DictationError && e.failure === 'no-key' ? 'no-key' : 'failed'
      }
    })
  }

  const ready: Promise<Microphone | null> = (async () => {
    let stream: MediaStream
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new DOMException('no recorder', 'NotSupportedError')
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      problem = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'no-mic' : 'failed'
      done()
      return null
    }
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const pauses = new PauseDetector()

    let recording: { recorder: MediaRecorder; chunks: Blob[] }
    const record = () => {
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      recorder.start()
      recording = { recorder, chunks }
    }
    const cut = (keep: boolean) => new Promise<void>(resolve => {
      const { recorder, chunks } = recording
      recorder.onstop = () => {
        if (keep && chunks.length) writeDown(new Blob(chunks, { type: recorder.mimeType || chunks[0].type }))
        resolve()
      }
      recorder.stop()
      if (!ending) record()
    })
    record()
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const s of samples) sum += s * s
      if (pauses.hear(Math.sqrt(sum / samples.length), performance.now())) void cut(true)
    }, READING_MS)
    return {
      cut,
      inPhrase: () => pauses.inPhrase,
      release() {
        clearInterval(timer)
        stream.getTracks().forEach(track => track.stop())
        void context.close()
      },
    }
  })()

  const end = async (how: 'stop' | 'cancel') => {
    if (ending) return
    ending = how
    if (how === 'stop') events.onWriting()
    const mic = await ready
    if (mic) {
      await mic.cut(how === 'stop' && mic.inPhrase())
      mic.release()
    }
    await writing
    done()
  }
  return { stop: () => void end('stop'), cancel: () => void end('cancel') }
}
