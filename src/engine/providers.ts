// The two services Mulakhas talks to, called straight from the browser with the user's Own key.

export type Provider = 'groq' | 'gemini'

export const GROQ_API = 'https://api.groq.com/openai/v1'
export const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta'

export type KeyCheck = 'ok' | 'rejected' | 'unreachable'

/** Asks the provider to list its models with this key: the cheapest call that proves the key works. */
export async function checkKey(fetch: typeof globalThis.fetch, provider: Provider, key: string): Promise<KeyCheck> {
  let res: Response
  try {
    res = provider === 'groq'
      ? await fetch(`${GROQ_API}/models`, { headers: { Authorization: `Bearer ${key}` } })
      // The key travels in a header, never in the URL, so it stays out of logs and history.
      : await fetch(`${GEMINI_API}/models?pageSize=1`, { headers: { 'x-goog-api-key': key } })
  } catch {
    return 'unreachable'
  }
  if (res.ok) return 'ok'
  // Groq answers a bad key with 401; Google with 400 (API_KEY_INVALID) or 403.
  if ([400, 401, 403].includes(res.status)) return 'rejected'
  return 'unreachable'
}
