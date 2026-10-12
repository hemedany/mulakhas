// PROTOTYPE (ticket 02), variant C "Intent": intent-first, big targets. The Thread shrinks to
// a strip; the screen asks one question and answers it with large preset tiles (tap = go).
// The Result rises as a sheet over the page.
import type { Icon } from '@phosphor-icons/react'
import {
  ArrowUpIcon,
  CheckSquareIcon,
  ClockCounterClockwiseIcon,
  CookingPotIcon,
  CopyIcon,
  GlobeIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  MicrophoneIcon,
  PlusIcon,
  QuestionIcon,
  QuotesIcon,
  ShareNetworkIcon,
  TranslateIcon,
  XIcon,
} from '@phosphor-icons/react'
import { KhatamMark } from '@/brand/Khatam'
import { IconButton, StateTag } from './atoms'
import { KIND_ICON } from './kinds'
import { Markdown } from './Markdown'
import { duration, type SampleCopy, type SampleMessage } from './sample'
import type { VariantProps } from './types'

export const name = 'Intent'

const PRESET_ICON: Record<string, Icon> = {
  recipe: CookingPotIcon,
  steps: ListNumbersIcon,
  todo: CheckSquareIcon,
  points: ListBulletsIcon,
  translate: TranslateIcon,
  exact: QuotesIcon,
}

function Tile({ m, copy }: { m: SampleMessage; copy: SampleCopy }) {
  const Icon = KIND_ICON[m.kind]
  return (
    <li className="flex h-[5.5rem] w-32 shrink-0 snap-start flex-col justify-between rounded-card bg-surface p-3 shadow-raised">
      <div className="flex items-center justify-between">
        <Icon size={20} className="text-fg-muted" />
        {m.kind !== 'text' && <span className="tabular text-xs text-fg-muted">{duration(m.seconds)}</span>}
      </div>
      {m.kind === 'text' ? <p className="line-clamp-2 text-xs leading-4">{m.text}</p> : <StateTag message={m} copy={copy} />}
    </li>
  )
}

export default function VariantIntent({ copy, thread, state, onSummarize, onReset }: VariantProps) {
  const messages = state === 'empty' ? [] : thread
  const ready = messages.length > 0

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between px-3 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 ps-1">
          <KhatamMark size={26} className="text-fg" />
          <span className="text-lg font-semibold tracking-tight">{copy.appName}</span>
        </div>
        <nav className="flex items-center">
          <IconButton icon={ClockCounterClockwiseIcon} label={copy.history} />
          <IconButton icon={GlobeIcon} label={copy.language} />
          <IconButton icon={QuestionIcon} label={copy.help} />
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-xl">
          <section aria-label={copy.messages} className="pt-2">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-sm font-medium text-fg-muted">{ready ? copy.messagesCount(messages.length) : copy.messages}</h2>
            </div>
            <ol className="mt-2 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
              {messages.map((m, i) => <Tile key={i} m={m} copy={copy} />)}
              <li className="shrink-0 snap-start">
                <button type="button" className={`flex h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-line-strong text-sm font-medium text-fg-muted transition-transform duration-150 active:scale-[0.97] ${ready ? 'w-24' : 'w-[calc(100vw-2rem)] max-w-[34rem]'}`}>
                  <PlusIcon size={20} />
                  {ready ? '' : copy.addMessages}
                </button>
              </li>
            </ol>
            {!ready && <p className="px-4 text-sm text-fg-muted">{copy.emptyBody}</p>}
          </section>

          <section className="px-4 pt-7">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{copy.whatDoYouWant}</h1>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {copy.presets.map(p => {
                const Icon = PRESET_ICON[p.id]
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!ready}
                    onClick={onSummarize}
                    className="group flex min-h-[6.5rem] flex-col items-start justify-between rounded-card border border-line bg-surface p-3.5 text-start transition-[transform,border-color,background-color] duration-150 ease-snappy active:scale-[0.97] enabled:hover:border-accent disabled:opacity-45"
                  >
                    <Icon size={26} className="text-accent" />
                    <span>
                      <span className="block font-semibold">{p.label}</span>
                      <span className="block text-sm text-fg-muted">{p.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <label className="relative mt-3 block">
              <span className="sr-only">{copy.requestLabel}</span>
              <input disabled={!ready} placeholder={copy.somethingElse}
                className="h-14 w-full rounded-card border border-line bg-surface ps-4 pe-24 placeholder:text-fg-subtle focus:border-accent focus:outline-none disabled:opacity-45" />
              <span className="absolute end-1.5 top-1.5 flex gap-1">
                <IconButton icon={MicrophoneIcon} label="Dictate" />
                <button type="button" aria-label={copy.summarize} onClick={onSummarize} disabled={!ready}
                  className="grid size-11 place-items-center rounded-full bg-accent text-on-accent transition-transform duration-150 active:scale-[0.94] disabled:opacity-40">
                  <ArrowUpIcon size={18} weight="bold" />
                </button>
              </span>
            </label>
          </section>
        </div>
      </main>

      {state === 'result' && (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <button type="button" aria-label="Close" onClick={onReset} className="absolute inset-0 bg-fg/25" />
          <section role="dialog" aria-label={copy.result}
            className="relative mx-auto flex max-h-[90%] w-full max-w-2xl flex-col rounded-t-sheet bg-surface shadow-floating">
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
            <div className="flex items-center justify-between px-4 pt-1">
              <span className="text-sm font-medium text-fg-muted">{copy.result}</span>
              <IconButton icon={XIcon} label="Close" onClick={onReset} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              <Markdown source={copy.resultMd} titleClass="text-2xl font-semibold tracking-tight" />
            </div>
            <div className="border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="flex gap-2">
                <button type="button" className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control bg-fg font-medium text-bg active:scale-[0.98]"><CopyIcon size={18} />{copy.copy}</button>
                <button type="button" className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control border border-line font-medium active:scale-[0.98]"><ShareNetworkIcon size={18} />{copy.share}</button>
              </div>
              <label className="relative mt-2.5 block">
                <span className="sr-only">{copy.followUp}</span>
                <input placeholder={copy.followUp} className="h-12 w-full rounded-control border border-line bg-sunken ps-3.5 pe-12 placeholder:text-fg-subtle focus:border-accent focus:outline-none" />
                <span className="absolute end-0.5 top-0.5"><IconButton icon={MicrophoneIcon} label="Dictate" /></span>
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
