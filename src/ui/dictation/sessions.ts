// The two ways the browser can take dictation (ADR-0007). Live: the browser's own speech engine
// (Chrome, Edge, Safari, Samsung Internet) shows words as they are spoken. Phrases: elsewhere
// (Firefox, Brave, in-app browsers), or wherever that engine refuses, the microphone is listened
// to, cut at each pause, and Whisper writes down each phrase. Either way only text comes out:
// dictation never adds a Message to the Thread.
import { DictationError, PauseDetector, withSpoken, type Lang } from '@/engine'

export type DictationProblem = 'denied' | 'no-mic' | 'no-key' | 'failed'

export interface DictationSession {
  /** Stops listening and keeps what was said. */
  stop(): void
  /** Stops listening and drops what was said, even after Stop while phrases are still being written down. */
  cancel(): void
}

export interface SessionEvents {
  /** Everything said so far in this session. */
  onSpoken: (spoken: string) => void
  /** Listening has stopped, but phrases already heard are still being written down. */
  onWriting: () => void
  /** Finished, with the problem that ended it, if any. */
  onDone: (problem?: DictationProblem) => void
}

/**
 * The speech engines' names for the interface languages, best first. Arabic as spoken in Syria, like
 * most users; Safari only knows Saudi Arabic, so that comes next.
 */
export const SPEECH_LANGS: Record<Lang, string[]> = { en: ['en-US'], ar: ['ar-SY', 'ar-SA'], fr: ['fr-FR'], de: ['de-DE'], tr: ['tr-TR'], es: ['es-ES'] }

