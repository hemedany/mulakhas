/** A value that can be read synchronously and watched, shaped for React's useSyncExternalStore. */
export interface Observable<T> {
  get(): T
  subscribe(listener: (value: T) => void): () => void
}

export function observable<T>(initial: T) {
  let value = initial
  const listeners = new Set<(value: T) => void>()

  return {
    get: () => value,
    subscribe(listener: (value: T) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    /** Replace the value and notify every subscriber. */
    publish(next: T) {
      value = next
      for (const l of listeners) l(value)
    },
  }
}
