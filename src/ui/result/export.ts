import type { ReliabilityRow } from '@/engine'
import type { Strings } from '@/i18n/strings'
import { formatNumber } from '@/i18n/numbers'

/** One Reliability report row in words, shared by the screen and by Copy / Share. A Video Gemini watched has no measured clarity. */
export function reliabilityRow(r: ReliabilityRow, t: Strings, lang: string) {
  return {
    message: t.clarityOf(formatNumber(r.n, lang)),
    clarity: r.clarity === null ? '—' : `${formatNumber(r.clarity, lang)}%`,
    note: r.clarity === null ? t.watchedNotMeasured : null,
    unclear: r.unclear.join(' / '),
  }
}

/** The Result as plain Markdown for Copy and Share, with the Reliability report when it is shown. */
export function resultMarkdown(text: string, report: ReliabilityRow[] | undefined, t: Strings, lang: string, withReport: boolean) {
  if (!withReport || !report?.length) return text
  const rows = report.map(r => {
    const row = reliabilityRow(r, t, lang)
    return `- ${row.message} (${r.name}): ${row.note ?? row.clarity}${row.unclear ? `; ${t.unclearWords}: ${row.unclear}` : ''}`
  })
  return `${text}\n\n## ${t.reliability}\n${rows.join('\n')}`
}
