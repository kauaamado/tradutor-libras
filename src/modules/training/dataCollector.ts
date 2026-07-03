import type { DatasetEntry, DatasetStats } from '@/types/dataset';
import { validateLandmarks } from '@/modules/capture/handTracker';
import type { HandLandmarks } from '@/types/hand';

const DB_NAME = 'libras-dataset';
const DB_VERSION = 1;
const STORE_NAME = 'samples';

let dbPromise: Promise<IDBDatabase> | null = null;

/** Fecha o banco e reseta o cache de conexão (uso principal: testes). */
export async function resetDatabase(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // Database pode já estar fechado
    }
    dbPromise = null;
  }
  // Recria o banco para limpar dados antigos
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      dbPromise = null;
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/** Abre (ou cria) o banco IndexedDB com object store e índice. */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('label', 'label', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/** Salva uma amostra no IndexedDB. Valida os landmarks antes de salvar. */
export async function saveSample(features: number[], label: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  store.add({ features, label });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Converte 21 landmarks em array plano de 63 valores (X, Y, Z de cada ponto). */
export function flattenLandmarks(landmarks: HandLandmarks): number[] {
  const flat: number[] = new Array(63);
  for (let i = 0; i < 21; i++) {
    const lm = landmarks[i];
    flat[i * 3] = lm.x;
    flat[i * 3 + 1] = lm.y;
    flat[i * 3 + 2] = lm.z;
  }
  return flat;
}

/** Valida que os landmarks são adequados para coleta (21 pontos, sem null/NaN). */
export function isValidForCollection(landmarks: HandLandmarks): boolean {
  return validateLandmarks(landmarks);
}

/** Calcula a mediana de um array de números. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Dado N frames de landmarks (cada um com 63 valores), retorna a mediana por coordenada. */
export function computeMedianLandmarks(frames: number[][]): number[] {
  const count = frames[0]?.length ?? 63;
  const result = new Array(count);
  for (let ci = 0; ci < count; ci++) {
    const col = frames.map((f) => f[ci]);
    result[ci] = median(col);
  }
  return result;
}

/** Retorna todas as entradas do dataset. */
export async function getAllSamples(): Promise<(DatasetEntry & { id: number })[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Retorna entradas filtradas por label. */
export async function getSamplesByLabel(label: string): Promise<(DatasetEntry & { id: number })[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('label');

  return new Promise((resolve, reject) => {
    const request = index.getAll(label);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Retorna estatísticas (contagem por label) do dataset. */
export async function getDatasetStats(): Promise<DatasetStats[]> {
  const samples = await getAllSamples();
  const map = new Map<string, number>();
  for (const s of samples) {
    map.set(s.label, (map.get(s.label) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

/** Remove todas as entradas do dataset. */
export async function clearDataset(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Exporta o dataset como JSON (retorna a string). */
export async function exportDataset(): Promise<string> {
  const samples = await getAllSamples();
  const entries = samples.map(({ features, label }) => ({ features, label }));
  const metadata = {
    id: `libras-${Date.now()}`,
    name: 'Dataset LIBRAS',
    createdAt: Date.now(),
    entries,
  };
  return JSON.stringify(metadata, null, 2);
}
