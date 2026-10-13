import type { Db } from './db'
import type { SavedFollowUp } from './follow-up'
import type { ReliabilityRow } from './reliability'

export type Mode = 'summary' | 'exact'

/** A Result saved on the device. */
export interface SavedResult {
  id: string
  createdAt: number
  mode: Mode
  /** Names of the Voice notes and Videos the Result was made from. */
  files: string[]
  title: string
  /** The Result as Markdown. */
  text: string
  /** The writer ran out of room, so the end is missing. */
  cutOff?: boolean
  /** Measured per-Message clarity (v2 Results only). */
  report?: ReliabilityRow[]
  /** The Follow-ups answered about it. */
  followUps?: SavedFollowUp[]
}

export interface History {
  list(): Promise<SavedResult[]>
  add(result: SavedResult): Promise<void>
  /** Replaces a saved Result, but only if it is still there: one the user deleted stays deleted. */
  update(result: SavedResult): Promise<void>
  remove(id: string): Promise<void>
}

export function createHistory(db: Db): History {
  return {
    async list() {
      const all = await db.getAll<SavedResult>('history')
      return all.sort((a, b) => b.createdAt - a.createdAt)
    },
    add: result => db.put('history', result),
    async update(result) {
      if (await db.get('history', result.id)) await db.put('history', result)
    },
    remove: id => db.delete('history', id),
  }
}
