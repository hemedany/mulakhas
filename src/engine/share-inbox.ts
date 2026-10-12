// Share-in: Android's share sheet POSTs files to the installed app; the service worker
// (public/sw.js) puts them in this inbox and reloads the page. The engine empties the inbox
// into the Thread every time it starts, so each share adds to the Thread instead of wiping it.

const INBOX_DB = 'mulakhas-share'
const INBOX_STORE = 'files'

interface InboxEntry {
  name: string
  type: string
  blob: Blob
  /** When it arrived (ms since epoch). */
  t: number
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(INBOX_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(INBOX_STORE, { autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Everything shared in since the last start, in the order it arrived. Does not remove it yet. */
export async function readInbox(factory: IDBFactory): Promise<{ files: File[]; clear: () => Promise<void> }> {
  const db = await open(factory)
  const entries: { key: IDBValidKey; value: InboxEntry }[] = await new Promise((resolve, reject) => {
    const found: { key: IDBValidKey; value: InboxEntry }[] = []
    const req = db.transaction(INBOX_STORE).objectStore(INBOX_STORE).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return resolve(found)
      found.push({ key: cursor.key, value: cursor.value })
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
  const files = entries.map(({ value }) => new File([value.blob], value.name || 'shared-audio', { type: value.type || value.blob.type, lastModified: value.t }))
  return {
    files,
    // Only called once the files are safely in the Thread, so a crash in between loses nothing.
    clear: () => new Promise((resolve, reject) => {
      const tx = db.transaction(INBOX_STORE, 'readwrite')
      for (const { key } of entries) tx.objectStore(INBOX_STORE).delete(key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }),
  }
}
