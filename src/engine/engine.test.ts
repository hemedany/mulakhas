import { describe, expect, it } from 'vitest'
import { createEngine } from './index'
import { freshDevice } from './testing'

// What a v1 install left in localStorage (shapes copied from the v1 single-file app).
function v1Device() {
  const device = freshDevice()
  const ls = device.localStorage
  ls.setItem('hist', JSON.stringify([
    { d: 1783900000000, m: 'transcript', files: ['PTT-20260712-WA0003.opus'], title: 'Message 1 — voice', out: '### Message 1\nيا بنتي حطي البصل أول' },
    { d: 1783800000000, m: 'summary', files: ['PTT-1.opus', 'PTT-2.opus'], title: 'Kibbeh bil sanieh', out: '# Kibbeh bil sanieh\n- 500 g lamb' },
  ]))
  ls.setItem('uiLang', 'ar')
  ls.setItem('theme', 'dark')
  ls.setItem('gemKey', 'AIza-v1-saved-key')
  ls.setItem('tutSeen', '1')
  return device
}

describe('returning v1 users lose nothing', () => {
  it('keeps their saved Results, newest first, with text unchanged', async () => {
    const engine = await createEngine(v1Device())

    const saved = await engine.history.list()

    expect(saved.map(r => r.title)).toEqual(['Message 1 — voice', 'Kibbeh bil sanieh'])
    expect(saved[0]).toMatchObject({
      mode: 'exact',
      files: ['PTT-20260712-WA0003.opus'],
      text: '### Message 1\nيا بنتي حطي البصل أول',
      createdAt: 1783900000000,
    })
    expect(saved[1].mode).toBe('summary')
  })

  it('keeps their interface language and Gemini key', async () => {
    const engine = await createEngine(v1Device())

    expect(engine.prefs.get()).toMatchObject({ uiLang: 'ar', wasV1User: true })
    expect(engine.keys.get()).toEqual({ groq: null, gemini: 'AIza-v1-saved-key' })
  })

  // v1 saved the device's theme on every visit, so a saved theme only means a deliberate
  // choice when it differs from what the device uses now.
  it('keep a theme they deliberately switched to', async () => {
    const device = { ...v1Device(), prefersDarkScheme: false }

    const engine = await createEngine(device)

    expect(engine.prefs.get().theme).toBe('dark')
  })

  it('follow the device theme when v1 had only recorded the device default', async () => {
    const device = { ...v1Device(), prefersDarkScheme: true }

    const engine = await createEngine(device)

    expect(engine.prefs.get().theme).toBe('system')
  })

  it('can still roll back to v1: its settings are never overwritten', async () => {
    const device = v1Device()
    const engine = await createEngine(device)

    engine.prefs.set({ uiLang: 'fr', theme: 'system' })

    expect(device.localStorage.getItem('uiLang')).toBe('ar')
    expect(device.localStorage.getItem('theme')).toBe('dark')
  })

  it('migrates once and leaves the v1 data in place as a backup', async () => {
    const device = v1Device()
    await createEngine(device)
    const reopened = await createEngine(device)

    expect(await reopened.history.list()).toHaveLength(2)
    expect(JSON.parse(device.localStorage.getItem('hist')!)).toHaveLength(2)
    expect(device.localStorage.getItem('gemKey')).toBe('AIza-v1-saved-key')
  })

  it('survives a corrupted v1 history without losing the rest', async () => {
    const device = v1Device()
    device.localStorage.setItem('hist', '{not json')

    const engine = await createEngine(device)

    expect(await engine.history.list()).toEqual([])
    expect(engine.prefs.get().uiLang).toBe('ar')
    expect(device.localStorage.getItem('hist')).toBe('{not json')
  })
})

describe('first-time visitors', () => {
  it('start in the browser language when Mulakhas speaks it', async () => {
    const engine = await createEngine(freshDevice({ languages: ['fr-FR', 'en'] }))

    expect(engine.prefs.get()).toEqual({ uiLang: 'fr', theme: 'system', wasV1User: false, showReliability: true, markSeen: false, tutorialSeen: false, makeoverSeen: false })
  })

  it('fall back to English for languages Mulakhas does not speak', async () => {
    const engine = await createEngine(freshDevice({ languages: ['ja-JP'] }))

    expect(engine.prefs.get().uiLang).toBe('en')
  })

  it('have no keys and no saved Results', async () => {
    const engine = await createEngine(freshDevice())

    expect(engine.keys.get()).toEqual({ groq: null, gemini: null })
    expect(await engine.history.list()).toEqual([])
  })
})

describe('preferences', () => {
  it('persist across a reload', async () => {
    const device = freshDevice()
    const engine = await createEngine(device)

    engine.prefs.set({ uiLang: 'tr', theme: 'light', showReliability: false })
    const reopened = await createEngine(device)

    expect(reopened.prefs.get()).toMatchObject({ uiLang: 'tr', theme: 'light', showReliability: false })
  })

  it('notify subscribers when they change', async () => {
    const engine = await createEngine(freshDevice())
    const seen: string[] = []
    engine.prefs.subscribe(p => seen.push(p.uiLang))

    engine.prefs.set({ uiLang: 'de' })

    expect(seen).toEqual(['de'])
  })
})

describe('the first-visit welcome', () => {
  it('is the tutorial for someone new, once', async () => {
    const device = freshDevice()
    const engine = await createEngine(device)
    expect(engine.prefs.welcome()).toBe('tutorial')

    engine.prefs.welcomed()

    expect((await createEngine(device)).prefs.welcome()).toBeNull()
  })

  it('is the makeover card instead for someone who used Mulakhas before, once', async () => {
    const device = freshDevice()
    device.localStorage.setItem('gemKey', 'AIza_old_v1_key') // v1's data
    const engine = await createEngine(device)
    expect(engine.prefs.welcome()).toBe('makeover')

    engine.prefs.welcomed()

    expect((await createEngine(device)).prefs.welcome()).toBeNull()
  })
})

