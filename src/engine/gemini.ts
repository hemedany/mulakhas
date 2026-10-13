// Watching a Video: with the user's Gemini key, Gemini Flash reports what is said in it (unsure
// passages marked) and what it shows. Only Videos go here, and only when a Gemini key is connected;
// Voice notes and everything else go to Whisper (ADR-0001).
import { GEMINI_API, ProviderError, retryAfterMs, type Fetch } from './providers'
import type { Transcript } from './transcript'

export type WatchFailure = 'rejected' | 'busy' | 'unreachable' | 'unsupported' | 'too-big' | 'blocked' | 'unknown'

export class WatchError extends ProviderError<WatchFailure> {}

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
/** Google's name for "its newest Flash", when a key lists no numbered one. */
const LATEST_FLASH = 'gemini-flash-latest'

/** The newest Flash model the key can use, a stable one before a preview of the same version. */
export async function chooseWatcher(fetch: Fetch, key: string): Promise<string> {
  const res = await call(fetch, `${GEMINI_API}/models?pageSize=1000`, { headers: keyHeader(key) })
  const models: { name: string; supportedGenerationMethods?: string[] }[] = (await res.json()).models ?? []
  const usable = models.filter(m => m.supportedGenerationMethods?.includes('generateContent'))
  const flash = usable
    .flatMap(m => {
      const found = FLASH.exec(m.name)
      return found ? [{ id: found[1], version: Number(found[2]), preview: !!found[3] }] : []
    })
    .sort((a, b) => b.version - a.version || Number(a.preview) - Number(b.preview))
  if (flash[0]) return flash[0].id
  if (usable.some(m => m.name === `models/${LATEST_FLASH}`)) return LATEST_FLASH
  throw new WatchError('unsupported')
}

/** An upload as Google describes it. Kept with the Message, so a reload carries on with it rather than uploading again. */
export interface GeminiUpload {
  name: string
  uri: string
  mimeType: string
  state?: 'PROCESSING' | 'ACTIVE' | 'FAILED'
  videoMetadata?: { videoDuration?: string }
}

// The types Gemini takes for Videos, where browsers name them differently (a .mov is "video/quicktime" to them).
const GEMINI_TYPE: Record<string, string> = { 'video/quicktime': 'video/mov', 'video/x-msvideo': 'video/avi', 'video/x-ms-wmv': 'video/wmv', 'video/x-flv': 'video/x-flv' }
const geminiType = (type: string) => GEMINI_TYPE[type] ?? (type || 'video/mp4')

export interface VideoFile {
  blob: Blob
  name: string
  type: string
}

/** Uploads with the Files API's resumable protocol: one request to start, one with the bytes. */
async function upload(fetch: Fetch, key: string, video: VideoFile): Promise<GeminiUpload> {
  const start = await call(fetch, UPLOAD_API, {
    method: 'POST',
    headers: {
      ...keyHeader(key),
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(video.blob.size),
      'X-Goog-Upload-Header-Content-Type': geminiType(video.type),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: video.name } }),
  })
  const target = start.headers.get('x-goog-upload-url')
  if (!target) throw new WatchError('unknown')
  const done = await call(fetch, target, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0' },
    body: video.blob,
  })
  return (await done.json()).file
}

const uploadNow = async (fetch: Fetch, key: string, name: string): Promise<GeminiUpload> =>
  (await call(fetch, `${GEMINI_API}/${name}`, { headers: keyHeader(key) })).json()

const WATCH_PROMPT = `This video comes from a WhatsApp chat. Report exactly what is SAID in it and what it SHOWS. Do not summarize.

- speech: everything said, in order and word for word, in the language and dialect it is spoken in (often Levantine Arabic). Never translate. Split it into passages of a sentence or two, each with its start and end in seconds. If you are not sure of any word in a passage, write your best reading and set "clear" to false.
- If nobody speaks, return an empty speech list. Never invent speech.
- shown: what the video shows that matters to someone who can't watch it: actions and steps, things and amounts, text on screen, in the order they appear. Write it in the language spoken in the video, or in English if nobody speaks.
- language: the main language spoken, such as "Arabic", or null if nobody speaks.`

const ANSWER_SCHEMA = {
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

/** What Gemini says about a Video it watched. */
interface GeminiAnswer {
  language?: string | null
  speech: { start: number; end: number; text: string; clear: boolean }[]
  shown: string
}

async function ask(fetch: Fetch, key: string, model: string, file: GeminiUpload): Promise<GeminiAnswer> {
  const res = await call(fetch, `${GEMINI_API}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { ...keyHeader(key), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ file_data: { mime_type: file.mimeType, file_uri: file.uri } }, { text: WATCH_PROMPT }] }],
      generationConfig: {
        // Google's default temperature: lower ones can make newer Gemini models repeat themselves on long answers.
        responseMimeType: 'application/json',
        responseSchema: ANSWER_SCHEMA,
        // Sharp enough to read text on screen, light enough for a few minutes of video on the free tier.
        mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
      },
    }),
  })
  const body = await res.json()
  const candidate = body.candidates?.[0]
  if (body.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY') throw new WatchError('blocked')
  const text: string = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  try {
    const answer: GeminiAnswer = JSON.parse(text)
    if (!Array.isArray(answer.speech)) throw new Error('no speech list')
    return answer
  } catch {
    throw new WatchError('unknown')
  }
}

export interface WatchDeps {
  sleep: (ms: number) => Promise<void>
  /** Runs one call to Google, trying again while it is busy. */
  retrying: <T>(call: () => Promise<T>) => Promise<T>
  /** An upload made before a reload, to carry on with. */
  uploaded: GeminiUpload | undefined
  /** Told of each upload, and of `undefined` once it is deleted. */
  onUpload: (file: GeminiUpload | undefined) => unknown
}

/** Uploads a Video (or carries on with an earlier upload), has Gemini watch it, and deletes the upload. */
export async function watchVideo(fetch: Fetch, key: string, model: string, video: VideoFile, deps: WatchDeps): Promise<Transcript> {
  const { sleep, retrying, onUpload } = deps
  // Google keeps uploads for two days, so one from before a reload is usually still there.
  const earlier = deps.uploaded ? await retrying(() => uploadNow(fetch, key, deps.uploaded!.name)).catch(() => null) : null
  let file: GeminiUpload = earlier && earlier.state !== 'FAILED' ? earlier : await retrying(() => upload(fetch, key, video))
  if (file !== earlier) await onUpload(file)
  const { name } = file
  try {
    for (let polls = 0; file.state === 'PROCESSING' && polls < PROCESSING_POLLS; polls++) {
      await sleep(PROCESSING_POLL_MS)
      file = await retrying(() => uploadNow(fetch, key, name))
    }
    if (file.state !== 'ACTIVE') throw new WatchError('unsupported')
    const watched = file
    const answer = await retrying(() => ask(fetch, key, model, watched))
    const segments = answer.speech.map(p => ({ start: p.start, end: p.end, text: p.text.trim(), confidence: 1, unclear: !p.clear }))
    const seconds = Number.parseFloat(file.videoMetadata?.videoDuration ?? '')
    return {
      text: segments.map(s => s.text).join(' ').trim(),
      language: answer.language ?? null,
      duration: Number.isFinite(seconds) ? seconds : segments.at(-1)?.end ?? 0,
      segments,
      heardBy: 'gemini',
      shown: answer.shown.trim() || undefined,
    }
  } finally {
    // This upload is no longer needed, so it goes now rather than in two days.
    fetch(`${GEMINI_API}/${name}`, { method: 'DELETE', headers: keyHeader(key) }).catch(() => {})
    await onUpload(undefined)
  }
}
