const databaseName = "huiforge-workflows";
const legacyKey = "huiju.workflows.local.v1";
const draftLimit = 40;

function draftSummary(record) {
  return {
    id:record.id, name:record.name, description:record.description, author:record.author,
    node_count:record.graph.nodes.length, updated_at:Number(record.updated_at ?? record.created_at) || 0,
  };
}

function legacyDrafts() {
  try {
    const drafts = JSON.parse(localStorage.getItem(legacyKey) || "[]");
    if (Array.isArray(drafts)) return drafts.filter((draft) =>
      typeof draft?.id === "string" && Array.isArray(draft.graph?.nodes)).slice(0, draftLimit);
  } catch {
    // A damaged or unavailable legacy store does not prevent new saves.
  }
  return [];
}

async function useDraftStore(names, mode, run) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const drafts = request.result.createObjectStore("drafts", { keyPath:"id" });
      const summaries = request.result.createObjectStore("summaries", { keyPath:"id" });
      summaries.createIndex("updated", "updated_at");
      for (const draft of legacyDrafts()) {
        drafts.put(draft);
        summaries.put(draftSummary(draft));
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(names, mode);
      let request;
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onabort = () => reject(transaction.error);
      try {
        request = run(transaction);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

export async function listWorkflowDrafts() {
  const drafts = await useDraftStore("summaries", "readonly", (transaction) =>
    transaction.objectStore("summaries").index("updated").getAll());
  return drafts.reverse();
}

export function readWorkflowDraft(id) {
  return useDraftStore("drafts", "readonly", (transaction) => transaction.objectStore("drafts").get(id));
}

export function writeWorkflowDraft(record) {
  return useDraftStore(["drafts", "summaries"], "readwrite", (transaction) => {
    const drafts = transaction.objectStore("drafts");
    const summaries = transaction.objectStore("summaries");
    drafts.put(record);
    summaries.put(draftSummary(record));
    let kept = 0;
    const records = summaries.index("updated").openKeyCursor(null, "prev");
    records.onsuccess = () => {
      const cursor = records.result;
      if (!cursor) return;
      if (++kept > draftLimit) {
        drafts.delete(cursor.primaryKey);
        summaries.delete(cursor.primaryKey);
      }
      cursor.continue();
    };
  });
}
