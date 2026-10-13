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
