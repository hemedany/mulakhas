import { useState } from 'react'
import { KhatamMark } from '@/brand/Khatam'
import { useT } from '@/i18n/i18n'
import { canReceiveShares } from '../platform'
import { Sheet } from '../Sheet'

/** For someone who used Mulakhas before: what changed, once, instead of the tutorial. */
export function MakeoverSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const [sharing] = useState(canReceiveShares)
  const { look, groq, share, more } = t.makeover.points
  return (
    <Sheet open={open} onClose={onClose} title={t.makeover.title} closeLabel={t.close} footer={
      <button type="button" onClick={onClose}
        className="h-12 w-full rounded-full bg-accent px-5 font-medium text-on-accent transition-[scale] duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.98]">{t.makeover.ok}</button>
    }>
      <ul className="space-y-3">
        {[look, groq, ...(sharing ? [share] : []), more].map(point => (
          <li key={point} className="flex gap-2.5">
            <KhatamMark size={18} className="mt-0.5 shrink-0 text-ornament" />
            <span className="text-pretty">{point}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
