import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { usePrefs } from '@/app/engine-hooks'
import { useT } from '@/i18n/i18n'
import { formatNumber } from '@/i18n/numbers'
import { formatDuration } from './time'
import { useMediaUrl } from './useMediaUrl'

/** Plays a Voice note from the device. The track is honest: it only shows how far playback has got. */
export function Player({ id, n, knownSeconds }: { id: string; n: number; knownSeconds?: number }) {
  const t = useT()
  const { uiLang } = usePrefs()
  const number = formatNumber(n, uiLang)
  const url = useMediaUrl(id)
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [metadataSeconds, setMetadataSeconds] = useState(0)
  // Whisper's measured duration wins; until then, whatever the browser reads from the file.
  const duration = knownSeconds ?? metadataSeconds

  return (
    <div className="flex items-center gap-2.5">
      <button type="button" aria-label={playing ? t.pauseMessage(number) : t.playMessage(number)} disabled={!url}
        onClick={() => { const a = audio.current; if (!a) return; if (a.paused) void a.play(); else a.pause() }}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent transition-transform duration-(--duration-press) ease-snappy motion-safe:active:scale-[0.92] disabled:opacity-50">
        {playing ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
      </button>
      <div className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="absolute inset-y-0 start-0 rounded-full bg-accent" style={{ width: duration ? `${Math.min(100, (position / duration) * 100)}%` : '0%' }} />
      </div>
      <span className="tabular shrink-0 text-xs text-fg-muted">{formatDuration(playing || position ? position : duration)}</span>
      {url && (
        <audio ref={audio} src={url} preload="metadata"
          onLoadedMetadata={e => { if (Number.isFinite(e.currentTarget.duration)) setMetadataSeconds(e.currentTarget.duration) }}
          onTimeUpdate={e => setPosition(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setPosition(0) }} />
      )}
    </div>
  )
}
