import type { ReliabilityRow } from '@/engine'
import type { Strings } from '@/i18n/strings'
import { formatNumber } from '@/i18n/numbers'

/** The Result as plain Markdown for Copy and Share, with the Reliability report when it is shown. */
export function resultMarkdown(text: string, report: ReliabilityRow[] | undefined, t: Strings, lang: string, withReport: boolean) {
  if (!withReport || !report?.length) return text
  const rows = report.map(r => {
    const unclear = r.unclear.length ? `; ${t.unclearWords}: ${r.unclear.join(' / ')}` : ''
    return `- ${t.clarityOf(formatNumber(r.n, lang))} (${r.name}): ${formatNumber(r.clarity, lang)}%${unclear}`
  })
  return `${text}\n\n## ${t.reliability}\n${rows.join('\n')}`
}
