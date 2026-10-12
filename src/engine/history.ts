import type { Db } from './db'
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
  /** Measured per-Message clarity (v2 Results only). */
  report?: ReliabilityRow[]
}

export interface History {
  list(): Promise<SavedResult[]>
  add(result: SavedResult): Promise<void>
  remove(id: string): Promise<void>
}

export function createHistory(db: Db): History {
  return {
    async list() {
      const all = await db.getAll<SavedResult>('history')
      return all.sort((a, b) => b.createdAt - a.createdAt)
    },
    add: result => db.put('history', result),
    remove: id => db.delete('history', id),
  }
}
