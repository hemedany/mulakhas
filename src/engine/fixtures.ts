// Recorded provider answers for engine tests. Shapes follow Groq's OpenAI-compatible
// `verbose_json` transcription response (October 2026), trimmed to the fields Mulakhas reads.
import { json } from './testing'

export interface FakeSegment {
  text: string
  start: number
  end: number
  avg_logprob?: number
  no_speech_prob?: number
  compression_ratio?: number
}

export function verboseJson(segments: FakeSegment[], language = 'Arabic') {
  return {
    task: 'transcribe',
    language,
    duration: segments.at(-1)?.end ?? 0,
    text: segments.map(s => s.text).join(''),
    segments: segments.map((s, id) => ({
      id,
      seek: 0,
      start: s.start,
      end: s.end,
      text: s.text,
      tokens: [50365, 50414],
      temperature: 0,
      avg_logprob: s.avg_logprob ?? -0.18,
      compression_ratio: s.compression_ratio ?? 1.3,
      no_speech_prob: s.no_speech_prob ?? 0.01,
    })),
    x_groq: { id: 'req_01k0fake' },
  }
}

/** The file in a transcription request, if it is one. */
export const uploadedFile = (init: RequestInit | undefined) => (init?.body instanceof FormData ? (init.body.get('file') as File) : null)

/** Answers Groq transcription requests by uploaded file name; anything else falls through. */
export function whisperBy(byName: Record<string, ReturnType<typeof verboseJson>>) {
  return (url: URL, init: RequestInit | undefined) => {
    if (url.host !== 'api.groq.com' || !url.pathname.endsWith('/audio/transcriptions')) return undefined
    const file = uploadedFile(init)
    if (!file) return undefined
    const answer = byName[file.name]
    return answer ? json(answer) : json({ error: { message: `no fixture for ${file.name}` } }, 500)
  }
}

export const groqModels = (url: URL) =>
  url.host === 'api.groq.com' && url.pathname.endsWith('/models')
    ? json({ object: 'list', data: [{ id: 'whisper-large-v3', object: 'model' }] })
    : undefined

/** A tiny fake audio file. */
export function voiceNote(name: string, lastModified: number, type = 'audio/ogg') {
  return new File([new Uint8Array([79, 103, 103, 83, 0, 2])], name, { type, lastModified })
}

/** Groq's model list as a free key sees it (October 2026), trimmed. */
export const groqChatModels = (url: URL) =>
  url.host === 'api.groq.com' && url.pathname.endsWith('/models')
    ? json({
      object: 'list',
      data: ['whisper-large-v3', 'whisper-large-v3-turbo', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'meta-llama/llama-prompt-guard-2-86m']
        .map(id => ({ id, object: 'model', owned_by: 'groq', active: true })),
    })
    : undefined

/** An OpenAI-compatible chat completion as Groq returns it, trimmed. */
export function chatAnswer(content: string, model = 'openai/gpt-oss-120b') {
  return {
    id: 'chatcmpl-fake',
    object: 'chat.completion',
    created: 1791800000,
    model,
    choices: [{ index: 0, message: { role: 'assistant', content, reasoning: 'Combining the voice notes in order.' }, logprobs: null, finish_reason: 'stop' }],
    usage: { prompt_tokens: 812, completion_tokens: 240, total_tokens: 1052 },
    x_groq: { id: 'req_01k0fakechat' },
  }
}

/** Answers every chat completion with the same Result. */
export function writerBy(content: string) {
  return (url: URL, init: RequestInit | undefined) =>
    url.host === 'api.groq.com' && url.pathname.endsWith('/chat/completions')
      ? json(chatAnswer(content, JSON.parse(String(init?.body)).model))
      : undefined
}

const GOOGLE = 'generativelanguage.googleapis.com'

/** Google's model list for a key that can use `ids` (each able to generate content). */
export const geminiModelsWith = (ids: string[]) => (url: URL) =>
  url.host === GOOGLE && url.pathname === '/v1beta/models'
    ? json({ models: [...ids.map(id => ({ name: `models/${id}`, displayName: id, supportedGenerationMethods: ['generateContent', 'countTokens'] })), { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] }] })
    : undefined

/** Google's model list as a free key sees it (October 2026), trimmed. */
export const geminiModels = geminiModelsWith(['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview-09-2026', 'gemini-3-flash', 'gemini-3-flash-lite', 'gemini-3-pro', 'gemini-3-flash-image'])

/** What Gemini says after watching a Video, as the JSON its answer carries. */
export function geminiAnswer(speech: { start: number; end: number; text: string; clear?: boolean }[], shown: string, language: string | null = 'Arabic') {
  return { language, speech: speech.map(p => ({ clear: true, ...p })), shown }
}

/**
 * Gemini's Files API and generateContent for uploaded Videos: the resumable upload, processing
 * (one poll), the answer from `answer` (or an error Response), and deleting the upload.
 */
export function geminiWatching(answer: ReturnType<typeof geminiAnswer> | Response, { processed = true } = {}) {
  return (url: URL, init: RequestInit | undefined) => {
    if (url.host !== GOOGLE) return undefined
    const headers = new Headers(init?.headers)
    const file = { name: 'files/v1d30abc', displayName: 'clip.mp4', mimeType: 'video/mp4', uri: `https://${GOOGLE}/v1beta/files/v1d30abc` }
    if (url.pathname === '/upload/v1beta/files' && headers.get('x-goog-upload-command') === 'start')
      return new Response('', { headers: { 'x-goog-upload-url': `https://${GOOGLE}/upload/v1beta/files?upload_id=AFake&upload_protocol=resumable`, 'x-goog-upload-status': 'active' } })
    if (url.pathname === '/upload/v1beta/files' && url.searchParams.get('upload_id'))
      return json({ file: { ...file, state: 'PROCESSING' } })
    if (url.pathname === '/v1beta/files/v1d30abc' && init?.method === 'DELETE') return json({})
    if (url.pathname === '/v1beta/files/v1d30abc') return json({ ...file, state: processed ? 'ACTIVE' : 'PROCESSING', videoMetadata: { videoDuration: '12.400s' } })
    if (url.pathname.endsWith(':generateContent')) {
      if (answer instanceof Response) return answer.clone()
      return json({
        candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(answer) }] }, finishReason: 'STOP', index: 0 }],
        usageMetadata: { promptTokenCount: 3120, candidatesTokenCount: 210, totalTokenCount: 3330 },
        modelVersion: url.pathname.split('/').at(-1)!.replace(':generateContent', ''),
      })
    }
    return undefined
  }
}
