import { useEffect, useRef, useState } from 'react'
import { useEngine, useOwnKeys, usePrefs } from '@/app/engine-hooks'
import { withSpoken } from '@/engine'
import { SPEECH_LANGS, browserPhraseDeps, liveSession, phraseSession, speechEngine, type DictationProblem, type DictationSession } from './sessions'

export type DictationState = 'idle' | 'listening' | 'writing'
/** Live: words appear as they are spoken. Phrases: after each pause. */
export type DictationWay = 'live' | 'phrases'

/** Dictation into one box, as its controls see it. */
export interface DictationControl {
  state: DictationState
  /** Listening, or writing down what was said: the box isn't for typing, nor ready to send. */
  busy: boolean
  way: DictationWay
  problem: DictationProblem | null
  start(): void
  /** Stops listening and keeps what was said. */
  stop(): void
  /** Stops listening and puts the box back as it was. */
  cancel(): void
}

/**
 * Dictation into one text box: what is said is added after what the box already holds. It only
 * ever fills the box; it never adds a Message to the Thread.
 */
export function useDictation(value: string, onChange: (text: string) => void): DictationControl {
  const { dictation: service } = useEngine()
  const { uiLang } = usePrefs()
  const { groq } = useOwnKeys()
  const [state, setState] = useState<DictationState>('idle')
  const [way, setWay] = useState<DictationWay>(() => (speechEngine() ? 'live' : 'phrases'))
  const [problem, setProblem] = useState<DictationProblem | null>(null)
  const session = useRef<DictationSession | null>(null)
  const before = useRef('')
  // The onChange of the latest render, for words that arrive after a re-render.
  const latestOnChange = useRef(onChange)
  useEffect(() => { latestOnChange.current = onChange }, [onChange])
  useEffect(() => () => session.current?.cancel(), [])

  const start = () => {
    if (session.current) return
    setProblem(null)
    before.current = value
    const events = {
      onSpoken: (spoken: string) => latestOnChange.current(withSpoken(before.current, spoken)),
      onWriting: () => setState('writing'),
      onDone: (ended?: DictationProblem) => {
        session.current = null
        setState('idle')
        if (ended) setProblem(ended)
      },
    }
    const Engine = way === 'live' ? speechEngine() : null
    // For phrases straight away, the microphone is set up now, inside the tap, so iOS lets it be heard.
    const tapDeps = Engine ? null : browserPhraseDeps()
    // Phrases need Whisper, so a Groq key.
    const byPhrases = () => {
      setWay('phrases')
      if (!groq) return events.onDone('no-key')
      session.current = phraseSession(uiLang, service.transcribe, events, tapDeps ?? browserPhraseDeps())
    }
    setState('listening')
    if (Engine) {
      // An engine that won't take dictation here gives way to phrases.
      session.current = liveSession(Engine, SPEECH_LANGS[uiLang], events, () => { session.current = null; byPhrases() })
    } else byPhrases()
  }

  return {
    state,
    busy: state !== 'idle',
    way,
    problem,
    start,
    stop: () => session.current?.stop(),
    cancel: () => {
      session.current?.cancel()
      latestOnChange.current(before.current)
    },
  }
}
