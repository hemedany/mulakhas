// The Thread: the ordered Messages Mulakhas reads together. Saved on the device after every
// change (files included), so nothing is lost when the page reloads, and heard in the
// background as soon as a Groq key is connected.
import type { Db } from './db'
import type { History, Mode } from './history'
import type { KeysStore } from './keys'
import { observable, type Observable } from './observable'
import type { PrefsStore } from './prefs'
import type { Fetch } from './providers'
import { reliabilityReport, type ReliabilityRow } from './reliability'
import { HearError, transcribe, type HearFailure, type Transcript } from './whisper'
import { WriteError, buildRequest, chooseWriter, titleOf, write, type WriteFailure, type WriteOptions } from './writer'

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
  /** While Groq has asked us to wait: when the next try happens (ms since epoch). */
  retryAt?: number
  transcript?: Transcript
}

export interface TextMessage {
  id: string
  kind: 'text'
  text: string
}

export type Message = MediaMessage | TextMessage

/** The Result written for this Thread. */
export interface ThreadResult {
  id: string
  createdAt: number
  mode: Mode
  text: string
  report: ReliabilityRow[]
}

export type Writing =
  | { state: 'idle' }
  | { state: 'listening' }
  /** `retryAt`: Groq asked us to wait until then before trying again. */
  | { state: 'writing'; retryAt?: number }
  | { state: 'failed'; failure: WriteFailure }

export interface ThreadState {
  messages: Message[]
  result: ThreadResult | null
  writing: Writing
  /** The Request being written, kept so a reload does not lose it. */
  draft: WriteOptions
}

const EMPTY_DRAFT: WriteOptions = { request: '', mode: 'summary', preset: null }

export interface ThreadStore extends Observable<ThreadState> {
  /**
   * Appends Voice notes and Videos in the order they were sent, and starts hearing them. After a
   * Result, they start a fresh Thread (the Result is already in History).
   */
  addFiles(files: File[]): Promise<void>
  /** Inserts an empty (or given) Text message at a position; returns its id. */
  addText(at: number, text?: string): Promise<string>
  setText(id: string, text: string): Promise<void>
  move(id: string, to: number): Promise<void>
  /** Moves a Message up (-1) or down (+1). */
  moveBy(id: string, delta: number): Promise<void>
  /** Inserts a Text message right above or below another Message; returns its id. */
  addTextNear(id: string, where: 'above' | 'below', text?: string): Promise<string>
  remove(id: string): Promise<void>
  /** Hears a failed Message again. */
  retry(id: string): Promise<void>
  /** The original file of a Voice note or Video. */
  media(id: string): Promise<Blob | undefined>
  startOver(): Promise<void>
  setDraft(draft: WriteOptions): Promise<void>
  /** Waits for every Message to be heard, writes the Result, keeps it with the Thread and saves it to History. */
  summarize(options: WriteOptions): Promise<ThreadResult>
  /** Resolves once nothing is being heard and nothing that can be heard is waiting. */
  idle(): Promise<void>
}

const CURRENT = 'current'
const MAX_PARALLEL = 2
const MAX_ATTEMPTS = 3

