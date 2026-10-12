import { useEffect, useSyncExternalStore } from 'react'
import { RTL_LANGS, type Theme } from '@/engine'
import { usePrefs } from './engine-hooks'

const dark = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function subscribeToSystemTheme(onChange: () => void) {
  dark?.addEventListener('change', onChange)
  return () => dark?.removeEventListener('change', onChange)
}

function useResolvedTheme(theme: Theme): 'light' | 'dark' {
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, () => dark?.matches ?? false)
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
}

/** Keeps <html> lang, dir and theme, and the browser chrome colour, in step with preferences. */
export function DocumentSync() {
  const { uiLang, theme } = usePrefs()
  const resolved = useResolvedTheme(theme)

  useEffect(() => {
    const html = document.documentElement
    html.lang = uiLang
    html.dir = RTL_LANGS.has(uiLang) ? 'rtl' : 'ltr'
  }, [uiLang])

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    const surface = getComputedStyle(document.body).backgroundColor
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
  }, [resolved])

  return null
}
