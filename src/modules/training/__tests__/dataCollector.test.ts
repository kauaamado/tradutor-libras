import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

import {
  saveSample,
  getAllSamples,
  getSamplesByLabel,
  getDatasetStats,
  clearDataset,
  exportDataset,
  flattenLandmarks,
  isValidForCollection,
  computeMedianLandmarks,
  resetDatabase,
} from '@/modules/training/dataCollector';
import type { HandLandmarks } from '@/types/hand';

// --- Helpers ---

function lm(x = 0.5, y = 0.5, z = 0): { x: number; y: number; z: number } {
  return { x, y, z };
}

function makeLandmarks(count = 21): HandLandmarks {
  return Array.from({ length: count }, (_, i) => lm(0.5, 0.3 + i * 0.02));
}

// Reseta o banco antes e depois de cada teste para evitar acúmulo
beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  await resetDatabase();
});

// --- Testes ---

describe('flattenLandmarks', () => {
  it('converte 21 landmarks em array de 63 valores', () => {
    const landmarks = makeLandmarks(21);
    const flat = flattenLandmarks(landmarks);

    expect(flat.length).toBe(63);
    expect(flat[0]).toBe(0.5); // x do landmark 0
    expect(flat[1]).toBe(0.3); // y do landmark 0
    expect(flat[2]).toBe(0);   // z do landmark 0
    expect(flat[3]).toBe(0.5); // x do landmark 1
    expect(flat[4]).toBe(0.32); // y do landmark 1
  });
});

describe('isValidForCollection', () => {
  it('valida landmarks completos como válidos', () => {
    const landmarks = makeLandmarks(21);
    expect(isValidForCollection(landmarks)).toBe(true);
  });

  it('rejeita menos de 21 landmarks', () => {
    expect(isValidForCollection(makeLandmarks(20))).toBe(false);
  });

  it('rejeita landmarks com NaN', () => {
    const bad: HandLandmarks = makeLandmarks(21);
    bad[5] = { x: NaN, y: NaN, z: NaN };
    // NaN deve ser rejeitado pelo validateLandmarks
    expect(isValidForCollection(bad)).toBe(false);
  });
});

describe('computeMedianLandmarks', () => {
  it('calcula mediana de 3 frames com 2 valores cada', () => {
    const frames = [
      [1, 10],
      [2, 20],
      [3, 30],
    ];
    const result = computeMedianLandmarks(frames);
    expect(result).toEqual([2, 20]);
  });

  it('calcula mediana de 5 frames (ordem variada)', () => {
    const frames = [
      [5, 1],
      [1, 5],
      [3, 3],
      [2, 2],
      [4, 4],
    ];
    const result = computeMedianLandmarks(frames);
    expect(result).toEqual([3, 3]);
  });

  it('calcula mediana com número par de frames', () => {
    const frames = [
      [1, 10],
      [2, 20],
      [3, 30],
      [4, 40],
    ];
    const result = computeMedianLandmarks(frames);
    expect(result).toEqual([2.5, 25]);
  });
});

describe('IndexedDB: saveSample + getAllSamples + getByLabel', () => {
  it('salva e recupera amostras', async () => {
    await saveSample([0.1, 0.2, 0.3], 'A');
    await saveSample([0.4, 0.5, 0.6], 'A');
    await saveSample([0.7, 0.8, 0.9], 'B');

    const all = await getAllSamples();
    expect(all.length).toBe(3);
    expect(all[0].label).toBe('A');
    expect(all[0].features).toEqual([0.1, 0.2, 0.3]);
  });

  it('filtra por label', async () => {
    await saveSample([0.1], 'A');
    await saveSample([0.2], 'A');
    await saveSample([0.3], 'B');

    const aSamples = await getSamplesByLabel('A');
    expect(aSamples.length).toBe(2);

    const bSamples = await getSamplesByLabel('B');
    expect(bSamples.length).toBe(1);
  });
});

describe('IndexedDB: stats + clear + export', () => {
  it('retorna estatísticas por label', async () => {
    await saveSample([0.1], 'A');
    await saveSample([0.2], 'A');
    await saveSample([0.3], 'B');
    await saveSample([0.4], 'C');

    const stats = await getDatasetStats();
    expect(stats).toHaveLength(3);

    const aStats = stats.find((s) => s.label === 'A');
    expect(aStats?.count).toBe(2);
  });

  it('limpa o dataset', async () => {
    await saveSample([0.1], 'A');
    await saveSample([0.2], 'B');

    await clearDataset();

    const all = await getAllSamples();
    expect(all.length).toBe(0);
  });

  it('exporta dataset como JSON', async () => {
    await saveSample([0.1, 0.2], 'A');
    await saveSample([0.3, 0.4], 'B');

    const json = await exportDataset();
    const parsed = JSON.parse(json);

    expect(parsed.name).toBe('Dataset LIBRAS');
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0].features).toEqual([0.1, 0.2]);
    expect(parsed.entries[0].label).toBe('A');
  });
});