// The Web Speech API as browsers expose it (often prefixed); only what Mulakhas uses.
export interface SpeechResultList {
  length: number
  [i: number]: { isFinal: boolean; 0: { transcript: string } }
}
export interface SpeechEngine {
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
export type SpeechEngineClass = new () => SpeechEngine

/** The browser's own speech engine, unless it is one known not to work (Brave blocks the service Chrome's engine uses). */
export function speechEngine(): SpeechEngineClass | null {
  if ('brave' in navigator) return null
  const w = window as unknown as { SpeechRecognition?: SpeechEngineClass; webkitSpeechRecognition?: SpeechEngineClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Errors meaning the engine won't take dictation here, before anything was heard: phrases are tried
 * instead (they report a microphone that is really denied). In-app browsers and Safari with
 * Dictation turned off refuse this way.
 */
const ENGINE_REFUSED = ['network', 'service-not-allowed', 'not-allowed', 'audio-capture']

/**
 * What was said, from the engine's final results. Chrome on Android repeats each final result with
 * the ones before it ("make", "make a", "make a recipe"), so a result that carries on the previous
 * one replaces it rather than being added after it.
 */
export function finalText(finals: string[]) {
  const said: string[] = []
  for (const final of finals.map(f => f.trim()).filter(Boolean)) {
    if (said.length && final.startsWith(said[said.length - 1])) said[said.length - 1] = final
    else said.push(final)
  }
  return said.join(' ')
}

/**
 * Live dictation. Chrome ends a session after a silence even when asked to go on, so while the
 * person hasn't stopped it is started again, keeping what was already said.
 */
export function liveSession(Engine: SpeechEngineClass, langs: string[], events: SessionEvents, refused: () => void): DictationSession {
  const engine = new Engine()
  let lang = 0
  engine.lang = langs[lang]
  engine.continuous = true
  engine.interimResults = true
  let earlier = '' // said in sessions the engine ended on its own
  let current = ''
  let ending: 'stop' | 'cancel' | null = null
  let problem: DictationProblem | undefined
  let heard = false
  let restart: 'next-lang' | 'phrases' | null = null

  engine.onresult = ({ results }) => {
    const finals: string[] = []
    let interim = ''
    for (let i = 0; i < results.length; i++) {
      if (results[i].isFinal) finals.push(results[i][0].transcript)
      else interim += results[i][0].transcript
    }
    current = finalText(finals)
    heard ||= !!(current || interim.trim())
    if (ending !== 'cancel') events.onSpoken(withSpoken(withSpoken(earlier, current), interim))
  }
  engine.onerror = ({ error }) => {
    if (error === 'language-not-supported' && lang + 1 < langs.length) restart = 'next-lang'
    else if ((ENGINE_REFUSED.includes(error) || error === 'language-not-supported') && !heard) restart = 'phrases'
    else if (error === 'not-allowed') problem = 'denied'
    else if (error === 'audio-capture') problem = 'no-mic'
    else if (error !== 'no-speech' && error !== 'aborted') problem = 'failed'
  }
  engine.onend = () => {
    if (!ending && restart === 'phrases') return refused()
    if (!ending && restart === 'next-lang') engine.lang = langs[++lang]
    restart = null
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

/** An open microphone, as phrase dictation uses it. */
export interface OpenMicrophone {
  /** How loud it is now (RMS, 0..1). */
  level(): number
  /** Starts taking a phrase down; the function returned ends it and resolves with the audio. */
  startPhrase(): () => Promise<Blob>
  close(): void
}

/** What phrase dictation needs from the browser, so tests can play a microphone. */
export interface Microphone {
  /** Rejects as getUserMedia does when the microphone is denied or missing. */
  open(): Promise<OpenMicrophone>
}

/**
 * The browser's microphone. Its AudioContext is made right away, while the tap that started
 * dictation still counts as one: iOS keeps a context made later silent.
 */
export function browserMicrophone(): Microphone {
  const context = typeof AudioContext === 'undefined' ? null : new AudioContext()
  void context?.resume()
  return {
    async open() {
      if (!context || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new DOMException('no recorder', 'NotSupportedError')
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      } catch (e) {
        void context.close()
        throw e
      }
      const analyser = context.createAnalyser()
      analyser.fftSize = 2048
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      return {
        level() {
          analyser.getFloatTimeDomainData(samples)
          let sum = 0
          for (const s of samples) sum += s * s
          return Math.sqrt(sum / samples.length)
        },
        startPhrase() {
          const chunks: Blob[] = []
          const recorder = new MediaRecorder(stream)
          recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
          recorder.start()
          return () => new Promise<Blob>(resolve => {
            recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || '' }))
            recorder.stop()
          })
        },
        close() {
          stream.getTracks().forEach(track => track.stop())
          void context.close()
        },
      }
    },
  }
}

export interface PhraseDeps {
  microphone: Microphone
  /** Calls `tick` every `ms` until the returned function is called. */
  every: (ms: number, tick: () => void) => () => void
  now: () => number
  sleep: (ms: number) => Promise<void>
}

export const browserPhraseDeps = (): PhraseDeps => ({
  microphone: browserMicrophone(),
  every: (ms, tick) => { const id = setInterval(tick, ms); return () => clearInterval(id) },
  now: () => performance.now(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
})

const READING_MS = 100
/** On Stop, the phrase under way is kept if it is this long and something was heard in it, even too quiet to count as speech. */
const KEEP_ON_STOP_MS = 600
/** A busy Whisper is waited for and asked again, this many times at most. */
const MOST_TRIES = 3

type WritePhrase = (audio: Blob, lang: Lang, before?: string) => Promise<string>

/** Phrase-by-phrase dictation: the microphone cut at each pause, each phrase written down by Whisper, in order. */
export function phraseSession(lang: Lang, writePhrase: WritePhrase, events: SessionEvents, { microphone, every, now, sleep }: PhraseDeps): DictationSession {
  let ending: 'stop' | 'cancel' | null = null
  let problem: DictationProblem | undefined
  let finished = false
  let spoken = ''
  let writing = Promise.resolve()
  // A function, not a check made once: Cancel can come while a phrase is being written down.
  const cancelled = () => ending === 'cancel'

  const done = () => {
    if (finished) return
    finished = true
    events.onDone(cancelled() ? undefined : problem)
  }

  const writeDown = (phrase: Blob) => {
    writing = writing.then(async () => {
      for (let attempt = 1; !cancelled() && !problem; attempt++) {
        try {
          spoken = withSpoken(spoken, await writePhrase(phrase, lang, spoken))
          if (!cancelled()) events.onSpoken(spoken)
          return
        } catch (e) {
          const failure = e instanceof DictationError ? e.failure : 'unknown'
          if (failure === 'busy' && attempt < MOST_TRIES) {
            await sleep((e as DictationError).retryAfterMs ?? 2000 * attempt)
            continue
          }
          // Phrases that can't be written down end the session, rather than listening on for nothing.
          problem = failure === 'no-key' ? 'no-key' : 'failed'
          void end('stop')
        }
      }
    })
  }

  let mic: OpenMicrophone | null = null
  let stopTicking = () => {}
  let endPhrase: (() => Promise<Blob>) | null = null
  let phraseStarted = 0
  const pauses = new PauseDetector()

  /** Ends the phrase under way (written down if `keep`) and starts the next unless listening has ended. */
  const cut = async (keep: boolean) => {
    const ended = endPhrase
    if (!ended || !mic) return
    endPhrase = ending ? null : mic.startPhrase()
    phraseStarted = now()
    const phrase = await ended()
    if (keep && phrase.size) writeDown(phrase)
  }

  const ready = (async () => {
    try {
      mic = await microphone.open()
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      problem = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'no-mic' : 'failed'
      return done()
    }
    if (ending) return
    endPhrase = mic.startPhrase()
    phraseStarted = now()
    stopTicking = every(READING_MS, () => { if (pauses.hear(mic!.level(), now())) void cut(true) })
  })()

  async function end(how: 'stop' | 'cancel') {
    if (ending === 'cancel' || (ending && how === 'stop')) return
    const stopping = !ending
    ending = how
    if (!stopping) return // Cancel after Stop: the stop under way finishes, writing nothing more
    if (how === 'stop') events.onWriting()
    await ready
    stopTicking()
    await cut(how === 'stop' && (pauses.inPhrase || (pauses.heardSomething && now() - phraseStarted >= KEEP_ON_STOP_MS)))
    mic?.close()
    await writing
    done()
  }
  return { stop: () => void end('stop'), cancel: () => void end('cancel') }
}
