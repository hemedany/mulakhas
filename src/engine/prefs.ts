import { isLang, pickLang, type Lang } from './langs'
import { observable, type Observable } from './observable'
import { KEYS } from './storage-keys'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export interface Prefs {
  uiLang: Lang
  theme: Theme
  /** Had Mulakhas v1 data on this device; used to show the makeover card instead of the tutorial. */
  wasV1User: boolean
}

export interface PrefsStore extends Observable<Prefs> {
  set(patch: Partial<Pick<Prefs, 'uiLang' | 'theme'>>): void
}

export function createPrefs(ls: Storage, browserLanguages: readonly string[]): PrefsStore {
  const storedLang = ls.getItem(KEYS.uiLang)
  const storedTheme = ls.getItem(KEYS.theme)
  const state = observable<Prefs>({
    uiLang: isLang(storedLang) ? storedLang : pickLang(browserLanguages),
    theme: isTheme(storedTheme) ? storedTheme : 'system',
    wasV1User: ls.getItem(KEYS.wasV1User) === '1',
  })

  return {
    get: state.get,
    subscribe: state.subscribe,
    set(patch) {
      if (patch.uiLang) ls.setItem(KEYS.uiLang, patch.uiLang)
      if (patch.theme) ls.setItem(KEYS.theme, patch.theme)
      state.publish({ ...state.get(), ...patch })
    },
  }
}
