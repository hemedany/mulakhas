import { IDBFactory } from 'fake-indexeddb'
import type { EngineDeps } from './index'

/** A Storage backed by a Map, standing in for the browser's localStorage. */
export class MemoryStorage implements Storage {
  #data = new Map<string, string>()
  get length() { return this.#data.size }
  clear() { this.#data.clear() }
  getItem(key: string) { return this.#data.get(key) ?? null }
  key(index: number) { return [...this.#data.keys()][index] ?? null }
  removeItem(key: string) { this.#data.delete(key) }
  setItem(key: string, value: string) { this.#data.set(key, String(value)) }
}

/** A fresh, isolated device: empty localStorage and IndexedDB. Reuse the same object to simulate a reload. */
export function freshDevice(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return {
    localStorage: new MemoryStorage(),
    indexedDB: new IDBFactory(),
    languages: ['en-US'],
    ...overrides,
  }
}
