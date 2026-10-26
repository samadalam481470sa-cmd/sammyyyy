const DB_NAME = 'newport-crm-docs-v1'
const STORE = 'files'

export function fileStoreKey(ownerKey: string, documentId: string): string {
  return `${ownerKey}::${documentId}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const database = req.result
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export async function putDocumentBlob(
  ownerKey: string,
  documentId: string,
  blob: Blob,
): Promise<void> {
  const database = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    tx.objectStore(STORE).put(blob, fileStoreKey(ownerKey, documentId))
  })
}

export async function getDocumentBlob(
  ownerKey: string,
  documentId: string,
): Promise<Blob | null> {
  try {
    const database = await openDb()
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = database.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(fileStoreKey(ownerKey, documentId))
      req.onsuccess = () => {
        const value = req.result
        resolve(value instanceof Blob ? value : null)
      }
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
    })
  } catch {
    return null
  }
}

export async function deleteDocumentBlob(ownerKey: string, documentId: string): Promise<void> {
  try {
    const database = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
      tx.objectStore(STORE).delete(fileStoreKey(ownerKey, documentId))
    })
  } catch {
    // private mode / already gone
  }
}
