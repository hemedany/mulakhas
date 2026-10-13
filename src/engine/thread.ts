// The Thread: the ordered Messages Mulakhas reads together. Saved on the device after every
// change (files included), so nothing is lost when the page reloads, and heard in the
// background as soon as a Groq key is connected.
import { oneAtATime, type DecodeAudio } from './audio'
import type { Db } from './db'
import { answerFollowUp, type FollowUp } from './follow-up'
import { GEMINI_MAX_BYTES, WatchError, chooseWatcher, watchVideo, type GeminiUpload, type WatchFailure } from './gemini'
import { hearFile, type PartsHeard } from './hearing'
import type { History, Mode } from './history'
import type { KeysStore } from './keys'
import { observable, type Observable } from './observable'
import type { PrefsStore } from './prefs'
import { busyFor, type Fetch, type Provider } from './providers'
import { reliabilityReport, type ReliabilityRow } from './reliability'
import type { Transcript } from './transcript'
import { HearError, transcribe, type HearFailure } from './whisper'
import { WriteError, canWrite, chooseWriter, titleOf, write, type WriteFailure, type WriteOptions, type WriteSettings, type Written } from './writer'
import { startingBudget, writeThread, type Budget, type WritingPart } from './writing'

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
  /** A long Voice note or Video heard in parts: the parts heard so far, kept until all are heard. */
  parts?: PartsHeard
  /** How many times decoding this file started without finishing (see hearing.ts). */
  decodeTries?: number
  /** A Video Gemini couldn't watch, so only its sound was heard: why. */
  watchFailure?: WatchFailure
  /** A Video's upload to Gemini, kept until it is watched, so a reload carries on with it. */
  geminiUpload?: GeminiUpload
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
  /** The writer ran out of room, so the end is missing. */
  cutOff?: boolean
  report: ReliabilityRow[]
  /** The Voice notes and Videos it was written from, as they were then. */
  files: string[]
  /** Questions asked about it since, in order. */
  followUps: FollowUp[]
  /** Saved in History once; after that, History is only updated (a Result the user deleted there stays deleted). */
  inHistory?: boolean
}

export type Writing =
  | { state: 'idle' }
  | { state: 'listening' }
  /** `retryAt`: Groq asked us to wait until then before trying again. `part`: a big Thread written in parts. */
  | { state: 'writing'; retryAt?: number; part?: WritingPart }
  | { state: 'failed'; failure: WriteFailure }

export interface ThreadState {
  messages: Message[]
  result: ThreadResult | null
  writing: Writing
  /** The Request being written, kept so a reload does not lose it. */
  draft: WriteOptions
  /** The last change could not be saved on the device, so closing the app would lose it. */
  unsaved: boolean
}

const EMPTY_DRAFT: WriteOptions = { request: '', mode: 'summary', preset: null }

export interface ThreadStore extends Observable<ThreadState> {
  /**
   * Appends Voice notes and Videos in the order they were sent, and starts hearing them. After a
   * Result, they start a fresh Thread, once the Result is safely in History. `ids`, one per file,
   * makes adding the same files twice harmless: a file whose id is already in the Thread is skipped.
   */
  addFiles(files: File[], ids?: string[]): Promise<void>
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
  /** Asks a Follow-up about the Result; its answer appears under it, and is saved with it in History. */
  askFollowUp(question: string): Promise<void>
  /** Asks a failed Follow-up again. */
  retryFollowUp(id: string): Promise<void>
  /** Resolves once nothing is being heard and nothing that can be heard is waiting. */
  idle(): Promise<void>
}

const CURRENT = 'current'
/** At most this many Messages heard at once, per provider, so Voice notes keep moving while a long Video is watched. */
const MOST_AT_ONCE: Record<Provider, number> = { groq: 2, gemini: 1 }
const MAX_ATTEMPTS = 3

const clampIndex = (at: number, length: number) => Math.max(0, Math.min(at, length))

/**
 * Makes a call to Groq or Google, and while the provider says it is busy waits exactly as long as
 * it asks (Groq's hourly audio limit can mean many minutes) and tries again, up to MAX_ATTEMPTS times.
 * `onWait` is told when the next try will happen, then `undefined` once it starts.
 */
