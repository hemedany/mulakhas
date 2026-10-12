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
