import { useEffect, useState } from 'react'

/** Longer than any arrival (--duration-ui), so it has played before the item counts as settled. */
const SETTLE_MS = 400

/**
 * Which items arrived after the list first showed, so they rise into place (the `arrives` class).
 * Only for a moment: once settled, an item doesn't rise again when a sheet reopens or the list is
 * reordered. `arriving` are items already there at first that still count as new (Share-ins,
 * added as the app started).
 */
export function useArrivals(ids: readonly string[], arriving: readonly string[] = []): (id: string) => boolean {
  const [settled, setSettled] = useState(() => new Set(ids.filter(id => !arriving.includes(id))))
  const key = ids.join('\n')
  useEffect(() => {
    const fresh = key.split('\n').filter(id => id && !settled.has(id))
    if (!fresh.length) return
    const timer = setTimeout(() => setSettled(s => new Set([...s, ...fresh])), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [key, settled])
  return id => !settled.has(id)
}
