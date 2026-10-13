import { createContext, use, useSyncExternalStore } from 'react'
import type { Engine } from '@/engine'

export const EngineContext = createContext<Engine | null>(null)

export function useEngine(): Engine {
  const engine = use(EngineContext)
  if (!engine) throw new Error('useEngine must be used inside <EngineProvider>')
  return engine
}

export function usePrefs() {
  const { prefs } = useEngine()
  return useSyncExternalStore(prefs.subscribe, prefs.get)
}

export function useOwnKeys() {
  const { keys } = useEngine()
  return useSyncExternalStore(keys.subscribe, keys.get)
}

export function useThread() {
  const { thread } = useEngine()
  return useSyncExternalStore(thread.subscribe, thread.get)
}

const desktopQuery = typeof window !== 'undefined' ? window.matchMedia('(min-width: 64rem)') : null

/** Wide screens (Tailwind's lg): the Result sits in the Thread instead of rising as a sheet. */
export function useIsDesktop() {
  return useSyncExternalStore(
    onChange => { desktopQuery?.addEventListener('change', onChange); return () => desktopQuery?.removeEventListener('change', onChange) },
    () => desktopQuery?.matches ?? false,
  )
}
