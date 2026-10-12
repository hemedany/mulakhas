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
