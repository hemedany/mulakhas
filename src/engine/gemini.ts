// Watching a Video: with the user's Google key, Gemini Flash reports what is said in it (unclear
// words marked) and what it shows. Only Videos go here, and only when a Google key is connected;
// Voice notes and everything else go to Whisper (ADR-0001).
import { GEMINI_API, retryAfterMs, type Fetch } from './providers'
import type { Transcript } from './transcript'

export type WatchFailure = 'rejected' | 'busy' | 'unreachable' | 'unsupported' | 'blocked' | 'unknown'

export class WatchError extends Error {
  readonly failure: WatchFailure
  readonly retryAfterMs: number | null
  constructor(failure: WatchFailure, retryAfterMs: number | null = null) {
    super(failure)
    this.failure = failure
    this.retryAfterMs = retryAfterMs
  }
}

const UPLOAD_API = 'https://generativelanguage.googleapis.com/upload/v1beta/files'
/** Gemini's Files API takes files up to 2 GB. */
export const GEMINI_MAX_BYTES = 2_000_000_000
/** How often, and how many times, to ask whether Google has finished processing an upload (about ten minutes). */
const PROCESSING_POLL_MS = 2000
const PROCESSING_POLLS = 300

const keyHeader = (key: string) => ({ 'x-goog-api-key': key })

/** Why a Google call failed, from its status and body. */
async function failureOf(res: Response): Promise<WatchError> {
  const body = await res.text().catch(() => '')
  if (res.status === 401 || res.status === 403 || body.includes('API_KEY_INVALID')) return new WatchError('rejected')
  if (res.status === 429 || res.status >= 500) {
    // Google says how long to wait in the body ("retryDelay": "17s") more often than in a header.
    const delay = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(body)?.[1]
    return new WatchError('busy', retryAfterMs(res) ?? (delay ? Number(delay) * 1000 : null))
  }
  if (res.status === 400 || res.status === 413 || res.status === 415) return new WatchError('unsupported')
  return new WatchError('unknown')
}

async function call(fetch: Fetch, url: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new WatchError('unreachable')
  }
  if (!res.ok) throw await failureOf(res)
  return res
}

// Gemini model names that are a Flash model for general use: "gemini-3-flash", "gemini-2.5-flash-preview-09-2025".
const FLASH = /^models\/(gemini-(\d+(?:\.\d+)?)-flash(-preview[\w-]*)?)$/

/** The newest Flash model the key can use, a stable one before a preview of the same version. */
export async function chooseWatcher(fetch: Fetch, key: string): Promise<string> {
  const res = await call(fetch, `${GEMINI_API}/models?pageSize=1000`, { headers: keyHeader(key) })
  const models: { name: string; supportedGenerationMethods?: string[] }[] = (await res.json()).models ?? []
  const flash = models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .flatMap(m => {
      const found = FLASH.exec(m.name)
      return found ? [{ id: found[1], version: Number(found[2]), preview: !!found[3] }] : []
    })
    .sort((a, b) => b.version - a.version || Number(a.preview) - Number(b.preview))
  return flash[0]?.id ?? 'gemini-flash-latest'
}

interface GeminiFile {
  name: string
  uri: string
  mimeType: string
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED'
  videoMetadata?: { videoDuration?: string }
}

/** Uploads with the Files API's resumable protocol: one request to start, one with the bytes. */
async function upload(fetch: Fetch, key: string, video: Blob, name: string, type: string): Promise<GeminiFile> {
  const start = await call(fetch, UPLOAD_API, {
    method: 'POST',
    headers: {
      ...keyHeader(key),
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(video.size),
      'X-Goog-Upload-Header-Content-Type': type,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: name } }),
  })
  const target = start.headers.get('x-goog-upload-url')
  if (!target) throw new WatchError('unknown')
  const done = await call(fetch, target, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0' },
    body: video,
  })
  return (await done.json()).file
}

