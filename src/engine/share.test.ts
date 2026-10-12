import { describe, expect, it } from 'vitest'
import { groqChatModels, verboseJson, voiceNote, whisperBy, writerBy } from './fixtures'
import { createEngine, type EngineDeps } from './index'
import { fakeNetwork, freshDevice } from './testing'

/**
 * What the service worker does when WhatsApp shares into the installed app (public/sw.js):
 * it puts the files in the "mulakhas-share" inbox, then the page reloads.
 */
async function shareIn(device: EngineDeps, files: File[]) {
  const db: IDBDatabase = await new Promise((resolve, reject) => {
    const open = device.indexedDB.open('mulakhas-share', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('files', { autoIncrement: true })
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite')
    for (const f of files) tx.objectStore('files').add({ name: f.name, type: f.type, blob: f, t: f.lastModified })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

const names = (engine: Awaited<ReturnType<typeof createEngine>>) =>
  engine.thread.get().messages.map(m => (m.kind === 'text' ? m.text : m.name))

describe('Share-ins from WhatsApp', () => {
  it('collects two Voice notes shared one after the other, across the reload each share causes', async () => {
    const device = freshDevice()
    await createEngine(device) // the app was open once

    await shareIn(device, [voiceNote('PTT-20261011-WA0003.opus', 1, 'audio/ogg')])
    const afterFirst = await createEngine(device) // sharing reloads the page
    expect(names(afterFirst)).toEqual(['PTT-20261011-WA0003.opus'])

    await shareIn(device, [voiceNote('PTT-20261011-WA0004.opus', 2, 'audio/ogg')])
    const afterSecond = await createEngine(device)
    expect(names(afterSecond)).toEqual(['PTT-20261011-WA0003.opus', 'PTT-20261011-WA0004.opus'])

    // The inbox is emptied, so a plain reload adds nothing twice.
    expect(names(await createEngine(device))).toHaveLength(2)
  })

  it('starts hearing a Share-in straight away', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-20261011-WA0003.ogg': verboseJson([{ text: ' يا بنتي', start: 0, end: 2 }]) }))
    const device = freshDevice({ fetch: net.fetch })
    device.localStorage.setItem('m2.groqKey', 'gsk_test_key')

    await shareIn(device, [voiceNote('PTT-20261011-WA0003.opus', 1, 'audio/ogg')])
    const engine = await createEngine(device)
    await engine.thread.idle()

    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard' })
  })

  it('starts a fresh Thread when a Share-in arrives after a Result, keeping that Result in History', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': verboseJson([{ text: ' first', start: 0, end: 1 }]), 'PTT-20261012-WA0001.ogg': verboseJson([{ text: ' next', start: 0, end: 1 }]) }))
    net.on(writerBy('# Yesterday’s recipe'))
    const device = freshDevice({ fetch: net.fetch })
    device.localStorage.setItem('m2.groqKey', 'gsk_test_key')
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    await shareIn(device, [voiceNote('PTT-20261012-WA0001.opus', 5, 'audio/ogg')])
    const reopened = await createEngine(device)

    expect(names(reopened)).toEqual(['PTT-20261012-WA0001.opus'])
    expect(reopened.thread.get().result).toBeNull()
    expect((await reopened.history.list()).map(r => r.title)).toEqual(['Yesterday’s recipe'])
  })

  it('also starts fresh when files are added by hand after a Result', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': verboseJson([{ text: ' first', start: 0, end: 1 }]), 'b.ogg': verboseJson([{ text: ' next', start: 0, end: 1 }]) }))
    net.on(writerBy('# Done'))
    const device = freshDevice({ fetch: net.fetch })
    device.localStorage.setItem('m2.groqKey', 'gsk_test_key')
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    await engine.thread.summarize({ mode: 'summary', preset: null, request: 'keep it short' })

    await engine.thread.addFiles([voiceNote('b.ogg', 2)])

    expect(names(engine)).toEqual(['b.ogg'])
    expect(engine.thread.get().draft.request).toBe('')
  })

  it('clears everything on Start over', async () => {
    const device = freshDevice()
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    const [a] = engine.thread.get().messages

    await engine.thread.startOver()

    expect(names(await createEngine(device))).toEqual([])
    expect(await engine.thread.media(a.id)).toBeUndefined()
  })
})
