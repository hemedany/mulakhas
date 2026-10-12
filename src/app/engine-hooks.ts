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
