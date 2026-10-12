import type { Icon } from '@phosphor-icons/react'
import {
  CheckSquareIcon,
  CookingPotIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  TranslateIcon,
} from '@phosphor-icons/react'
import type { PresetId } from '@/engine/presets'

export const PRESET_ICON: Record<PresetId, Icon> = {
  recipe: CookingPotIcon,
  steps: ListNumbersIcon,
  todo: CheckSquareIcon,
  points: ListBulletsIcon,
  translate: TranslateIcon,
  exact: QuotesIcon,
}

/** Formats WhatsApp and phones produce; browsers label some of them inconsistently. */
export const MEDIA_ACCEPT = 'audio/*,video/*,.ogg,.opus,.oga,.m4a,.aac,.mp3,.wav,.mp4,.mov,.webm,.3gp'
