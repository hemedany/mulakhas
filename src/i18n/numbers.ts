/**
 * Numbers in the reader's own digits. Arabic counts in Arabic-Indic digits (١٢٣), as in the
 * Levant; CLDR now defaults plain "ar" to Latin digits, so this is set explicitly.
 */
export function formatNumber(n: number, lang: string, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(lang, lang === 'ar' ? { numberingSystem: 'arab', ...options } : options).format(n)
}

/** A whole percentage (0..100) as the language writes it: "92%", "٩٢٪", "92 %", "%92". */
export const formatPercent = (n: number, lang: string) => formatNumber(n / 100, lang, { style: 'percent', maximumFractionDigits: 0 })
