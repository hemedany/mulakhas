/**
 * Numbers in the reader's own digits. Arabic counts in Arabic-Indic digits (١٢٣), as in the
 * Levant; CLDR now defaults plain "ar" to Latin digits, so this is set explicitly.
 */
export function formatNumber(n: number, lang: string, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(lang, lang === 'ar' ? { numberingSystem: 'arab', ...options } : options).format(n)
}
