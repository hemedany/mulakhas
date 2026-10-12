// Share-in: Android's share sheet POSTs files to the installed app; the service worker
// (public/sw.js) puts them in this inbox and reloads the page. The engine empties the inbox
// into the Thread every time it starts, so each share adds to the Thread instead of wiping it.
import { committed, done } from './db'

export const INBOX_DB = 'mulakhas-share'
export const INBOX_STORE = 'files'

/** One shared file, as public/sw.js stores it. */
export interface InboxEntry {
  name: string
  type: string
  blob: Blob
  /** The file's own date, or when it arrived if it had none (ms since epoch). */
  lastModified: number
}

export interface ShareIn {
  /** Stable for this share, so adding it twice is harmless. */
  id: string
  file: File
}

export function openInbox(factory: IDBFactory): Promise<IDBDatabase> {
  const open = factory.open(INBOX_DB, 1)
  open.onupgradeneeded = () => open.result.createObjectStore(INBOX_STORE, { autoIncrement: true })
  return done(open)
}

/** Everything shared in since the last start, in the order it arrived. Does not remove it yet. */
export async function readInbox(factory: IDBFactory): Promise<{ shareIns: ShareIn[]; clear: () => Promise<void> }> {
  const db = await openInbox(factory)
  // One transaction, so a share landing meanwhile can't put the keys and the entries out of step.
  const store = db.transaction(INBOX_STORE).objectStore(INBOX_STORE)
  const [keys, entries] = await Promise.all([done(store.getAllKeys()), done(store.getAll() as IDBRequest<InboxEntry[]>)])
  const shareIns = entries.map((entry, i) => {
    const type = entry.type || entry.blob.type
    // A file shared without a name is named for what it is; asUpload adds the extension Groq needs.
    const name = entry.name || (type.startsWith('video/') ? 'video' : 'voice-note')
    return { id: `share-${String(keys[i])}`, file: new File([entry.blob], name, { type, lastModified: entry.lastModified }) }
  })
  return {
    shareIns,
    // Only called once the files are safely in the Thread (or can't be), so a crash in between loses nothing.
    async clear() {
      const tx = db.transaction(INBOX_STORE, 'readwrite')
      for (const key of keys) tx.objectStore(INBOX_STORE).delete(key)
      await committed(tx)
      db.close()
    },
  }
}
