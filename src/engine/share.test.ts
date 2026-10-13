import { IDBObjectStore } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { groqChatModels, verboseJson, voiceNote, whisperBy, writerBy } from './fixtures'
import { createEngine, type EngineDeps } from './index'
import { INBOX_STORE, openInbox, type InboxEntry } from './share-inbox'
import { deviceWithKey, fakeNetwork, freshDevice, names } from './testing'
import SERVICE_WORKER from '../../public/sw.js?raw'

const SCOPE = 'https://hemedany.github.io/mulakhas/'

/**
 * The real public/sw.js, run against a device's IndexedDB: what Android does when a voice note is
 * shared from WhatsApp into the installed app. Answers with the worker's redirect.
 */
async function share(device: EngineDeps, files: File[] | 'unreadable'): Promise<Response> {
  const listeners: Record<string, (event: object) => void> = {}
  const self = {
    registration: { scope: SCOPE },
    location: new URL(SCOPE),
    addEventListener: (type: string, listener: (event: object) => void) => { listeners[type] = listener },
  }
  new Function('self', 'indexedDB', SERVICE_WORKER)(self, device.indexedDB)

  let body: FormData | string = 'not a form'
  if (files !== 'unreadable') {
    body = new FormData()
    for (const f of files) body.append('media', f)
  }
  let answer: Promise<Response> | undefined
  listeners.fetch({ request: new Request(`${SCOPE}share-target`, { method: 'POST', body }), respondWith: (r: Promise<Response>) => { answer = r } })
  return answer!
}

afterEach(() => { vi.restoreAllMocks() })

describe('Share-ins from WhatsApp', () => {
  it('collects two Voice notes shared one after the other, across the reload each share causes', async () => {
    const device = freshDevice()
    await createEngine(device) // the app was open once

    const first = await share(device, [voiceNote('PTT-20261011-WA0003.opus', 1, 'audio/ogg')])
    expect([first.status, first.headers.get('location')]).toEqual([303, SCOPE])
    const afterFirst = await createEngine(device) // the redirect reloads the page
    expect(names(afterFirst)).toEqual(['PTT-20261011-WA0003.opus'])

    await share(device, [voiceNote('PTT-20261011-WA0004.opus', 2, 'audio/ogg')])
    const afterSecond = await createEngine(device)
    expect(names(afterSecond)).toEqual(['PTT-20261011-WA0003.opus', 'PTT-20261011-WA0004.opus'])

    // The inbox is emptied, so a plain reload adds nothing twice.
    expect(names(await createEngine(device))).toHaveLength(2)
  })

  it('starts hearing a Share-in straight away', async () => {
    const net = fakeNetwork()
    net.on(whisperBy({ 'PTT-20261011-WA0003.ogg': verboseJson([{ text: ' يا بنتي', start: 0, end: 2 }]) }))
    const device = deviceWithKey(net)

    await share(device, [voiceNote('PTT-20261011-WA0003.opus', 1, 'audio/ogg')])
    const engine = await createEngine(device)
    await engine.thread.idle()

    expect(engine.thread.get().messages[0]).toMatchObject({ state: 'heard' })
    expect(engine.sharedIn).toMatchObject({ count: 1, failed: false })
  })

  it('names a Share-in that came without a name for what it is', async () => {
    const device = freshDevice()
    // Browsers can hand the worker a file named "" (a form in Node can't), so this one goes straight into the inbox.
    const inbox = await openInbox(device.indexedDB)
    const entry: InboxEntry = { name: '', type: 'video/mp4', blob: new Blob([new Uint8Array([0, 0, 0, 24])], { type: 'video/mp4' }), lastModified: 1 }
    await new Promise(resolve => { inbox.transaction(INBOX_STORE, 'readwrite').objectStore(INBOX_STORE).add(entry).onsuccess = resolve })
    inbox.close()

    const engine = await createEngine(device)

    expect(engine.thread.get().messages[0]).toMatchObject({ kind: 'video', name: 'video', type: 'video/mp4' })
  })

  it('opens the app saying the share failed when the worker could not read it', async () => {
    const device = freshDevice()

    const answer = await share(device, 'unreadable')

    expect([answer.status, answer.headers.get('location')]).toEqual([303, `${SCOPE}?share-failed`])
  })

  it('does not add a Share-in twice when the page closed before the inbox was emptied', async () => {
    const device = freshDevice()
    await share(device, [voiceNote('PTT-20261012-WA0001.opus', 1, 'audio/ogg')])
    // The Share-in reaches the Thread, then the page closes before the inbox is emptied.
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => { throw new DOMException('closing', 'AbortError') })
    await expect(createEngine(device)).rejects.toThrow()
    vi.restoreAllMocks()

    expect(names(await createEngine(device))).toEqual(['PTT-20261012-WA0001.opus'])
  })

  it('still opens when the device cannot keep a Share-in, says so, and does not try again on every start', async () => {
    const device = freshDevice()
    await share(device, [voiceNote('PTT-20261012-WA0001.opus', 1, 'audio/ogg')])
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'blobs') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      return put.apply(this, args)
    })

    const engine = await createEngine(device)

    expect(engine.sharedIn).toMatchObject({ count: 1, failed: true })
    vi.restoreAllMocks()
    expect((await createEngine(device)).sharedIn).toMatchObject({ count: 0, failed: false })
  })

  it('starts a fresh Thread when a Share-in arrives after a Result, keeping that Result in History', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': verboseJson([{ text: ' first', start: 0, end: 1 }]), 'PTT-20261012-WA0001.ogg': verboseJson([{ text: ' next', start: 0, end: 1 }]) }))
    net.on(writerBy('# Yesterday’s recipe'))
    const device = deviceWithKey(net)
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })

    await share(device, [voiceNote('PTT-20261012-WA0001.opus', 5, 'audio/ogg')])
    const reopened = await createEngine(device)

    expect(names(reopened)).toEqual(['PTT-20261012-WA0001.opus'])
    expect(reopened.thread.get().result).toBeNull()
    expect((await reopened.history.list()).map(r => r.title)).toEqual(['Yesterday’s recipe'])
  })

  it('keeps the Result in History even when the page closed before it was saved there', async () => {
    const net = fakeNetwork()
    net.on(groqChatModels)
    net.on(whisperBy({ 'a.ogg': verboseJson([{ text: ' first', start: 0, end: 1 }]) }))
    net.on(writerBy('# Only in the Thread'))
    const device = deviceWithKey(net)
    const engine = await createEngine(device)
    await engine.thread.addFiles([voiceNote('a.ogg', 1)])
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      if (this.name === 'history') throw new DOMException('closing', 'AbortError')
      return put.apply(this, args)
    })
    await engine.thread.summarize({ mode: 'summary', preset: null, request: '' })
    vi.restoreAllMocks()
    expect(await engine.history.list()).toEqual([])

    await share(device, [voiceNote('PTT-20261012-WA0001.opus', 5, 'audio/ogg')])
    const reopened = await createEngine(device)

    expect((await reopened.history.list()).map(r => r.title)).toEqual(['Only in the Thread'])
  })
})