const clampIndex = (at: number, length: number) => Math.max(0, Math.min(at, length))

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
  prefs: PrefsStore
  history: History
  fetch: Fetch
  sleep: (ms: number) => Promise<void>
  now: () => number
}): Promise<ThreadStore> {
  const { db, keys, prefs, history, fetch, sleep, now } = deps
  const saved = await db.get<Partial<ThreadState>>('thread', CURRENT)
  // A Message that was being heard when the page closed is heard again.
  const restored = (saved?.messages ?? []).map(m => (m.kind !== 'text' && m.state === 'hearing' ? { ...m, state: 'waiting' as const } : m))
  const state = observable<ThreadState>({ messages: restored, result: saved?.result ?? null, writing: { state: 'idle' }, draft: saved?.draft ?? EMPTY_DRAFT })
  const active = new Set<Promise<void>>()
  let writer: { key: string; model: string } | null = null

  const persist = () => {
    const { messages, result, draft } = state.get()
    return db.put('thread', { messages, result, draft }, CURRENT)
  }
  async function commit(messages: Message[]) {
    state.publish({ ...state.get(), messages })
    await persist()
  }
  const setWriting = (writing: Writing) => state.publish({ ...state.get(), writing })
  const patchMedia = (messages: Message[], id: string, patch: Partial<MediaMessage>) =>
    messages.map(m => (m.id === id && m.kind !== 'text' ? { ...m, ...patch } : m))
  const update = (id: string, patch: Partial<MediaMessage>) => commit(patchMedia(state.get().messages, id, patch))

  async function hear(message: MediaMessage, key: string) {
    try {
      await update(message.id, { state: 'hearing', failure: undefined })
      const audio = await db.get<Blob>('blobs', message.id)
      if (!audio) return await update(message.id, { state: 'failed', failure: 'unknown' })
      for (let attempt = 1; ; attempt++) {
        try {
          const transcript = await transcribe(fetch, key, audio, message.name)
          return await update(message.id, { state: 'heard', transcript, retryAt: undefined })
        } catch (e) {
          const err = e instanceof HearError ? e : new HearError('unknown')
          if (err.failure === 'busy' && attempt < MAX_ATTEMPTS) {
            // Wait exactly as long as Groq asks (its hourly audio limit can mean many minutes), and say so.
            const wait = err.retryAfterMs ?? 2000 * attempt
            await update(message.id, { retryAt: now() + wait })
            await sleep(wait)
            await update(message.id, { retryAt: undefined })
            continue
          }
          return await update(message.id, { state: 'failed', failure: err.failure, retryAt: undefined })
        }
      }
    } catch {
      // Storage itself failed; never leave the Message looking as if it is still being heard.
      state.publish({ ...state.get(), messages: patchMedia(state.get().messages, message.id, { state: 'failed', failure: 'unknown', retryAt: undefined }) })
    }
  }

  /** Starts hearing waiting Messages, two at a time. */
  function startHearing() {
    const key = keys.get().groq
    if (!key) return
    for (const m of state.get().messages) {
      if (active.size >= MAX_PARALLEL) return
      if (m.kind === 'text' || m.state !== 'waiting') continue
      // Claim it synchronously so the next call does not start it twice.
      state.publish({ ...state.get(), messages: patchMedia(state.get().messages, m.id, { state: 'hearing' }) })
      const job = hear(m, key).finally(() => { active.delete(job); startHearing() })
      active.add(job)
    }
  }

  let lastKey = keys.get().groq
  keys.subscribe(({ groq }) => {
    if (groq && groq !== lastKey) {
      // A new key: Messages refused because of the old one get another chance.
      const messages = state.get().messages.map(m => (m.kind !== 'text' && m.state === 'failed' && m.failure === 'rejected' ? { ...m, state: 'waiting' as const, failure: undefined } : m))
      state.publish({ ...state.get(), messages })
      void persist()
    }
    lastKey = groq
    startHearing()
  })
  startHearing()

  const store: ThreadStore = {
    get: state.get,
    subscribe: state.subscribe,
    async addFiles(files) {
      if (state.get().result) await store.startOver()
      const sorted = inSentOrder(files)
      const added: MediaMessage[] = sorted.map(f => ({ id: crypto.randomUUID(), kind: kindOf(f), name: f.name, type: f.type, size: f.size, lastModified: f.lastModified, state: 'waiting' }))
      for (const [i, f] of sorted.entries()) await db.put('blobs', f, added[i].id)
      await commit([...state.get().messages, ...added])
      startHearing()
    },
    async addText(at, text = '') {
      const id = crypto.randomUUID()
      const messages = [...state.get().messages]
      messages.splice(clampIndex(at, messages.length), 0, { id, kind: 'text', text })
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
      messages.splice(clampIndex(to, messages.length), 0, m)
      await commit(messages)
    },
    async moveBy(id, delta) {
      const from = state.get().messages.findIndex(m => m.id === id)
      if (from >= 0) await store.move(id, from + delta)
    },
    async addTextNear(id, where, text = '') {
      const at = state.get().messages.findIndex(m => m.id === id)
      return store.addText(where === 'above' ? at : at + 1, text)
    },
    async remove(id) {
      await commit(state.get().messages.filter(m => m.id !== id))
      await db.delete('blobs', id)
    },
    async retry(id) {
      const m = state.get().messages.find(x => x.id === id)
      if (!m || m.kind === 'text' || m.state !== 'failed') return
      await update(id, { state: 'waiting', failure: undefined })
      startHearing()
    },
    media: id => db.get<Blob>('blobs', id),
    async startOver() {
      const ids = state.get().messages.map(m => m.id)
      state.publish({ messages: [], result: null, writing: { state: 'idle' }, draft: EMPTY_DRAFT })
      await persist()
      for (const id of ids) await db.delete('blobs', id)
    },
    async setDraft(draft) {
      state.publish({ ...state.get(), draft })
      await persist()
    },
    async summarize(options) {
      const fail = (failure: WriteFailure): never => {
        setWriting({ state: 'failed', failure })
        throw new WriteError(failure)
      }
      const key = keys.get().groq
      if (!key) fail('no-key')
      setWriting({ state: 'listening' })
      while (active.size) await Promise.allSettled([...active])
      const { messages } = state.get()
      const usable = messages.some(m => (m.kind === 'text' ? m.text.trim() : m.state === 'heard'))
      if (!usable) fail('empty')

      setWriting({ state: 'writing' })
      if (writer?.key !== key) writer = { key: key!, model: await chooseWriter(fetch, key!) }
      const user = buildRequest(messages, options, prefs.get().uiLang)
      let text = ''
      for (let attempt = 1; !text; attempt++) {
        try {
          text = await write(fetch, key!, writer.model, user)
        } catch (e) {
          const err = e instanceof WriteError ? e : new WriteError('unknown')
          if (err.failure === 'busy' && attempt < MAX_ATTEMPTS) {
            const wait = err.retryAfterMs ?? 2000 * attempt
            setWriting({ state: 'writing', retryAt: now() + wait })
            await sleep(wait)
            setWriting({ state: 'writing' })
            continue
          }
          fail(err.failure)
        }
      }

      const result: ThreadResult = { id: crypto.randomUUID(), createdAt: now(), mode: options.mode, text, report: reliabilityReport(messages) }
      state.publish({ ...state.get(), result, writing: { state: 'idle' } })
      await persist()
      await history.add({
        id: result.id,
        createdAt: result.createdAt,
        mode: result.mode,
        files: messages.flatMap(m => (m.kind === 'text' ? [] : [m.name])),
        title: titleOf(text),
        text,
        report: result.report,
      })
      return result
    },
    async idle() {
      while (active.size) await Promise.allSettled([...active])
    },
  }
  return store
}
