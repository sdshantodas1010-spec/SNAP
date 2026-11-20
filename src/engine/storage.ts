import {EditStackStep, ExifMetadata} from '../types/editor';

const DB_NAME = 'chitro_darkroom_db';
const STORE_NAME = 'projects';
const PROJECT_KEY = 'active_session';

export interface SavedSession {
  photoDataUrl: string;
  editStack: EditStackStep[];
  activeLookId: string | null;
  exif: ExifMetadata;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSessionToDb(session: SavedSession): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(session, PROJECT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota or private-mode IndexedDB errors gracefully
  }
}

export async function loadSessionFromDb(): Promise<SavedSession | null> {
  try {
    const db = await openDb();
    return await new Promise<SavedSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(PROJECT_KEY);
      req.onsuccess = () => resolve((req.result as SavedSession) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearSessionDb(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(PROJECT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
