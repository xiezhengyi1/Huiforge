const databaseName = "huiforge-launch";
const storeName = "drafts";
const draftLifetime = 60 * 60 * 1000;

async function openDraftStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const drafts = request.result.createObjectStore(storeName, { autoIncrement: true });
      drafts.createIndex("expires", "expires");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function useDraftStore(run) {
  const database = await openDraftStore();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = run(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export function saveLaunchDraft(draft) {
  const now = Date.now();
  return useDraftStore((drafts) => {
    const expired = drafts.index("expires").openCursor(IDBKeyRange.upperBound(now));
    expired.onsuccess = () => {
      const cursor = expired.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    return drafts.add({ ...draft, expires: now + draftLifetime });
  });
}

export async function takeLaunchDraft(id) {
  const draft = await useDraftStore((drafts) => {
    const request = drafts.get(id);
    request.onsuccess = () => drafts.delete(id);
    return request;
  });
  return draft?.expires > Date.now() ? draft : null;
}
