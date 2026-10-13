import { CheckIcon, CopyIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useT } from '@/i18n/i18n'

/** Copies `text`, and says "Copied" for a moment. A clipboard the browser refuses copies nothing and claims nothing. */
export function CopyButton({ text, label, className, iconSize = 18 }: { text: string; label?: string; className: string; iconSize?: number }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Nothing to say beyond not saying "Copied".
    }
  }
  return (
    <button type="button" onClick={copy} aria-label={label} className={className}>
      {copied ? <CheckIcon size={iconSize} weight="bold" /> : <CopyIcon size={iconSize} />}
      <span aria-live="polite">{copied ? t.copied : t.copy}</span>
    </button>
  )
}
