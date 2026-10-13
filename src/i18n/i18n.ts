import { usePrefs } from '@/app/engine-hooks'
import { STRINGS, type Strings } from './strings'

/** Strings for the current interface language. */
export function useT(): Strings {
  return STRINGS[usePrefs().uiLang]
}
