// Renders a Result's Markdown into React elements (never HTML strings). Each block sets its
// own direction, so an Arabic Result with English names, or the reverse, reads correctly.
import { Fragment, type ReactNode } from 'react'

// "[unclear: maybe ½]" or "[غير واضح: ربما نصف]", and "[unclear]" on its own.
const UNCLEAR = /(\[(?:unclear|غير واضح|peu clair|unklar|net değil|poco claro)[^\]]*\])/gi
const IS_UNCLEAR = /^\[(?:unclear|غير واضح|peu clair|unklar|net değil|poco claro)/i

function marks(text: string, key: string): ReactNode[] {
  return text.split(UNCLEAR).map((part, i) =>
    IS_UNCLEAR.test(part)
      ? <mark key={`${key}-${i}`} className="rounded-sm bg-caution/20 px-1 text-fg [box-decoration-break:clone]">{part.slice(1, -1)}</mark>
      : <Fragment key={`${key}-${i}`}>{part}</Fragment>,
  )
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).flatMap((part, i): ReactNode[] => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return [<strong key={i} className="font-semibold">{marks(part.slice(2, -2), String(i))}</strong>]
    if (/^`[^`]+`$/.test(part)) return [<code key={i} className="rounded-sm bg-sunken px-1 text-[0.9em]">{part.slice(1, -1)}</code>]
    if (/^\*[^*\s][^*]*\*$/.test(part)) return [<em key={i}>{marks(part.slice(1, -1), String(i))}</em>]
    return marks(part, String(i))
  })
}

const Star = () => (
  <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-ornament" aria-hidden="true"><path d="M12 1 15 9 23 12 15 15 12 23 9 15 1 12 9 9Z" fill="currentColor" /></svg>
)

export function Markdown({ source, titleClass = 'font-display text-2xl leading-tight font-semibold' }: { source: string; titleClass?: string }) {
  const blocks: ReactNode[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let paragraph: string[] = []
  const key = () => blocks.length

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={key()} dir="auto" className="my-2">{inline(paragraph.join(' '))}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((it, i) => <li key={i} dir="auto" className="ps-1">{inline(it)}</li>)
    blocks.push(list.ordered
      ? <ol key={key()} className="my-2 list-decimal space-y-1.5 ps-5 marker:font-semibold marker:text-accent [:lang(ar)_&]:list-[arabic-indic]">{items}</ol>
      : <ul key={key()} className="my-2 list-disc space-y-1.5 ps-5 marker:text-fg-subtle">{items}</ul>)
    list = null
  }
  const flush = () => { flushParagraph(); flushList() }

  for (const raw of source.split('\n')) {
    const line = raw.trimEnd()
    let m: RegExpMatchArray | null
    if ((m = line.match(/^#\s+(.+)/))) { flush(); blocks.push(<h2 key={key()} dir="auto" className={`${titleClass} mb-3 text-balance`}>{inline(m[1])}</h2>) }
    else if ((m = line.match(/^#{2,3}\s+(.+)/)) || (m = line.match(/^\*\*([^*]+)\*\*:?$/))) {
      flush()
      blocks.push(<h3 key={key()} dir="auto" className="mt-5 mb-1.5 flex items-center gap-2 font-semibold"><Star />{inline(m[1])}</h3>)
    }
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flush(); blocks.push(<hr key={key()} className="my-4 border-line" />) }
    else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { flushParagraph(); if (list?.ordered) flushList(); list ??= { ordered: false, items: [] }; list.items.push(m[1]) }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { flushParagraph(); if (list && !list.ordered) flushList(); list ??= { ordered: true, items: [] }; list.items.push(m[1]) }
    else if (!line.trim()) flush()
    else { flushList(); paragraph.push(line.trim()) }
  }
  flush()
  return <>{blocks}</>
}
