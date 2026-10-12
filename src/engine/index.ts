import { decodeInBrowser, type DecodeAudio } from './audio'
import { openDb } from './db'
import { createHistory, type History } from './history'
import { createKeys, type KeysStore } from './keys'
import { migrateFromV1 } from './migrate'
import { createPrefs, type PrefsStore } from './prefs'
import { readInbox } from './share-inbox'
import { createThread, type ThreadStore } from './thread'
import type { Fetch } from './providers'

export type { SavedResult, Mode } from './history'
export type { Message, MediaMessage, TextMessage, ThreadState, ThreadResult, Writing, HearState } from './thread'
export type { ReliabilityRow } from './reliability'
export type { WriteFailure, WriteOptions } from './writer'
export type { Transcript, Segment } from './transcript'
export type { HearFailure } from './whisper'
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
  /** The browser's audio decoder, for files Groq can't take as they are. */
  decodeAudio: DecodeAudio
  /** Waiting before a retry; instant in tests. */
  sleep: (ms: number) => Promise<void>
  /** The clock (ms since epoch). */
  now: () => number
}

/** The Mulakhas core: everything below the screens. */
export interface Engine {
  prefs: PrefsStore
  keys: KeysStore
  history: History
  thread: ThreadStore
  /** Share-ins moved into the Thread as the app started, and whether the device couldn't keep them. */
  sharedIn: { count: number; failed: boolean }
}

export async function createEngine(deps: EngineDeps): Promise<Engine> {
  const db = await openDb(deps.indexedDB)
  await migrateFromV1(deps.localStorage, db, deps.prefersDarkScheme)

  const keys = createKeys(deps.localStorage, deps.fetch)
  const prefs = createPrefs(deps.localStorage, deps.languages)
  const history = createHistory(db)
  const thread = await createThread({ db, keys, prefs, history, fetch: deps.fetch, decode: deps.decodeAudio, sleep: deps.sleep, now: deps.now })

  // Anything shared in from another app while the page was reloading joins the Thread now.
  const inbox = await readInbox(deps.indexedDB)
  const sharedIn = { count: inbox.shareIns.length, failed: false }
  if (sharedIn.count) {
    try {
      await thread.addFiles(inbox.shareIns.map(s => s.file), inbox.shareIns.map(s => s.id))
    } catch {
      // The device couldn't keep them (it's full). Say so and let them go: kept, they would fail every start.
      sharedIn.failed = true
    }
    await inbox.clear()
  }

  return { prefs, keys, history, thread, sharedIn }
}

export function browserDeps(): EngineDeps {
  return {
    localStorage: window.localStorage,
    indexedDB: window.indexedDB,
    languages: navigator.languages,
    prefersDarkScheme: window.matchMedia('(prefers-color-scheme: dark)').matches,
    fetch: window.fetch.bind(window),
    decodeAudio: decodeInBrowser,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
    now: () => Date.now(),
  }
}
