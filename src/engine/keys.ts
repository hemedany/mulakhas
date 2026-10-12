/** The user's Own keys. They never leave the device except in requests to Groq and Google. */
export interface OwnKeys {
  groq: string | null
  gemini: string | null
}

export interface KeysStore {
  get(): OwnKeys
  set(patch: Partial<OwnKeys>): void
  subscribe(listener: (keys: OwnKeys) => void): () => void
}

const K = { groq: 'm2.groqKey', gemini: 'm2.geminiKey' } as const

export function createKeys(ls: Storage): KeysStore {
  let keys: OwnKeys = { groq: ls.getItem(K.groq), gemini: ls.getItem(K.gemini) }
  const listeners = new Set<(k: OwnKeys) => void>()

  return {
    get: () => keys,
    set(patch) {
      keys = { ...keys, ...patch }
      for (const name of ['groq', 'gemini'] as const) {
        if (!(name in patch)) continue
        const value = patch[name]
        if (value) ls.setItem(K[name], value)
        else ls.removeItem(K[name])
      }
      for (const l of listeners) l(keys)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
