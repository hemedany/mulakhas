import { useEffect, useState } from 'react'
import { useEngine } from '@/app/engine-hooks'

/** An object URL for a Message's saved file, revoked when no longer shown. */
export function useMediaUrl(id: string) {
  const { thread } = useEngine()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    thread.media(id).then(blob => {
      if (!alive || !blob) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [thread, id])
  return url
}
