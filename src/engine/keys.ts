import { observable, type Observable } from './observable'
import { KEYS } from './storage-keys'

/** The user's Own keys. They never leave the device except in requests to Groq and Google. */
export interface OwnKeys {
  groq: string | null
  gemini: string | null
}

export interface KeysStore extends Observable<OwnKeys> {
  set(patch: Partial<OwnKeys>): void
}

const STORAGE: Record<keyof OwnKeys, string> = { groq: KEYS.groqKey, gemini: KEYS.geminiKey }

export function createKeys(ls: Storage): KeysStore {
  const state = observable<OwnKeys>({ groq: ls.getItem(KEYS.groqKey), gemini: ls.getItem(KEYS.geminiKey) })

  return {
    get: state.get,
    subscribe: state.subscribe,
    set(patch) {
      for (const name of ['groq', 'gemini'] as const) {
        if (!(name in patch)) continue
        const value = patch[name]
        if (value) ls.setItem(STORAGE[name], value)
        else ls.removeItem(STORAGE[name])
      }
      state.publish({ ...state.get(), ...patch })
    },
  }
}
