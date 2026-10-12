// Minimal promise wrapper over an injected IndexedDB factory, so tests can give every
// simulated device its own database.

export const DB_NAME = 'mulakhas'
const DB_VERSION = 1

export type StoreName = 'history'

export interface Db {
  getAll<T>(store: StoreName): Promise<T[]>
  putMany<T>(store: StoreName, values: T[]): Promise<void>
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
    getAll: (store) => done(db.transaction(store).objectStore(store).getAll()),
    async putMany(store, values) {
      const tx = db.transaction(store, 'readwrite')
      for (const v of values) tx.objectStore(store).put(v)
      await committed(tx)
    },
  }
}
