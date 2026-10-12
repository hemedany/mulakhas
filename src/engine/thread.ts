// The Thread: the ordered Messages Mulakhas reads together. Saved on the device after every
// change (files included), so nothing is lost when the page reloads, and heard in the
// background as soon as a Groq key is connected.
import type { Db } from './db'
import type { KeysStore } from './keys'
import { observable, type Observable } from './observable'
import type { Fetch } from './providers'
import { HearError, transcribe, type HearFailure, type Transcript } from './whisper'

export type MediaKind = 'voice' | 'video'
export type HearState = 'waiting' | 'hearing' | 'heard' | 'failed'

export interface MediaMessage {
  id: string
  kind: MediaKind
  name: string
  type: string
  size: number
  lastModified: number
  state: HearState
  failure?: HearFailure
  transcript?: Transcript
}

export interface TextMessage {
  id: string
  kind: 'text'
  text: string
}

export type Message = MediaMessage | TextMessage

export interface ThreadState {
  messages: Message[]
}

export interface ThreadStore extends Observable<ThreadState> {
  /** Appends Voice notes and Videos, ordered among themselves by file date, and starts hearing them. */
  addFiles(files: File[]): Promise<void>
  /** Inserts an empty (or given) Text message at a position; returns its id. */
  addText(at: number, text?: string): Promise<string>
  setText(id: string, text: string): Promise<void>
  move(id: string, to: number): Promise<void>
  remove(id: string): Promise<void>
  /** Hears a failed Message again. */
  retry(id: string): Promise<void>
  /** The original file of a Voice note or Video. */
  media(id: string): Promise<Blob | undefined>
  startOver(): Promise<void>
  /** Resolves once nothing is being heard and nothing that can be heard is waiting. */
  idle(): Promise<void>
}

const CURRENT = 'current'
const MAX_PARALLEL = 2
const MAX_ATTEMPTS = 3
const MAX_RETRY_WAIT_MS = 60_000

const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|3gp|avi|wmv|mpg|mpeg)$/i

const byName = new Intl.Collator('en', { numeric: true }).compare

// WhatsApp names media PTT-20261011-WA0003.opus: the day it arrived and a running number for
// that day. On phones that order is trustworthy; file dates are often when it was saved or copied.
const WHATSAPP_NAME = /^(?:PTT|AUD|VID)-(\d{8})-WA(\d+)/i
const whatsappKey = (name: string) => {
  const m = WHATSAPP_NAME.exec(name)
  return m ? Number(m[1]) * 1e5 + Number(m[2]) : null
}

/** Puts a batch of files in the order they were sent. */
export function inSentOrder(files: File[]): File[] {
  const keys = files.map(f => whatsappKey(f.name))
  if (keys.every(k => k !== null)) {
    return files.map((f, i) => [f, keys[i]!] as const).sort((a, b) => a[1] - b[1]).map(([f]) => f)
  }
  return [...files].sort((a, b) => a.lastModified - b.lastModified || byName(a.name, b.name))
}

export function kindOf(file: File): MediaKind {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'voice'
  return VIDEO_EXT.test(file.name) ? 'video' : 'voice'
}

export async function createThread(deps: {
  db: Db
  keys: KeysStore
  fetch: Fetch
  sleep: (ms: number) => Promise<void>
}): Promise<ThreadStore> {
  const { db, keys, fetch, sleep } = deps
  const saved = await db.get<ThreadState>('thread', CURRENT)
  // A Message that was being heard when the page closed is heard again.
  const restored = (saved?.messages ?? []).map(m => (m.kind !== 'text' && m.state === 'hearing' ? { ...m, state: 'waiting' as const } : m))
  const state = observable<ThreadState>({ messages: restored })
  const active = new Set<Promise<void>>()

  const persist = (messages: Message[]) => db.put('thread', { messages }, CURRENT)
  async function commit(messages: Message[]) {
    state.publish({ messages })
    await persist(messages)
  }
  const update = (id: string, patch: Partial<MediaMessage>) =>
    commit(state.get().messages.map(m => (m.id === id && m.kind !== 'text' ? { ...m, ...patch } : m)))

  async function hear(message: MediaMessage, key: string) {
    await update(message.id, { state: 'hearing', failure: undefined })
    const audio = await db.get<Blob>('blobs', message.id)
    if (!audio) return update(message.id, { state: 'failed', failure: 'unknown' })
    for (let attempt = 1; ; attempt++) {
      try {
        const transcript = await transcribe(fetch, key, audio, message.name)
        return update(message.id, { state: 'heard', transcript })
      } catch (e) {
        const err = e instanceof HearError ? e : new HearError('unknown')
        if (err.failure === 'busy' && attempt < MAX_ATTEMPTS) {
          await sleep(Math.min(err.retryAfterMs ?? 2000 * attempt, MAX_RETRY_WAIT_MS))
          continue
        }
        return update(message.id, { state: 'failed', failure: err.failure })
      }
    }
  }

  function pump() {
    const key = keys.get().groq
    if (!key) return
    for (const m of state.get().messages) {
      if (active.size >= MAX_PARALLEL) return
      if (m.kind === 'text' || m.state !== 'waiting') continue
      // Claim it synchronously so the next pump does not start it twice.
      state.publish({ messages: state.get().messages.map(x => (x.id === m.id ? { ...m, state: 'hearing' as const } : x)) })
      const job = hear(m, key).finally(() => { active.delete(job); pump() })
      active.add(job)
    }
  }

  keys.subscribe(pump)
  pump()

  return {
    get: state.get,
    subscribe: state.subscribe,
    async addFiles(files) {
      const sorted = inSentOrder(files)
      const added: MediaMessage[] = sorted.map(f => ({ id: crypto.randomUUID(), kind: kindOf(f), name: f.name, type: f.type, size: f.size, lastModified: f.lastModified, state: 'waiting' }))
      for (const [i, f] of sorted.entries()) await db.put('blobs', f, added[i].id)
      await commit([...state.get().messages, ...added])
      pump()
    },
    async addText(at, text = '') {
      const id = crypto.randomUUID()
      const messages = [...state.get().messages]
      messages.splice(Math.max(0, Math.min(at, messages.length)), 0, { id, kind: 'text', text })
      await commit(messages)
      return id
    },
    async setText(id, text) {
      await commit(state.get().messages.map(m => (m.id === id && m.kind === 'text' ? { ...m, text } : m)))
    },
    async move(id, to) {
      const messages = [...state.get().messages]
      const from = messages.findIndex(m => m.id === id)
      if (from < 0) return
      const [m] = messages.splice(from, 1)
      messages.splice(Math.max(0, Math.min(to, messages.length)), 0, m)
      await commit(messages)
    },
    async remove(id) {
      await commit(state.get().messages.filter(m => m.id !== id))
      await db.delete('blobs', id)
    },
    async retry(id) {
      await update(id, { state: 'waiting', failure: undefined })
      pump()
    },
    media: id => db.get<Blob>('blobs', id),
    async startOver() {
      const ids = state.get().messages.map(m => m.id)
      await commit([])
      for (const id of ids) await db.delete('blobs', id)
    },
    async idle() {
      while (active.size) await Promise.allSettled([...active])
    },
  }
}
