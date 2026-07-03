import { describe, it, expect, beforeAll } from 'vitest';
import * as tf from '@tensorflow/tfjs';

import {
  normalizeLandmarks,
  parseLabel,
  prepareDataset,
  createModel,
} from '@/modules/training/modelTrainer';

// Garantir backend CPU no Node
beforeAll(async () => {
  await tf.ready();
  tf.setBackend('cpu');
});

// ---------------------------------------------------------------------------
// normalizeLandmarks
// ---------------------------------------------------------------------------
describe('normalizeLandmarks', () => {
  /** Cria features com pulso em (0.5, 0.5, 0) e dedo indicador em (0.7, 0.3, 0). */
  function makeFeatures(
    wristIndex: number,
    offsets: Array<{ dx: number; dy: number; dz: number }>,
  ): number[] {
    const feat = new Array(63).fill(0);
    // Posiciona o pulso
    feat[wristIndex * 3] = 0.5;
    feat[wristIndex * 3 + 1] = 0.5;
    feat[wristIndex * 3 + 2] = 0.0;

    // Posiciona demais landmarks
    for (let i = 0; i < offsets.length && i < 21; i++) {
      if (i === wristIndex) continue;
      feat[i * 3] = feat[wristIndex * 3] + offsets[i].dx;
      feat[i * 3 + 1] = feat[wristIndex * 3 + 1] + offsets[i].dy;
      feat[i * 3 + 2] = feat[wristIndex * 3 + 2] + offsets[i].dz;
    }

    // Preenche landmarks não usados com o valor do pulso
    for (let i = offsets.length; i < 21; i++) {
      feat[i * 3] = feat[wristIndex * 3];
      feat[i * 3 + 1] = feat[wristIndex * 3 + 1];
      feat[i * 3 + 2] = feat[wristIndex * 3 + 2];
    }
    return feat;
  }

  it('centraliza no pulso (pulso no origem)', () => {
    const offsets = Array.from({ length: 21 }, () => ({
      dx: 0.1,
      dy: 0.1,
      dz: 0.1,
    }));
    const features = makeFeatures(0, offsets);
    const result = normalizeLandmarks(features, false);

    // Pulso deve estar na origem
    expect(result[0]).toBeCloseTo(0, 5);
    expect(result[1]).toBeCloseTo(0, 5);
    expect(result[2]).toBeCloseTo(0, 5);
  });

  it('escala pela distância máxima (landmark mais distante tem norma 1)', () => {
    // Um landmark bem distante, os demais sobre o pulso
    const offsets: Array<{ dx: number; dy: number; dz: number }> = new Array(21)
      .fill(null)
      .map(() => ({ dx: 0, dy: 0, dz: 0 }));
    offsets[8] = { dx: 0.3, dy: 0.0, dz: 0.0 }; // indicador ponta longe

    const features = makeFeatures(0, offsets);
    const result = normalizeLandmarks(features, false);

    // Ponta do indicador (landmark 8): deve estar em (1, 0, 0) ou próximo
    const x = result[8 * 3];
    const y = result[8 * 3 + 1];
    const z = result[8 * 3 + 2];
    expect(x).toBeCloseTo(1, 4);
    expect(y).toBeCloseTo(0, 4);
    expect(z).toBeCloseTo(0, 4);
  });

  it('espelha X para mão esquerda', () => {
    const offsets: Array<{ dx: number; dy: number; dz: number }> = new Array(21)
      .fill(null)
      .map(() => ({ dx: 0, dy: 0, dz: 0 }));
    offsets[8] = { dx: 0.2, dy: 0.0, dz: 0.0 };

    const features = makeFeatures(0, offsets);
    const rightResult = normalizeLandmarks(features, false);
    const leftResult = normalizeLandmarks(features, true);

    // X da ponta do indicador deve ter sinal oposto na mão esquerda
    expect(rightResult[8 * 3]).toBeGreaterThan(0);
    expect(leftResult[8 * 3]).toBeLessThan(0);
    // Y e Z devem ser iguais
    expect(leftResult[8 * 3 + 1]).toBeCloseTo(rightResult[8 * 3 + 1], 5);
    expect(leftResult[8 * 3 + 2]).toBeCloseTo(rightResult[8 * 3 + 2], 5);
  });

  it('retorna array de tamanho 63', () => {
    const features = new Array(63).fill(0.5);
    const result = normalizeLandmarks(features, false);
    expect(result).toHaveLength(63);
  });

  it('não gera NaN ou Infinity', () => {
    const features = new Array(63).fill(0.5);
    const result = normalizeLandmarks(features, false);
    for (const v of result) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('lida com landmarks todos no mesmo ponto (maxDist = 0)', () => {
    // Todos os landmarks idênticos → após centralizar fica (0,0,0)
    const features = new Array(63).fill(0.3);
    const result = normalizeLandmarks(features, false);
    expect(result).toHaveLength(63);
    for (const v of result) {
      expect(v).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// parseLabel
// ---------------------------------------------------------------------------
describe('parseLabel', () => {
  it('extrai letra A da mão direita (D_A)', () => {
    const parsed = parseLabel('D_A');
    expect(parsed.letter).toBe('A');
    expect(parsed.isLeftHand).toBe(false);
  });

  it('extrai letra A da mão esquerda (E_A)', () => {
    const parsed = parseLabel('E_A');
    expect(parsed.letter).toBe('A');
    expect(parsed.isLeftHand).toBe(true);
  });

  it('extrai letra B da mão direita (D_B)', () => {
    const parsed = parseLabel('D_B');
    expect(parsed.letter).toBe('B');
    expect(parsed.isLeftHand).toBe(false);
  });

  it('extrai letra Y da mão esquerda (E_Y)', () => {
    const parsed = parseLabel('E_Y');
    expect(parsed.letter).toBe('Y');
    expect(parsed.isLeftHand).toBe(true);
  });

  it('lida com letras de um caractere', () => {
    const result = parseLabel('E_X');
    expect(result.letter).toBe('X');
    expect(result.isLeftHand).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// prepareDataset
// ---------------------------------------------------------------------------
describe('prepareDataset', () => {
  const sampleFeatures = new Array(63).fill(0.5);

  it('retorna tensores com shapes corretos', () => {
    const samples = [
      { features: [...sampleFeatures], label: 'D_A' },
      { features: [...sampleFeatures], label: 'E_A' },
      { features: [...sampleFeatures], label: 'D_B' },
    ];

    const { xs, ys, labels } = prepareDataset(samples);

    expect(xs.shape).toEqual([3, 63]);
    expect(ys.shape).toEqual([3, 2]); // 2 classes: A, B
    expect(labels).toEqual(['A', 'B']);

    xs.dispose();
    ys.dispose();
  });

  it('extrai labels únicas ordenadas', () => {
    const samples = [
      { features: [...sampleFeatures], label: 'D_C' },
      { features: [...sampleFeatures], label: 'D_A' },
      { features: [...sampleFeatures], label: 'D_B' },
    ];

    const { labels } = prepareDataset(samples);
    expect(labels).toEqual(['A', 'B', 'C']);
  });

  it('combina mãos direita e esquerda na mesma classe', () => {
    const samples = [
      { features: [...sampleFeatures], label: 'D_A' },
      { features: [...sampleFeatures], label: 'E_A' },
      { features: [...sampleFeatures], label: 'D_B' },
    ];

    const { labels, counts } = prepareDataset(samples);
    expect(labels).toEqual(['A', 'B']);
    expect(counts.get('A')).toBe(2);
    expect(counts.get('B')).toBe(1);
  });

  it('codifica one‑hot corretamente', async () => {
    const samples = [
      { features: [...sampleFeatures], label: 'D_A' }, // índice 0
      { features: [...sampleFeatures], label: 'D_B' }, // índice 1
    ];

    const { ys, labels } = prepareDataset(samples);

    expect(labels).toEqual(['A', 'B']);
    const data = await ys.array();

    // Amostra 0: label A → [1, 0]
    expect(data[0][0]).toBeCloseTo(1, 5);
    expect(data[0][1]).toBeCloseTo(0, 5);

    // Amostra 1: label B → [0, 1]
    expect(data[1][0]).toBeCloseTo(0, 5);
    expect(data[1][1]).toBeCloseTo(1, 5);

    ys.dispose();
  });

  it('normaliza amostras da mão esquerda (espelhamento)', () => {
    // Duas amostras idênticas, uma de cada mão → features devem diferir após normalização
    const feats = new Array(63).fill(0);
    // Põe pulso e um ponto distinto para visualizar espelhamento
    feats[0] = 0.5;
    feats[1] = 0.5;
    feats[8 * 3] = 0.8;
    feats[8 * 3 + 1] = 0.3;

    const samples = [
      { features: [...feats], label: 'D_A' },
      { features: [...feats], label: 'E_B' },
    ];

    const { xs } = prepareDataset(samples);
    const data = xs.arraySync();

    // X do landmark 8 deve ter sinal oposto entre as duas (esquerda espelhada)
    const rightX = data[0][8 * 3];
    const leftX = data[1][8 * 3];

    // Após normalização: direita X positivo, esquerda X negativo
    expect(rightX).toBeGreaterThan(0);
    expect(leftX).toBeLessThan(0);

    xs.dispose();
  });
});

// ---------------------------------------------------------------------------
// createModel
// ---------------------------------------------------------------------------
describe('createModel', () => {
  it('cria modelo com 3 camadas (dense → dropout → dense)', () => {
    const model = createModel(10);
    expect(model.layers).toHaveLength(3);
  });

  it('camada de entrada aceita shape [null, 63]', () => {
    const model = createModel(5);
    const inputShape = model.inputs[0].shape;
    expect(inputShape).toEqual([null, 63]);
  });

  it('camada de saída tem unidades = numClasses', () => {
    const model = createModel(19);
    const lastLayer = model.layers[model.layers.length - 1];
    expect((lastLayer as any).units).toBe(19);
  });

  it('usa ativação softmax na saída', () => {
    const model = createModel(3);
    const lastLayer = model.layers[model.layers.length - 1];
    const config = lastLayer.getConfig();
    expect(config.activation).toBe('softmax');
  });

  it('usa ativação relu na camada oculta', () => {
    const model = createModel(3);
    const hiddenLayer = model.layers[0];
    const config = hiddenLayer.getConfig();
    expect(config.activation).toBe('relu');
  });
});
