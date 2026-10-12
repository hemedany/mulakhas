import type { Db } from './db'

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
}

export interface History {
  list(): Promise<SavedResult[]>
}

export function createHistory(db: Db): History {
  return {
    async list() {
      const all = await db.getAll<SavedResult>('history')
      return all.sort((a, b) => b.createdAt - a.createdAt)
    },
  }
}
