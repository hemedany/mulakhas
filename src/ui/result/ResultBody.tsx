import { CheckIcon, CopyIcon, ShareNetworkIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { OrnamentRule } from '@/brand/Ornament'
import { usePrefs } from '@/app/engine-hooks'
import type { ReliabilityRow } from '@/engine'
import { useT } from '@/i18n/i18n'
import { formatNumber } from '@/i18n/numbers'
import { Markdown } from '../Markdown'
import { resultMarkdown } from './export'

function Reliability({ report }: { report: ReliabilityRow[] }) {
  const t = useT()
  const { uiLang } = usePrefs()
  return (
    <section aria-labelledby="reliability-title">
      <OrnamentRule className="my-6" />
      <h3 id="reliability-title" className="font-semibold">{t.reliability}</h3>
      <p className="mt-0.5 text-sm text-fg-muted">{t.reliabilityIntro}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {report.map(r => (
          <li key={r.n} className="flex gap-3">
            <span className="tabular w-11 shrink-0 font-semibold">{formatNumber(r.clarity, uiLang)}%</span>
            <span className="min-w-0">
              <span className="block">{t.clarityOf(formatNumber(r.n, uiLang))} <span className="text-fg-subtle" dir="ltr">({r.name})</span></span>
              {r.unclear.length > 0 && (
                <span className="block text-fg-muted">{t.unclearWords}: <bdi>{r.unclear.join(' / ')}</bdi></span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** A Result: its Markdown, the optional Reliability report, and Copy / Share. */
export function ResultBody({ text, report, titleClass }: { text: string; report?: ReliabilityRow[]; titleClass?: string }) {
  const t = useT()
  const { uiLang, showReliability } = usePrefs()
  const [copied, setCopied] = useState(false)
  const plain = resultMarkdown(text, report, t, uiLang, showReliability)

  return (
    <div>
      <div className="text-base"><Markdown source={text} titleClass={titleClass} /></div>
      {showReliability && report && report.length > 0 && <Reliability report={report} />}
      <div className="mt-6 flex gap-2">
        <button type="button"
          onClick={async () => { await navigator.clipboard.writeText(plain); setCopied(true); setTimeout(() => setCopied(false), 1600) }}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control bg-accent px-5 font-medium text-on-accent transition-transform duration-(--duration-press) active:scale-[0.98] lg:flex-none">
          {copied ? <CheckIcon size={18} weight="bold" /> : <CopyIcon size={18} />}
          <span aria-live="polite">{copied ? t.copied : t.copy}</span>
        </button>
        {'share' in navigator && (
          <button type="button" onClick={() => navigator.share({ text: plain }).catch(() => {})}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control border border-line px-5 font-medium transition-transform duration-(--duration-press) active:scale-[0.98] lg:flex-none">
            <ShareNetworkIcon size={18} />{t.share}
          </button>
        )}
      </div>
    </div>
  )
}