async function withBusyRetries<T>(
  call: () => Promise<T>,
  busyFor: (e: unknown) => number | null | undefined,
  { sleep, now, onWait }: { sleep: (ms: number) => Promise<void>; now: () => number; onWait: (retryAt: number | undefined) => unknown },
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call()
    } catch (e) {
      const asked = busyFor(e)
      if (asked === undefined || attempt >= MAX_ATTEMPTS) throw e
      // Groq says how long to wait when it is rate-limiting; a server error gets 2 s, then 4 s, and so on.
      const wait = asked ?? 2000 * 2 ** (attempt - 1)
      await onWait(now() + wait)
      await sleep(wait)
      await onWait(undefined)
    }
  }
}

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
  decode: DecodeAudio
  sleep: (ms: number) => Promise<void>
  now: () => number
}): Promise<ThreadStore> {
  const { db, keys, prefs, history, fetch, sleep, now } = deps
  const decode = oneAtATime(deps.decode)
  const saved = await db.get<Partial<ThreadState>>('thread', CURRENT)
  // A Message that was being heard when the page closed is heard again (after any wait Groq asked
  // for), carrying on from the parts already heard.
  const restored = (saved?.messages ?? []).map(m => (m.kind !== 'text' && m.state === 'hearing' ? { ...m, state: 'waiting' as const } : m))
  const fileNames = (messages: Message[]) => messages.flatMap(m => (m.kind === 'text' ? [] : [m.name]))
  // Results saved before Follow-ups, or before the files were kept with them.
  const result = saved?.result ? { ...saved.result, followUps: saved.result.followUps ?? [], files: saved.result.files ?? fileNames(restored) } : null
  const state = observable<ThreadState>({ messages: restored, result, writing: { state: 'idle' }, draft: saved?.draft ?? EMPTY_DRAFT, unsaved: false })
  const active = new Map<Promise<void>, Provider>()
  let writer: { key: string; model: string; budget: Budget } | null = null
  /** Parts of a big Result already written, by prompt, so Try again carries on (see writing.ts). */
  const partsWritten = new Map<string, Written>()
  let watcher: { key: string; model: Promise<string> } | null = null

  /** Saves the Thread. A failure doesn't stop anything, but is shown until a later save works. */
  const persist = async () => {
    const { messages, result, draft } = state.get()
    try {
      await db.put('thread', { messages, result, draft }, CURRENT)
      if (state.get().unsaved) state.publish({ ...state.get(), unsaved: false })
    } catch {
      state.publish({ ...state.get(), unsaved: true })
    }
  }
  async function commit(messages: Message[]) {
    state.publish({ ...state.get(), messages })
    await persist()
  }
  const setWriting = (writing: Writing) => state.publish({ ...state.get(), writing })
  const patchMedia = (messages: Message[], id: string, patch: Partial<MediaMessage>) =>
    messages.map(m => (m.id === id && m.kind !== 'text' ? { ...m, ...patch } : m))
  const update = (id: string, patch: Partial<MediaMessage>) => commit(patchMedia(state.get().messages, id, patch))

  /** Runs one call to Groq or Google for a Message, trying again while the provider is busy, and showing when. */
  const retryingFor = (id: string) => <T>(call: () => Promise<T>) =>
    withBusyRetries(call, busyFor, { sleep, now, onWait: retryAt => update(id, { retryAt }) })

  async function hear(message: MediaMessage, key: string) {
    try {
      await update(message.id, { state: 'hearing', failure: undefined })
      const audio = await db.get<Blob>('blobs', message.id)
      if (!audio) return await update(message.id, { state: 'failed', failure: 'unknown' })
      // A wait asked for before the page closed still holds.
      const left = (message.retryAt ?? 0) - now()
      if (left > 0) {
        await sleep(left)
        await update(message.id, { retryAt: undefined })
      }
      // With a Gemini key, Gemini watches a Video. If it can't, Whisper hears its sound, or what
      // Whisper heard before stays (a Video heard before the Gemini key was connected).
      let watchFailure: WatchFailure | undefined
      const geminiKey = message.kind === 'video' ? keys.get().gemini : null
      if (geminiKey && audio.size > GEMINI_MAX_BYTES) watchFailure = 'too-big'
      else if (geminiKey) {
        try {
          const transcript = await watch(message, audio, geminiKey)
          return await update(message.id, { state: 'heard', transcript, retryAt: undefined, watchFailure: undefined })
        } catch (e) {
          watchFailure = e instanceof WatchError ? e.failure : 'unknown'
        }
      }
      if (message.transcript?.heardBy === 'whisper') return await update(message.id, { state: 'heard', retryAt: undefined, watchFailure })
      try {
        const transcript = await hearFile(audio, message.name, {
          decode,
          send: upload => retryingFor(message.id)(() => transcribe(fetch, key, upload)),
          progress: message.parts,
          onProgress: parts => update(message.id, { parts }),
          decodeTries: message.decodeTries ?? 0,
          onDecodeTries: tries => update(message.id, { decodeTries: tries || undefined }),
        })
        return await update(message.id, { state: 'heard', transcript, retryAt: undefined, parts: undefined, watchFailure })
      } catch (e) {
        // Parts already heard are kept, so Try again carries on from the next one.
        return await update(message.id, { state: 'failed', failure: e instanceof HearError ? e.failure : 'unknown', retryAt: undefined, watchFailure })
      }
    } catch {
      // Storage itself failed; never leave the Message looking as if it is still being heard.
      state.publish({ ...state.get(), messages: patchMedia(state.get().messages, message.id, { state: 'failed', failure: 'unknown', retryAt: undefined }) })
    }
  }

  /** Gemini watching a Video, with the newest Flash model the key can use (looked up once per key). */
  async function watch(message: MediaMessage, blob: Blob, key: string) {
    const retrying = retryingFor(message.id)
    if (watcher?.key !== key) watcher = { key, model: retrying(() => chooseWatcher(fetch, key)) }
    const model = await watcher.model.catch(e => { watcher = null; throw e })
    return watchVideo(fetch, key, model, { blob, name: message.name, type: message.type }, {
      sleep,
      retrying,
      uploaded: message.geminiUpload,
      onUpload: geminiUpload => update(message.id, { geminiUpload }),
    })
  }

  /** Who hears a Message: Gemini watches Videos when there is a Gemini key; Groq hears the rest. */
  const providerFor = (m: MediaMessage): Provider =>
    m.kind === 'video' && keys.get().gemini && m.size <= GEMINI_MAX_BYTES ? 'gemini' : 'groq'
  const busySlots = (provider: Provider) => [...active.values()].filter(p => p === provider).length

  /** Starts hearing waiting Messages, a few at a time per provider. */
  function startHearing() {
    const key = keys.get().groq
    if (!key) return
    for (const m of state.get().messages) {
      if (m.kind === 'text' || m.state !== 'waiting') continue
      const provider = providerFor(m)
      if (busySlots(provider) >= MOST_AT_ONCE[provider]) continue
      // Claim it synchronously so the next call does not start it twice.
      state.publish({ ...state.get(), messages: patchMedia(state.get().messages, m.id, { state: 'hearing' }) })
      const job = hear(m, key).finally(() => { active.delete(job); startHearing() })
      active.set(job, provider)
    }
  }

  let lastKeys = keys.get()
  keys.subscribe(({ groq, gemini }) => {
    let messages = state.get().messages
    // A new Groq key: Messages and Follow-ups refused for want of a key get another chance.
    if (groq && groq !== lastKeys.groq) {
      messages = messages.map(m => (m.kind !== 'text' && m.state === 'failed' && m.failure === 'rejected' ? { ...m, state: 'waiting' as const, failure: undefined } : m))
      for (const f of state.get().result?.followUps ?? []) if (f.state === 'failed' && (f.failure === 'rejected' || f.failure === 'no-key')) queueAnswer(f.id)
    }
    // A new Gemini key: Videos so far only heard, or not heard at all, are watched now.
    if (gemini && gemini !== lastKeys.gemini) {
      messages = messages.map(m => (m.kind === 'video' && (m.state === 'failed' || (m.state === 'heard' && m.transcript?.heardBy !== 'gemini'))
        ? { ...m, state: 'waiting' as const, failure: undefined, watchFailure: undefined }
        : m))
    }
    if (messages !== state.get().messages) {
      state.publish({ ...state.get(), messages })
      void persist()
    }
    lastKeys = { groq, gemini }
    startHearing()
  })
  startHearing()

  /** The writer for this key: chosen from its live model list once, with what it may be sent per minute. */
  async function writerFor(key: string) {
    if (writer?.key !== key) {
      const model = await chooseWriter(fetch, key)
      writer = { key, model, budget: startingBudget(model) }
      partsWritten.clear()
    }
    return writer
  }

  /** One request to the writer, waiting while Groq is busy and telling `onWait` until when. */
  const writerSend = (key: string, model: string, onWait: (retryAt: number | undefined) => unknown) =>
    (prompt: string, settings: WriteSettings) => withBusyRetries(() => write(fetch, key, model, prompt, settings), busyFor, { sleep, now, onWait })

  const patchFollowUp = (id: string, patch: Partial<FollowUp>) => {
    const { result } = state.get()
    if (result) state.publish({ ...state.get(), result: { ...result, followUps: result.followUps.map(f => (f.id === id ? { ...f, ...patch } : f)) } })
  }

  // One Follow-up answered at a time, in order, so each has the ones before it as context.
  let answering = Promise.resolve()
  const queueAnswer = (id: string) => {
    patchFollowUp(id, { state: 'asking', failure: undefined })
    answering = answering.then(() => answerFollowUpWithId(id))
    return answering
  }

  /** Has Groq answer one Follow-up, then saves the Result with it, here and in History. */
  async function answerFollowUpWithId(id: string) {
    const { result, messages } = state.get()
    const at = result?.followUps.findIndex(f => f.id === id) ?? -1
    if (!result || at < 0) return
    const followUp = result.followUps[at]
    const key = keys.get().groq
    if (!key) patchFollowUp(id, { state: 'failed', failure: 'no-key' })
    else {
      try {
        // A wait Groq asked for before the page closed still holds.
        const left = (followUp.retryAt ?? 0) - now()
        if (left > 0) await sleep(left)
        const { model, budget } = await writerFor(key)
        const written = await answerFollowUp(
          { messages, result: result.text, earlier: result.followUps.slice(0, at), question: followUp.question, lang: prefs.get().uiLang },
          { budget, send: writerSend(key, model, retryAt => { patchFollowUp(id, { retryAt }); return persist() }) },
        )
        patchFollowUp(id, { state: 'answered', answer: written.text, cutOff: written.cutOff || undefined, retryAt: undefined })
      } catch (e) {
        patchFollowUp(id, { state: 'failed', failure: e instanceof WriteError ? e.failure : 'unknown', retryAt: undefined })
      }
    }
    await persist()
    const saved = state.get().result
    if (saved) await saveToHistory(saved).catch(() => state.publish({ ...state.get(), unsaved: true }))
  }

  /**
   * Saves a Result to History: added the first time, only updated after that, so one the user
   * deleted there isn't brought back by a Follow-up or a fresh Thread.
   */
  async function saveToHistory(result: ThreadResult) {
    const entry = {
      id: result.id,
      createdAt: result.createdAt,
      mode: result.mode,
      files: result.files,
      title: titleOf(result.text),
      text: result.text,
      cutOff: result.cutOff,
      report: result.report,
      followUps: result.followUps.flatMap(f => (f.state === 'answered' && f.answer ? [{ question: f.question, answer: f.answer }] : [])),
    }
    if (result.inHistory) return history.update(entry)
    await history.add(entry)
    const current = state.get().result
    if (current?.id === result.id) {
      state.publish({ ...state.get(), result: { ...current, inHistory: true } })
      await persist()
    }
  }

  /**
   * After a Result, the next Message added starts a fresh Thread. The Result is saved to History
   * first: the page may have closed before summarize got that far. Says whether it started over.
   */
  async function freshAfterResult() {
    const { result } = state.get()
    if (!result) return false
    await saveToHistory(result)
    await store.startOver()
    return true
  }

  const store: ThreadStore = {
    get: state.get,
    subscribe: state.subscribe,
    async addFiles(files, ids) {
      const known = new Set(state.get().messages.map(m => m.id))
      const idOf = new Map(files.map((f, i) => [f, ids?.[i] ?? crypto.randomUUID()]))
      const sorted = inSentOrder(files.filter(f => !known.has(idOf.get(f)!)))
      if (!sorted.length) return
      await freshAfterResult()
      const added: MediaMessage[] = sorted.map(f => ({ id: idOf.get(f)!, kind: kindOf(f), name: f.name, type: f.type, size: f.size, lastModified: f.lastModified, state: 'waiting' }))
      for (const [i, f] of sorted.entries()) await db.put('blobs', f, added[i].id)
      await commit([...state.get().messages, ...added])
      startHearing()
    },
    async addText(at, text = '') {
      if (await freshAfterResult()) at = 0
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
      return store.addText(where === 'above' ? at : at + 1, text) // after a Result, this starts a fresh Thread
    },
    async remove(id) {
      await commit(state.get().messages.filter(m => m.id !== id))
      await db.delete('blobs', id)
    },
    async retry(id) {
      const m = state.get().messages.find(x => x.id === id)
      if (!m || m.kind === 'text' || m.state !== 'failed') return
      // Trying again on purpose also gives a file that kept closing the page another go.
      await update(id, { state: 'waiting', failure: undefined, decodeTries: undefined })
      startHearing()
    },
    media: id => db.get<Blob>('blobs', id),
    async startOver() {
      partsWritten.clear()
      const ids = state.get().messages.map(m => m.id)
      state.publish({ ...state.get(), messages: [], result: null, writing: { state: 'idle' }, draft: EMPTY_DRAFT })
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
      while (active.size) await Promise.allSettled([...active.keys()])
      const { messages } = state.get()
      // Every Voice note and Video failed and there is no Text: say so, rather than "add something".
      if (!canWrite(messages)) fail(messages.some(m => m.kind !== 'text') ? 'nothing-heard' : 'empty')

      setWriting({ state: 'writing' })
      const { model, budget } = await writerFor(key!)
      // Keeps the part being written while showing when Groq lets us try again, and the reverse.
      const patchWriting = (patch: { retryAt?: number; part?: WritingPart }) => {
        const current = state.get().writing
        setWriting({ ...(current.state === 'writing' ? current : {}), state: 'writing', ...patch })
      }
      let written: Written
      try {
        written = await writeThread(messages, options, prefs.get().uiLang, {
          budget,
          written: partsWritten,
          onPart: part => patchWriting({ part }),
          send: writerSend(key!, model, retryAt => patchWriting({ retryAt })),
        })
      } catch (e) {
        return fail(e instanceof WriteError ? e.failure : 'unknown')
      }
      const { text, cutOff } = written

      partsWritten.clear()
      const result: ThreadResult = {
        id: crypto.randomUUID(), createdAt: now(), mode: options.mode, text, cutOff, report: reliabilityReport(messages), files: fileNames(messages), followUps: [],
      }
      state.publish({ ...state.get(), result, writing: { state: 'idle' } })
      await persist()
      try {
        await saveToHistory(result)
      } catch {
        state.publish({ ...state.get(), unsaved: true })
      }
      return result
    },
    async askFollowUp(question) {
      const { result } = state.get()
      if (!result || !question.trim()) return
      const followUp: FollowUp = { id: crypto.randomUUID(), question: question.trim(), state: 'asking' }
      state.publish({ ...state.get(), result: { ...result, followUps: [...result.followUps, followUp] } })
      await persist()
      await queueAnswer(followUp.id)
    },
    async retryFollowUp(id) {
      if (state.get().result?.followUps.find(f => f.id === id)?.state === 'failed') await queueAnswer(id)
    },
    async idle() {
      while (active.size) await Promise.allSettled([...active.keys()])
    },
  }
  // A Follow-up being answered when the page closed is asked again.
  for (const f of state.get().result?.followUps ?? []) if (f.state === 'asking') void queueAnswer(f.id)
  return store
}