async function untilProcessed(fetch: Fetch, key: string, file: GeminiFile, sleep: (ms: number) => Promise<void>): Promise<GeminiFile> {
  for (let polls = 0; file.state === 'PROCESSING' && polls < PROCESSING_POLLS; polls++) {
    await sleep(PROCESSING_POLL_MS)
    file = await (await call(fetch, `${GEMINI_API}/${file.name}`, { headers: keyHeader(key) })).json()
  }
  if (file.state !== 'ACTIVE') throw new WatchError('unsupported')
  return file
}

export const WATCH_PROMPT = `This video comes from a WhatsApp chat. Report exactly what is SAID in it and what it SHOWS. Do not summarize.

- speech: everything said, in order and word for word, in the language and dialect it is spoken in (often Levantine Arabic). Never translate. Split it into passages of a sentence or two, each with its start and end in seconds. If you are not sure of any word in a passage, write your best reading and set "clear" to false.
- If nobody speaks, return an empty speech list. Never invent speech.
- shown: what the video shows that matters to someone who can't watch it: actions and steps, things and amounts, text on screen, in the order they appear. Write it in the language spoken in the video, or in English if nobody speaks.
- language: the main language spoken, such as "Arabic", or null if nobody speaks.`

const WATCH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    language: { type: 'STRING', nullable: true },
    speech: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { start: { type: 'NUMBER' }, end: { type: 'NUMBER' }, text: { type: 'STRING' }, clear: { type: 'BOOLEAN' } },
        required: ['start', 'end', 'text', 'clear'],
      },
    },
    shown: { type: 'STRING' },
  },
  required: ['speech', 'shown'],
}

interface Watched {
  language?: string | null
  speech: { start: number; end: number; text: string; clear: boolean }[]
  shown: string
}

async function watch(fetch: Fetch, key: string, model: string, file: GeminiFile): Promise<Watched> {
  const res = await call(fetch, `${GEMINI_API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { ...keyHeader(key), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ file_data: { mime_type: file.mimeType, file_uri: file.uri } }, { text: WATCH_PROMPT }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: WATCH_SCHEMA,
        // Fewer tokens per frame: what is said is heard in full either way, and a long video stays within the free tier.
        mediaResolution: 'MEDIA_RESOLUTION_LOW',
      },
    }),
  })
  const body = await res.json()
  const candidate = body.candidates?.[0]
  if (body.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') throw new WatchError('blocked')
  const text: string = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  try {
    const watched: Watched = JSON.parse(text)
    if (!Array.isArray(watched.speech)) throw new Error('no speech list')
    return watched
  } catch {
    throw new WatchError('unknown')
  }
}

export interface WatchDeps {
  sleep: (ms: number) => Promise<void>
  /** Runs one call to Google, trying again while it is busy. */
  retrying: <T>(call: () => Promise<T>) => Promise<T>
}

/** Uploads a Video, has Gemini watch it, and deletes the upload again. */
export async function watchVideo(fetch: Fetch, key: string, model: string, video: Blob, name: string, type: string, { sleep, retrying }: WatchDeps): Promise<Transcript> {
  const uploaded = await retrying(() => upload(fetch, key, video, name, type || video.type || 'video/mp4'))
  try {
    const file = await untilProcessed(fetch, key, uploaded, sleep)
    const watched = await retrying(() => watch(fetch, key, model, file))
    const segments = watched.speech.map(p => ({ start: p.start, end: p.end, text: p.text.trim(), confidence: 1, unclear: !p.clear }))
    const seconds = Number.parseFloat(file.videoMetadata?.videoDuration ?? '')
    return {
      text: segments.map(s => s.text).join(' ').trim(),
      language: watched.language ?? null,
      duration: Number.isFinite(seconds) ? seconds : segments.at(-1)?.end ?? 0,
      segments,
      watched: true,
      shown: watched.shown.trim() || undefined,
    }
  } finally {
    // Google keeps uploads for two days; this one is no longer needed, so it goes now.
    fetch(`${GEMINI_API}/${uploaded.name}`, { method: 'DELETE', headers: keyHeader(key) }).catch(() => {})
  }
}
