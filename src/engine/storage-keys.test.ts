import { describe, expect, it } from 'vitest'
// public/theme.js runs before the page is drawn, before the app can, so it can't import the keys and
// languages below and repeats them instead.
import beforePaint from '../../public/theme.js?raw'
import { RTL_LANGS } from './langs'
import { KEYS } from './storage-keys'

describe('the script that runs before the page is drawn', () => {
  it('reads the theme and language from the keys the app keeps them under', () => {
    expect(beforePaint).toContain(`localStorage.getItem("${KEYS.theme}")`)
    expect(beforePaint).toContain(`localStorage.getItem("${KEYS.uiLang}")`)
  })

  it('reads right to left for the same languages as the app', () => {
    expect(beforePaint).toContain('html.dir = lang === "ar" ? "rtl" : "ltr"')
    expect([...RTL_LANGS]).toEqual(['ar'])
  })
})
