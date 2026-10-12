import type { Db } from './db'
import type { SavedResult } from './history'

// v1 (the single-file Gemini app) kept everything in localStorage. Migration copies it into
// the v2 shapes and never deletes the originals, so a rollback to v1 still finds its data.

const MIGRATED = 'm2.migratedFromV1'

interface V1Entry {
  d: number
  m: 'summary' | 'transcript'
  files?: string[]
  title?: string
  out: string
}

function readV1History(ls: Storage): V1Entry[] {
  try {
    const parsed: unknown = JSON.parse(ls.getItem('hist') ?? '[]')
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

export async function migrateFromV1(ls: Storage, db: Db): Promise<void> {
  if (ls.getItem(MIGRATED) === '1') return

  // v1 wrote `theme` on every visit, so any of these marks a device that ran v1.
  const ranV1 = ['hist', 'gemKey', 'tutSeen', 'theme'].some(k => ls.getItem(k) !== null)
  if (ranV1) ls.setItem('m2.wasV1User', '1')

  const v1Key = ls.getItem('gemKey')
  if (v1Key && !ls.getItem('m2.geminiKey')) ls.setItem('m2.geminiKey', v1Key)

  await db.putMany('history', readV1History(ls).map(toSavedResult))

  ls.setItem(MIGRATED, '1')
}
