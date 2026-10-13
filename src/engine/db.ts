// Minimal promise wrapper over an injected IndexedDB factory, so tests can give every
// simulated device its own database.

export const DB_NAME = 'mulakhas'
const DB_VERSION = 2

/**
 * history: saved Results (keyPath id)
 * thread:  the current Thread, one record under the key "current"
 * blobs:   the Voice note and Video files, keyed by Message id
 */
export type StoreName = 'history' | 'thread' | 'blobs'

export interface Db {
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined>
  getAll<T>(store: StoreName): Promise<T[]>
  /** `key` is for stores without a keyPath (thread, blobs). */
  put(store: StoreName, value: unknown, key?: IDBValidKey): Promise<void>
  putMany(store: StoreName, values: unknown[]): Promise<void>
  delete(store: StoreName, key: IDBValidKey): Promise<void>
}

export function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function openDb(factory: IDBFactory): Promise<Db> {
  const open = factory.open(DB_NAME, DB_VERSION)
  open.onupgradeneeded = () => {
    const db = open.result
    if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('thread')) db.createObjectStore('thread')
    if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
  }
  const db = await done(open)

  const write = async (store: StoreName, fn: (s: IDBObjectStore) => void) => {
    const tx = db.transaction(store, 'readwrite')
    fn(tx.objectStore(store))
    await committed(tx)
  }

  return {
    get: (store, key) => done(db.transaction(store).objectStore(store).get(key)),
    getAll: store => done(db.transaction(store).objectStore(store).getAll()),
    put: (store, value, key) => write(store, s => { s.put(value, key) }),
    putMany: (store, values) => write(store, s => { for (const v of values) s.put(v) }),
    delete: (store, key) => write(store, s => { s.delete(key) }),
  }
}

/**
 * A Voice note or Video as kept in `blobs`. Safari's private browsing won't store a Blob in
 * IndexedDB, so there the file's bytes are kept instead.
 */
type KeptFile = Blob | { bytes: ArrayBuffer; name: string; type: string; lastModified: number }

export async function keepFile(db: Db, id: string, file: File) {
  try {
    await db.put('blobs', file, id)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') throw e // the device is full: that is said as it is
    const kept: KeptFile = { bytes: await file.arrayBuffer(), name: file.name, type: file.type, lastModified: file.lastModified }
    await db.put('blobs', kept, id)
  }
}

export async function keptFile(db: Db, id: string): Promise<Blob | undefined> {
  const kept = await db.get<KeptFile>('blobs', id)
  return !kept || kept instanceof Blob ? kept : new File([kept.bytes], kept.name, { type: kept.type, lastModified: kept.lastModified })
}
