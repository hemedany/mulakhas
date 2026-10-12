import { openDb } from './db'
import { createHistory, type History } from './history'
import { createKeys, type KeysStore } from './keys'
import { migrateFromV1 } from './migrate'
import { createPrefs, type PrefsStore } from './prefs'
import { createThread, type ThreadStore } from './thread'
import type { Fetch } from './providers'

export type { SavedResult, Mode } from './history'
export type { Message, MediaMessage, TextMessage, ThreadState, ThreadResult, Writing, HearState } from './thread'
export type { ReliabilityRow } from './reliability'
export type { WriteFailure, WriteOptions } from './writer'
export type { Transcript, Segment, HearFailure } from './whisper'
export type { ConnectOutcome, OwnKeys } from './keys'
export { PROVIDERS, PROVIDER_INFO, type Fetch, type Provider } from './providers'
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
  fetch: Fetch
  /** Waiting before a retry; instant in tests. */
  sleep: (ms: number) => Promise<void>
}

/** The Mulakhas core: everything below the screens. */
export interface Engine {
  prefs: PrefsStore
  keys: KeysStore
  history: History
  thread: ThreadStore
}

export async function createEngine(deps: EngineDeps): Promise<Engine> {
  const db = await openDb(deps.indexedDB)
  await migrateFromV1(deps.localStorage, db, deps.prefersDarkScheme)

  const keys = createKeys(deps.localStorage, deps.fetch)
  const prefs = createPrefs(deps.localStorage, deps.languages)
  const history = createHistory(db)
  return {
    prefs,
    keys,
    history,
    thread: await createThread({ db, keys, prefs, history, fetch: deps.fetch, sleep: deps.sleep }),
  }
}

export function browserDeps(): EngineDeps {
  return {
    localStorage: window.localStorage,
    indexedDB: window.indexedDB,
    languages: navigator.languages,
    prefersDarkScheme: window.matchMedia('(prefers-color-scheme: dark)').matches,
    fetch: window.fetch.bind(window),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  }
}
