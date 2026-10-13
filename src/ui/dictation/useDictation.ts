import { useEffect, useRef, useState } from 'react'
import { useEngine, useOwnKeys, usePrefs } from '@/app/engine-hooks'
import { SPEECH_LANG, withSpoken } from '@/engine'
import { liveSession, phraseSession, speechEngine, type DictationProblem, type DictationSession } from './sessions'

export type DictationState = 'idle' | 'listening' | 'writing'
/** Live: words appear as they are spoken. Phrases: after each pause. */
export type DictationWay = 'live' | 'phrases'

export interface Dictation {
  state: DictationState
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
export function useDictation(value: string, onChange: (text: string) => void): Dictation {
  const { dictation } = useEngine()
  const { uiLang } = usePrefs()
  const { groq } = useOwnKeys()
  const [state, setState] = useState<DictationState>('idle')
  const [way, setWay] = useState<DictationWay>(() => (speechEngine() ? 'live' : 'phrases'))
  const [problem, setProblem] = useState<DictationProblem | null>(null)
  const session = useRef<DictationSession | null>(null)
  const before = useRef('')
  // The latest onChange, for words that arrive after a re-render.
  const write = useRef(onChange)
  useEffect(() => { write.current = onChange }, [onChange])
  useEffect(() => () => session.current?.cancel(), [])

  const start = () => {
    if (session.current) return
    setProblem(null)
    before.current = value
    const events = {
      onSpoken: (spoken: string) => write.current(withSpoken(before.current, spoken)),
      onWriting: () => setState('writing'),
      onDone: (ended?: DictationProblem) => {
        session.current = null
        setState('idle')
        if (ended) setProblem(ended)
      },
    }
    // Phrases need Whisper, so a Groq key.
    const byPhrases = () => {
      setWay('phrases')
      if (!groq) return events.onDone('no-key')
      session.current = phraseSession(uiLang, dictation.transcribe, events)
    }
    const Engine = way === 'live' ? speechEngine() : null
    setState('listening')
    if (Engine) {
      // An engine that turns out not to work here (no network service, a blocked browser) gives way to phrases.
      session.current = liveSession(Engine, SPEECH_LANG[uiLang], events, () => { session.current = null; byPhrases() })
    } else byPhrases()
  }

  return {
    state,
    way,
    problem,
    start,
    stop: () => session.current?.stop(),
    cancel: () => {
      session.current?.cancel()
      write.current(before.current)
    },
  }
}
