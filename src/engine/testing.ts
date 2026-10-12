import { IDBFactory } from 'fake-indexeddb'
import type { EngineDeps, Fetch } from './index'

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

type Handler = (url: URL, init: RequestInit | undefined) => Response | undefined | Promise<Response | undefined>

/**
 * The network as the engine sees it: every request is recorded, and handlers answer the ones
 * a test cares about. An unanswered request fails like a dropped connection.
 */
export function fakeNetwork() {
  const handlers: Handler[] = []
  const requests: { url: URL; init: RequestInit | undefined }[] = []
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    requests.push({ url, init })
    for (const h of handlers) {
      const res = await h(url, init)
      if (res) return res
    }
    throw new TypeError('Failed to fetch')
  }) as Fetch
  return {
    fetch,
    requests,
    on(handler: Handler) { handlers.push(handler) },
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A fresh, isolated device: empty localStorage and IndexedDB, no network. Reuse the same object to simulate a reload. */
export function freshDevice(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return {
    localStorage: new MemoryStorage(),
    indexedDB: new IDBFactory(),
    languages: ['en-US'],
    prefersDarkScheme: false,
    fetch: fakeNetwork().fetch,
    sleep: async () => {},
    ...overrides,
  }
}
