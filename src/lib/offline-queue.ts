"use client";

/**
 * Antrean jawaban lokal (IndexedDB). Setiap perubahan jawaban ditulis ke sini lebih dulu,
 * lalu dikirim ke server. Entri dihapus setelah server mengonfirmasi.
 * Kunci: `${sessionId}:${questionId}` — satu entri per soal (perubahan terbaru menang).
 */
import type { OptionKey } from "./types";

export interface PendingAnswer {
  key: string;
  sessionId: string;
  questionId: string;
  option: OptionKey | null;
  clientTs: string;
}

const DB_NAME = "tryout-skd";
const STORE = "pending_answers";
let dbPromise: Promise<IDBDatabase> | null = null;
const memoryFallback = new Map<string, PendingAnswer>();

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak tersedia"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("sessionId", "sessionId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function putPending(item: Omit<PendingAnswer, "key">) {
  const entry: PendingAnswer = { ...item, key: `${item.sessionId}:${item.questionId}` };
  memoryFallback.set(entry.key, entry);
  try {
    await tx("readwrite", (s) => s.put(entry));
  } catch {
    /* tetap ada di memori */
  }
}

export async function getPending(sessionId: string): Promise<PendingAnswer[]> {
  try {
    const all = await tx<PendingAnswer[]>("readonly", (s) =>
      s.index("sessionId").getAll(sessionId),
    );
    for (const e of all) if (!memoryFallback.has(e.key)) memoryFallback.set(e.key, e);
  } catch {
    /* gunakan memori */
  }
  return [...memoryFallback.values()].filter((e) => e.sessionId === sessionId);
}

/** Hapus entri hanya jika belum diubah lagi sejak dikirim (clientTs sama). */
export async function removeIfUnchanged(entries: PendingAnswer[]) {
  for (const sent of entries) {
    const current = memoryFallback.get(sent.key);
    if (current && current.clientTs !== sent.clientTs) continue;
    memoryFallback.delete(sent.key);
    try {
      const stored = await tx<PendingAnswer | undefined>("readonly", (s) => s.get(sent.key));
      if (stored && stored.clientTs !== sent.clientTs) continue;
      await tx("readwrite", (s) => s.delete(sent.key));
    } catch {
      /* abaikan */
    }
  }
}

export async function clearSession(sessionId: string) {
  const entries = await getPending(sessionId);
  for (const e of entries) {
    memoryFallback.delete(e.key);
    try {
      await tx("readwrite", (s) => s.delete(e.key));
    } catch {
      /* abaikan */
    }
  }
}
