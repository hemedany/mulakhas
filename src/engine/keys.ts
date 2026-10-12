import { observable, type Observable } from './observable'
import { checkKey, type Provider } from './providers'
import { KEYS } from './storage-keys'

/** The user's Own keys. They never leave the device except in requests to Groq and Google. */
export interface OwnKeys {
  groq: string | null
  gemini: string | null
}

export type ConnectOutcome = { ok: true } | { ok: false; reason: 'empty' | 'rejected' | 'unreachable' }

export interface KeysStore extends Observable<OwnKeys> {
  /** Checks the key with its provider and saves it only if the provider accepts it. */
  connect(provider: Provider, key: string): Promise<ConnectOutcome>
  remove(provider: Provider): void
}

const STORAGE: Record<Provider, string> = { groq: KEYS.groqKey, gemini: KEYS.geminiKey }

export function createKeys(ls: Storage, fetch: typeof globalThis.fetch): KeysStore {
  const state = observable<OwnKeys>({ groq: ls.getItem(KEYS.groqKey), gemini: ls.getItem(KEYS.geminiKey) })

  return {
    get: state.get,
    subscribe: state.subscribe,
    async connect(provider, raw) {
      const key = raw.trim()
      if (!key) return { ok: false, reason: 'empty' }
      const check = await checkKey(fetch, provider, key)
      if (check !== 'ok') return { ok: false, reason: check }
      ls.setItem(STORAGE[provider], key)
      state.publish({ ...state.get(), [provider]: key })
      return { ok: true }
    },
    remove(provider) {
      ls.removeItem(STORAGE[provider])
      state.publish({ ...state.get(), [provider]: null })
    },
  }
}
