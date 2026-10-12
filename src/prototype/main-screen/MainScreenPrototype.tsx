// PROTOTYPE (ticket 02, issue #3): three variants of the main screen on the app's own page,
// switchable via ?variant=A|B|C (plus ?accent and ?state). Dev builds only. The winner is
// rebuilt properly in later tickets; this folder moves to a throwaway branch.
import { useEffect, useState } from 'react'
import { useEngine, usePrefs } from '@/app/engine-hooks'
import type { Theme } from '@/engine'
import { PrototypeSwitcher } from '../PrototypeSwitcher'
import { COPY, sampleThread } from './sample'
import type { ScreenState } from './types'
import VariantDesk, { name as deskName } from './VariantDesk'
import VariantIntent, { name as intentName } from './VariantIntent'
import VariantThread, { name as threadName } from './VariantThread'

const VARIANTS = [
  { key: 'A', name: threadName, Component: VariantThread },
  { key: 'B', name: deskName, Component: VariantDesk },
  { key: 'C', name: intentName, Component: VariantIntent },
]

function useParam<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const read = () => (new URLSearchParams(location.search).get(key) as T | null) ?? fallback
  const [value, setValue] = useState<T>(read)
  const set = (v: T) => {
    const p = new URLSearchParams(location.search)
    p.set(key, v)
    history.replaceState(null, '', `?${p}`)
    setValue(v)
  }
  return [value, set]
}

export function MainScreenPrototype() {
  const { prefs } = useEngine()
  const { uiLang, theme } = usePrefs()
  const [variant, setVariant] = useParam<string>('variant', 'A')
  const [accent, setAccent] = useParam<'teal' | 'lapis'>('accent', 'teal')
  const [state, setState] = useParam<ScreenState>('state', 'ready')
  const lang = uiLang === 'ar' ? 'ar' : 'en'

  useEffect(() => { document.documentElement.dataset.accent = accent }, [accent])

  const { Component } = VARIANTS.find(v => v.key === variant) ?? VARIANTS[0]
  const resolvedTheme: Theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme

  return (
    <div className="flex h-dvh flex-col">
      <div className="min-h-0 flex-1">
        <Component
          key={`${variant}-${state}`}
          copy={COPY[lang]}
          thread={sampleThread(lang)}
          state={state}
          onSummarize={() => setState('result')}
          onReset={() => setState('ready')}
        />
      </div>
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        onChange={setVariant}
        toggles={[
          { label: 'State', value: state, onChange: setState, options: [{ value: 'empty', label: 'Empty' }, { value: 'ready', label: 'Ready' }, { value: 'result', label: 'Result' }] },
          { label: 'Accent', value: accent, onChange: setAccent, options: [{ value: 'teal', label: 'Teal' }, { value: 'lapis', label: 'Lapis' }] },
          { label: 'Language', value: lang, onChange: (l: 'en' | 'ar') => prefs.set({ uiLang: l }), options: [{ value: 'en', label: 'EN' }, { value: 'ar', label: 'عربي' }] },
          { label: 'Theme', value: resolvedTheme, onChange: (t: Theme) => prefs.set({ theme: t }), options: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] },
        ]}
      />
    </div>
  )
}
