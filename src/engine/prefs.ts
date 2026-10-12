import { isLang, pickLang, type Lang } from './langs'

export type Theme = 'system' | 'light' | 'dark'

export interface Prefs {
  uiLang: Lang
  theme: Theme
  /** Had Mulakhas v1 data on this device; used to show the makeover card instead of the tutorial. */
  wasV1User: boolean
}

export interface PrefsStore {
  get(): Prefs
  set(patch: Partial<Pick<Prefs, 'uiLang' | 'theme'>>): void
  subscribe(listener: (prefs: Prefs) => void): () => void
}

// v1 already used `uiLang` and `theme` with the same meaning, so the keys are shared.
const K = { uiLang: 'uiLang', theme: 'theme', wasV1: 'm2.wasV1User' } as const

function isTheme(v: unknown): v is Theme {
  return v === 'system' || v === 'light' || v === 'dark'
}

export function createPrefs(ls: Storage, browserLanguages: readonly string[]): PrefsStore {
  const storedLang = ls.getItem(K.uiLang)
  const storedTheme = ls.getItem(K.theme)
  let prefs: Prefs = {
    uiLang: isLang(storedLang) ? storedLang : pickLang(browserLanguages),
    theme: isTheme(storedTheme) ? storedTheme : 'system',
    wasV1User: ls.getItem(K.wasV1) === '1',
  }
  const listeners = new Set<(p: Prefs) => void>()

  return {
    get: () => prefs,
    set(patch) {
      prefs = { ...prefs, ...patch }
      if (patch.uiLang) ls.setItem(K.uiLang, patch.uiLang)
      if (patch.theme) ls.setItem(K.theme, patch.theme)
      for (const l of listeners) l(prefs)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
