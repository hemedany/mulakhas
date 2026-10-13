import type { Db } from './db'
import type { SavedResult } from './history'
import { isLang } from './langs'
import { KEYS, V1_KEYS } from './storage-keys'

// v1 (the single-file Gemini app) kept everything in localStorage. Migration copies it into
// the v2 keys and stores once, and never touches the originals.

interface V1Entry {
  d: number
  m: 'summary' | 'transcript'
  files?: string[]
  title?: string
  out: string
}

function readV1History(ls: Storage): V1Entry[] {
  try {
    const parsed: unknown = JSON.parse(ls.getItem(V1_KEYS.history) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e): e is V1Entry => typeof e?.d === 'number' && typeof e?.out === 'string')
  } catch {
    return []
  }
}

function toSavedResult(e: V1Entry): SavedResult {
  return {
    id: `v1-${e.d}`,
    createdAt: e.d,
    mode: e.m === 'transcript' ? 'exact' : 'summary',
    files: Array.isArray(e.files) ? e.files : [],
    title: e.title || e.out.slice(0, 60),
    text: e.out,
  }
}

export async function migrateFromV1(ls: Storage, db: Db, prefersDarkScheme: boolean): Promise<void> {
  if (ls.getItem(KEYS.migratedFromV1) === '1') return

  // v1 wrote `theme` on every visit, so any of these marks a device that ran v1.
  const v1 = Object.fromEntries(Object.entries(V1_KEYS).map(([name, key]) => [name, ls.getItem(key)]))
  if (Object.values(v1).some(v => v !== null)) ls.setItem(KEYS.wasV1User, '1')

  if (isLang(v1.uiLang)) ls.setItem(KEYS.uiLang, v1.uiLang)

  // v1 saved whichever theme was showing, including the untouched device default. Only a
  // theme that differs from the device's current one is a deliberate choice worth keeping.
  const deviceTheme = prefersDarkScheme ? 'dark' : 'light'
  if ((v1.theme === 'light' || v1.theme === 'dark') && v1.theme !== deviceTheme) ls.setItem(KEYS.theme, v1.theme)

  if (v1.geminiKey && !ls.getItem(KEYS.geminiKey)) ls.setItem(KEYS.geminiKey, v1.geminiKey)

  await db.putMany('history', readV1History(ls).map(toSavedResult))

  ls.setItem(KEYS.migratedFromV1, '1')
}
