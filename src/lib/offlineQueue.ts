// Tiny IndexedDB-backed queue for reports that couldn't be sent right away
// (e.g., no signal at the park). Users can capture a photo + details now and
// we'll flush them the moment connectivity returns.

export type QueuedReport = {
  id: string;
  createdAt: number;
  reporterId: string;
  title: string;
  description: string | null;
  category: string;
  lat: number;
  lng: number;
  isAnonymous: boolean;
  photos: Blob[];
};

const DB_NAME = "blockbeacon";
const STORE = "outbox";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueReport(r: QueuedReport): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(r);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listQueue(): Promise<QueuedReport[]> {
  const db = await openDb();
  const result = await new Promise<QueuedReport[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedReport[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}