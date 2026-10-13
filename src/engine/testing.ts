import { IDBFactory } from 'fake-indexeddb'
import { SAMPLE_RATE } from './audio'
import type { Engine, EngineDeps, Fetch } from './index'

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

// A fake sound format for tests: "FAKE-PCM <seconds>", then optionally " quiet <second>,<second>".

/**
 * A Voice note or Video the fake decoder can decode, `seconds` long and padded to `bytes`, so a test
 * can make one over Groq's limit, or in a format Whisper rejects, without real audio. Given `quiet`
 * seconds, it is loud except for a one-second pause around each of them; otherwise it is silent.
 */
export function soundFile(name: string, seconds: number, { bytes = 64, type = 'audio/ogg', lastModified = 1, quiet = [] as number[] } = {}) {
  const head = new TextEncoder().encode(`FAKE-PCM ${seconds}${quiet.length ? ` quiet ${quiet.join(',')}` : ''}\n`)
  const body = new Uint8Array(Math.max(bytes, head.length))
  body.set(head)
  return new File([body], name, { type, lastModified })
}

/** Stands in for the browser's decoder: decodes a `soundFile()`; anything else can't be decoded, as with a damaged file. */
export async function fakeDecode(audio: Blob): Promise<Float32Array> {
  const head = /^FAKE-PCM ([\d.]+)(?: quiet ([\d.,]+))?/.exec(await audio.slice(0, 64).text())
  if (!head) throw new DOMException('Unable to decode audio data', 'EncodingError')
  const samples = new Float32Array(Math.round(Number(head[1]) * SAMPLE_RATE))
  const pauses = head[2]?.split(',').map(Number) ?? []
  if (pauses.length) {
    samples.fill(0.25)
    for (const at of pauses) samples.fill(0, (at - 0.5) * SAMPLE_RATE, (at + 0.5) * SAMPLE_RATE)
  }
  return samples
}

/** A fresh, isolated device: empty localStorage and IndexedDB, no network. Reuse the same object to simulate a reload. */
export function freshDevice(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return {
    localStorage: new MemoryStorage(),
    indexedDB: new IDBFactory(),
    languages: ['en-US'],
    prefersDarkScheme: false,
    fetch: fakeNetwork().fetch,
    decodeAudio: fakeDecode,
    sleep: async () => {},
    now: () => Date.now(),
    ...overrides,
  }
}

/** A fresh device with a Groq key already connected. */
export function deviceWithKey(net = fakeNetwork()): EngineDeps {
  const device = freshDevice({ fetch: net.fetch })
  device.localStorage.setItem('m2.groqKey', 'gsk_test_key')
  return device
}

/** The Thread as a list: Text messages by their text, Voice notes and Videos by their names. */
export const names = (engine: Engine) => engine.thread.get().messages.map(m => (m.kind === 'text' ? m.text : m.name))
