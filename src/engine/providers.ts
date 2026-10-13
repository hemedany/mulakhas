// The two services Mulakhas talks to, called straight from the browser with the user's Own key.

export type Fetch = typeof globalThis.fetch

export const PROVIDERS = ['groq', 'gemini'] as const
export type Provider = (typeof PROVIDERS)[number]

/** Everything provider-specific in one place. */
export const PROVIDER_INFO: Record<Provider, { name: string; keyPage: string; keyHint: string }> = {
  groq: { name: 'Groq', keyPage: 'https://console.groq.com/keys', keyHint: 'gsk_…' },
  gemini: { name: 'Google', keyPage: 'https://aistudio.google.com/apikey', keyHint: 'AIza…' },
}

/** A call to Groq or Google that failed, and why; `retryAfterMs` when the provider said how long to wait. */
export class ProviderError<F extends string> extends Error {
  readonly failure: F
  readonly retryAfterMs: number | null
  constructor(failure: F, retryAfterMs: number | null = null) {
    super(failure)
    this.failure = failure
    this.retryAfterMs = retryAfterMs
  }
}

/** For a provider that is busy: how long it asked us to wait (null if it didn't say). Undefined for any other failure. */
export const busyFor = (e: unknown) => (e instanceof ProviderError && e.failure === 'busy' ? (e.retryAfterMs as number | null) : undefined)

/** Seconds from a Retry-After header, as milliseconds; null when absent or unreadable. */
export function retryAfterMs(res: Response) {
  const s = Number(res.headers.get('retry-after'))
  return Number.isFinite(s) && s > 0 ? s * 1000 : null
}

export const GROQ_API = 'https://api.groq.com/openai/v1'
export const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta'

/** `busy`: the provider answered but could not serve us right now (rate limit, outage). */
export type KeyCheck = 'ok' | 'rejected' | 'busy' | 'unreachable'

/** Asks the provider to list its models with this key: the cheapest call that proves the key works. */
export async function checkKey(fetch: Fetch, provider: Provider, key: string): Promise<KeyCheck> {
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
  return 'busy'
}
