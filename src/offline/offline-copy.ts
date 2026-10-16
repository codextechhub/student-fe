/**
 * Each pupil's last-read answers, for showing with no signal.
 *
 * Every successful read is kept here under the pupil's device account and the
 * address it came from, with the moment it was read. When the school cannot be
 * reached, a read is answered from here and the app shows "Last updated 7:12am"
 * over it, read-only. Nothing is kept for writes.
 *
 * Kept apart per pupil, so a phone that holds Tunde and Bola never answers
 * Bola's request with Tunde's results, and wiped when that pupil signs out of
 * the phone. Where IndexedDB cannot be opened the app simply has no offline
 * copy; nothing else changes.
 */

const DB_NAME = "xvs-student-offline";
const STORE = "answers";

export type KeptAnswer = { data: unknown; at: number };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

const keyFor = (account: string, url: string) => `${account}|${url}`;

function finish(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

/** Keeps `data` as the pupil's latest answer from `url`. */
export async function keepAnswer(account: string, url: string, data: unknown, at = Date.now()): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put({ data, at } satisfies KeptAnswer, keyFor(account, url));
  await finish(tx);
}

/** The pupil's last answer from `url`, or null when none was kept. */
export async function keptAnswer(account: string, url: string): Promise<KeptAnswer | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const request = db.transaction(STORE).objectStore(STORE).get(keyFor(account, url));
    request.onsuccess = () => resolve((request.result as KeptAnswer | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

/** Wipes everything kept for one pupil; the other pupils' copies stay. */
export async function wipePupil(account: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE, "readwrite");
  const prefix = `${account}|`;
  tx.objectStore(STORE).delete(IDBKeyRange.bound(prefix, `${prefix}￿`));
  await finish(tx);
}

/** Test seam: forget the open database between tests. */
export function resetOfflineCopyForTests(): void {
  dbPromise = null;
}
