/** Interface languages Mulakhas speaks, in menu order. */
export const LANGS = ['en', 'ar', 'fr', 'de', 'tr', 'es'] as const
export type Lang = (typeof LANGS)[number]

export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
  tr: 'Türkçe',
  es: 'Español',
}

export const RTL_LANGS: ReadonlySet<Lang> = new Set(['ar'])

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value)
}

/** The first browser language Mulakhas speaks, or English. */
export function pickLang(browserLanguages: readonly string[]): Lang {
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0]
    if (isLang(base)) return base
  }
  return 'en'
}
