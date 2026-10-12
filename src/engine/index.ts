import { openDb } from './db'
import { createHistory, type History } from './history'
import { createKeys, type KeysStore } from './keys'
import { migrateFromV1 } from './migrate'
import { createPrefs, type PrefsStore } from './prefs'

export type { SavedResult, Mode } from './history'
export type { OwnKeys } from './keys'
export type { Prefs, Theme } from './prefs'
export { LANGS, LANG_NAMES, RTL_LANGS, type Lang } from './langs'

/** Everything the engine touches on the device, injectable so tests can simulate devices and reloads. */
export interface EngineDeps {
  localStorage: Storage
  indexedDB: IDBFactory
  /** The browser's preferred languages, most preferred first. */
  languages: readonly string[]
}

/** The Mulakhas core: everything below the screens. */
export interface Engine {
  prefs: PrefsStore
  keys: KeysStore
  history: History
}

export async function createEngine(deps: EngineDeps): Promise<Engine> {
  const db = await openDb(deps.indexedDB)
  await migrateFromV1(deps.localStorage, db)

  return {
    prefs: createPrefs(deps.localStorage, deps.languages),
    keys: createKeys(deps.localStorage),
    history: createHistory(db),
  }
}

export function browserDeps(): EngineDeps {
  return { localStorage: window.localStorage, indexedDB: window.indexedDB, languages: navigator.languages }
}
