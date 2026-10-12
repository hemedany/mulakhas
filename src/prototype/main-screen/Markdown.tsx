// PROTOTYPE (ticket 02): tiny Markdown renderer for sample Results. Ticket 05 writes the real one.
import { Fragment, type ReactNode } from 'react'

const UNCLEAR = /(\[(?:unclear|غير واضح)[^\]]*\])/g
const IS_UNCLEAR = /^\[(?:unclear|غير واضح)/

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).flatMap((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return [<strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>]
    return part.split(UNCLEAR).map((seg, j) =>
      IS_UNCLEAR.test(seg) ? (
        <mark key={`${i}-${j}`} className="rounded-[0.35em] bg-caution/18 px-1 text-fg [box-decoration-break:clone]">
          {seg.slice(1, -1)}
        </mark>
      ) : (
        <Fragment key={`${i}-${j}`}>{seg}</Fragment>
      ),
    )
  })
}

export function Markdown({ source, titleClass = 'text-xl font-semibold' }: { source: string; titleClass?: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={blocks.length} className={`my-2 space-y-1.5 ps-5 ${list.ordered ? 'list-decimal marker:font-semibold marker:text-accent' : 'list-disc marker:text-fg-subtle'}`}>
        {list.items.map((it, i) => <li key={i} className="ps-1">{inline(it)}</li>)}
      </Tag>,
    )
    list = null
  }
  for (const line of source.split('\n')) {
    let m: RegExpMatchArray | null
    if ((m = line.match(/^#\s+(.*)/))) { flush(); blocks.push(<h2 key={blocks.length} className={`${titleClass} mb-3 text-balance`}>{m[1]}</h2>) }
    else if ((m = line.match(/^\s*[-•]\s+(.*)/))) { if (list?.ordered) flush(); list ??= { ordered: false, items: [] }; list.items.push(m[1]) }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list && !list.ordered) flush(); list ??= { ordered: true, items: [] }; list.items.push(m[1]) }
    else if (!line.trim()) flush()
    else { flush(); blocks.push(<p key={blocks.length} className="my-2">{inline(line)}</p>) }
  }
  flush()
  return <>{blocks}</>
}
