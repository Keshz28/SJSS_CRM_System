// Blobs live in IndexedDB rather than localStorage, so phone photos survive reloads.
import { draftRevision } from "@/lib/draft-revision";
const DB_NAME = "sjss-capture-v1";
const revisions = new Map<string, string>();
const owner = (key: string) => key.startsWith("capture:") ? key.split(":")[1] : "";
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readDraft<T>(key: string): Promise<T | undefined> {
  revisions.set(key, draftRevision(owner(key)));
  const db = await database();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db
        .transaction("drafts", "readonly")
        .objectStore("drafts")
        .get(key);
      request.onsuccess = () => {
        const saved = request.result;
        const revision = revisions.get(key);
        if (saved?._sjssDeviceDraft === 1) resolve(saved.revision === revision ? saved.value : undefined);
        else resolve(revision === "0" ? saved : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
export async function writeDraft(key: string, value: unknown) {
  const db = await database();
  try {
    const current = draftRevision(owner(key));
    if (revisions.has(key) && revisions.get(key) !== current)
      throw new Error("This device's drafts were cleared. Reload before starting a new draft.");
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      transaction.objectStore("drafts").put({ _sjssDeviceDraft: 1, revision: current, value }, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error || new Error("Draft save cancelled"));
    });
  } finally {
    db.close();
  }
}
export async function deleteDraft(key: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      transaction.objectStore("drafts").delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function accountCaptureDrafts(ownerId: string, clear = false) {
  const db = await database();
  try {
    return await new Promise<number>((resolve, reject) => {
      let count = 0;
      const tx = db.transaction("drafts", clear ? "readwrite" : "readonly");
      const cursor = tx.objectStore("drafts").openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        if (typeof row.key === "string" && row.key.startsWith(`capture:${ownerId}:`)) {
          count++;
          if (clear) row.delete();
        }
        row.continue();
      };
      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Draft cleanup cancelled"));
    });
  } finally { db.close(); }
}
