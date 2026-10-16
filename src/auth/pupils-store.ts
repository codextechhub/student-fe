/**
 * The pupils signed in on this phone, for the switcher.
 *
 * Each entry is what the switcher shows (name, photo) plus the opaque device
 * account the API knows the sign-in by, and the pupil record's id so that the
 * same child signing in twice replaces their old entry rather than appearing
 * twice. No token is ever stored: the credential is an httpOnly cookie the
 * page cannot read.
 *
 * IndexedDB is per origin, and each school has its own address, so Bright
 * Star's pupils and Greenfield's never share a list. Where IndexedDB cannot be
 * opened (some private windows), the list lives in memory for the session:
 * the pupil stays signed in until the page closes and then signs in again.
 */
export type DevicePupil = {
  account: string;
  studentId: number;
  fullName: string;
  firstName: string;
  photo: string;
};

const DB_NAME = "xvs-student";
const DB_VERSION = 1;
const PUPILS = "pupils";
const META = "meta";
const ACTIVE_KEY = "active";

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = { pupils: new Map<string, DevicePupil>(), active: null as string | null };

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PUPILS)) db.createObjectStore(PUPILS, { keyPath: "account" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function run<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = work(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Every pupil on this phone, in the order they were added. */
export async function listPupils(): Promise<DevicePupil[]> {
  const db = await openDb();
  if (!db) return [...memory.pupils.values()];
  return run(db, PUPILS, "readonly", (s) => s.getAll() as IDBRequest<DevicePupil[]>);
}

/** Adds or updates a pupil, keyed by their device account. */
export async function putPupil(pupil: DevicePupil): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory.pupils.set(pupil.account, pupil);
    return;
  }
  await run(db, PUPILS, "readwrite", (s) => s.put(pupil));
}

/** Takes a pupil off the phone, and off the active slot if they were on it. */
export async function deletePupil(account: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory.pupils.delete(account);
    if (memory.active === account) memory.active = null;
    return;
  }
  await run(db, PUPILS, "readwrite", (s) => s.delete(account));
  if ((await getActiveAccount()) === account) await setActiveAccount(null);
}

/** The pupil the app opened on last, or null. */
export async function getActiveAccount(): Promise<string | null> {
  const db = await openDb();
  if (!db) return memory.active;
  const value = await run(db, META, "readonly", (s) => s.get(ACTIVE_KEY) as IDBRequest<string | undefined>);
  return value ?? null;
}

/** Remembers which pupil to open on next time. */
export async function setActiveAccount(account: string | null): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory.active = account;
    return;
  }
  if (account === null) await run(db, META, "readwrite", (s) => s.delete(ACTIVE_KEY));
  else await run(db, META, "readwrite", (s) => s.put(account, ACTIVE_KEY));
}

/** Test seam: forget the open database so each test starts from a fresh one. */
export function resetPupilsStoreForTests(): void {
  dbPromise = null;
  memory.pupils.clear();
  memory.active = null;
}
