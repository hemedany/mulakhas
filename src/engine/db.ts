// Minimal promise wrapper over an injected IndexedDB factory, so tests can give every
// simulated device its own database.

export const DB_NAME = 'mulakhas'
const DB_VERSION = 1

export type StoreName = 'history'

export interface Db {
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined>
  getAll<T>(store: StoreName): Promise<T[]>
  put<T>(store: StoreName, value: T): Promise<void>
  putMany<T>(store: StoreName, values: T[]): Promise<void>
  delete(store: StoreName, key: IDBValidKey): Promise<void>
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function committed(tx: IDBTransaction): Promise<void> {
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
  }
  const db = await done(open)

  return {
    get: (store, key) => done(db.transaction(store).objectStore(store).get(key)),
    getAll: (store) => done(db.transaction(store).objectStore(store).getAll()),
    async put(store, value) {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value)
      await committed(tx)
    },
    async putMany(store, values) {
      const tx = db.transaction(store, 'readwrite')
      for (const v of values) tx.objectStore(store).put(v)
      await committed(tx)
    },
    async delete(store, key) {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).delete(key)
      await committed(tx)
    },
  }
}
