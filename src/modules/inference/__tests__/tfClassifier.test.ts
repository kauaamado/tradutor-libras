import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as tf from '@tensorflow/tfjs';

import { classifyWithModel, classifyBatch } from '@/modules/inference/tfClassifier';
import { createModel } from '@/modules/training/modelTrainer';
import { normalizeLandmarks } from '@/modules/training/modelTrainer';
import { flattenLandmarks } from '@/modules/training/dataCollector';
import type { HandLandmarks } from '@/types/hand';

beforeAll(async () => {
  await tf.ready();
  tf.setBackend('cpu');
});

/** Conta tensores vivos. */
function tensorCount(): number {
  return tf.memory().numTensors;
}

afterEach(() => {
  tf.disposeVariables();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cria landmarks sintéticos com pulso em (0.5, 0.5, 0). Sempre retorna 21 pontos. */
function makeLandmarks(
  offsets: Array<{ dx: number; dy: number; dz: number }>,
): HandLandmarks {
  const wrist: HandLandmarks[0] = { x: 0.5, y: 0.5, z: 0 };
  const landmarks: HandLandmarks = [wrist];
  // Preenche até 21 landmarks (índices 1..20)
  for (let i = 1; i < 21; i++) {
    const off = offsets[i] ?? { dx: 0, dy: 0, dz: 0 };
    landmarks.push({
      x: wrist.x + off.dx,
      y: wrist.y + off.dy,
      z: wrist.z + off.dz,
    });
  }
  return landmarks;
}

/** Cria um modelo treinado com 2 classes usando o mesmo pipeline da inferência. */
async function makeTrainedModel(): Promise<{
  model: tf.LayersModel;
  labels: string[];
}> {
  const model = createModel(2);
  const labels = ['A', 'B'];

  // Landmarks distintos para cada classe — pipeline idêntico à inferência
  const lm1 = makeLandmarks(
    Array.from({ length: 21 }, (_, i) => ({
      dx: i === 8 ? 0.15 : 0.02,
      dy: i === 8 ? -0.10 : -0.01,
      dz: 0,
    })),
  );
  const lm2 = makeLandmarks(
    Array.from({ length: 21 }, (_, i) => ({
      dx: i === 8 ? -0.15 : -0.02,
      dy: i === 8 ? 0.10 : 0.01,
      dz: 0,
    })),
  );

  // Mesma normalização que classifyWithModel usa
  const featA = normalizeLandmarks(flattenLandmarks(lm1), false);
  const featB = normalizeLandmarks(flattenLandmarks(lm2), false);

  const xs = tf.tensor2d([featA, featB]);
  const ys = tf.tensor2d([
    [1, 0],
    [0, 1],
  ]);

  await model.fit(xs, ys, {
    epochs: 50,
    batchSize: 2,
    shuffle: false,
    verbose: 0,
    callbacks: {
      onEpochEnd: (_epoch, logs) => {
        if (logs && logs.acc > 0.99) {
          model.stopTraining = true;
        }
      },
    },
  });
  xs.dispose();
  ys.dispose();

  return { model, labels };
}

// ---------------------------------------------------------------------------
// classifyWithModel
// ---------------------------------------------------------------------------
describe('classifyWithModel', () => {
  it('retorna label válido com confidence > 0', async () => {
    const { model, labels } = await makeTrainedModel();
    const landmarks = makeLandmarks(
      Array.from({ length: 21 }, () => ({ dx: 0.05, dy: -0.02, dz: 0 })),
    );

    const result = classifyWithModel(landmarks, false, model, labels);

    expect(result.label).toBeDefined();
    expect(typeof result.label).toBe('string');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('retorna null para landmarks.length !== 21', () => {
    const labels = ['A', 'B'];
    const model = createModel(2);
    const invalidLandmarks = [{ x: 0, y: 0, z: 0 }]; // 1 landmark apenas

    const result = classifyWithModel(invalidLandmarks as HandLandmarks, false, model, labels);

    expect(result.label).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('não vaza tensores (tf.tidy limpa intermediários)', async () => {
    const { model, labels } = await makeTrainedModel();
    const landmarks = makeLandmarks(
      Array.from({ length: 21 }, () => ({ dx: 0.1, dy: 0.1, dz: 0 })),
    );

    // Conta tensores ANTES da classificação (já inclui pesos do modelo)
    const before = tensorCount();
    classifyWithModel(landmarks, false, model, labels);
    const after = tensorCount();

    // tf.tidy deve limpar todos os intermediários criados na predição
    expect(after).toBe(before);
  });

  it('espelha X para mão esquerda', async () => {
    const { model, labels } = await makeTrainedModel();
    // Landmarks com X > 0.5 (lado direito da imagem)
    const landmarks = makeLandmarks(
      Array.from({ length: 21 }, () => ({ dx: 0.2, dy: 0, dz: 0 })),
    );

    const rightResult = classifyWithModel(landmarks, false, model, labels);
    const leftResult = classifyWithModel(landmarks, true, model, labels);

    // Ambos devem retornar algum label (não quebrar)
    expect(rightResult.label).toBeDefined();
    expect(leftResult.label).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// classifyBatch
// ---------------------------------------------------------------------------
describe('classifyBatch', () => {
  it('retorna array do mesmo tamanho que os frames', async () => {
    const { model, labels } = await makeTrainedModel();
    const landmarks = makeLandmarks(
      Array.from({ length: 21 }, () => ({ dx: 0.05, dy: -0.02, dz: 0 })),
    );
    const frames = [landmarks, landmarks, landmarks];

    const results = classifyBatch(frames, false, model, labels);

    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.label).toBeDefined();
      expect(r.confidence).toBeGreaterThan(0);
    });
  });

  it('não vaza tensores', async () => {
    const { model, labels } = await makeTrainedModel();
    const landmarks = makeLandmarks(
      Array.from({ length: 21 }, () => ({ dx: 0.1, dy: 0.1, dz: 0 })),
    );

    const before = tensorCount();
    classifyBatch([landmarks, landmarks], false, model, labels);
    const after = tensorCount();

    expect(after).toBe(before);
  });
});
