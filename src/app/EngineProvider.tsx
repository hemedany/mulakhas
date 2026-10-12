import { useEffect, useState, type ReactNode } from 'react'
import { browserDeps, createEngine, type Engine } from '@/engine'
import { EngineContext } from './engine-hooks'

export function EngineProvider({ children }: { children: ReactNode }) {
  const [engine, setEngine] = useState<Engine | null>(null)
  const [failure, setFailure] = useState<Error | null>(null)

  useEffect(() => {
    createEngine(browserDeps()).then(setEngine, setFailure)
  }, [])

  if (failure) {
    // Storage can be unavailable (private mode on some browsers, blocked site data).
    return (
      <main className="mx-auto max-w-md p-6 text-sm">
        <p>Mulakhas could not open its storage on this device. Check that site data is allowed for this page and reload.</p>
        <p className="mt-2 opacity-60">{failure.message}</p>
      </main>
    )
  }
  if (!engine) return null
  return <EngineContext value={engine}>{children}</EngineContext>
}
