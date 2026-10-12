import { openDb } from './db'
import { createHistory, type History } from './history'
import { createKeys, type KeysStore } from './keys'
import { migrateFromV1 } from './migrate'
import { createPrefs, type PrefsStore } from './prefs'

export type { SavedResult, Mode } from './history'
export type { ConnectOutcome, OwnKeys } from './keys'
export type { Provider } from './providers'
export { THEMES, type Prefs, type Theme } from './prefs'
export { LANGS, LANG_NAMES, RTL_LANGS, pickLang, type Lang } from './langs'

/** Everything the engine touches on the device, injectable so tests can simulate devices and reloads. */
export interface EngineDeps {
  localStorage: Storage
  indexedDB: IDBFactory
  /** The browser's preferred languages, most preferred first. */
  languages: readonly string[]
  /** Whether the device is currently set to a dark colour scheme. */
  prefersDarkScheme: boolean
  /** The network. Only Groq and Google are ever called. */
  fetch: typeof globalThis.fetch
}

/** The Mulakhas core: everything below the screens. */
export interface Engine {
  prefs: PrefsStore
  keys: KeysStore
  history: History
}

export async function createEngine(deps: EngineDeps): Promise<Engine> {
  const db = await openDb(deps.indexedDB)
  await migrateFromV1(deps.localStorage, db, deps.prefersDarkScheme)

  return {
    prefs: createPrefs(deps.localStorage, deps.languages),
    keys: createKeys(deps.localStorage, deps.fetch),
    history: createHistory(db),
  }
}

export function browserDeps(): EngineDeps {
  return {
    localStorage: window.localStorage,
    indexedDB: window.indexedDB,
    languages: navigator.languages,
    prefersDarkScheme: window.matchMedia('(prefers-color-scheme: dark)').matches,
    fetch: window.fetch.bind(window),
  }
}
