import * as tf from '@tensorflow/tfjs';

import type { DatasetEntry } from '@/types/dataset';
import type { TrainingProgress, TrainingResult, ModelInfo } from '@/types/model';

/** URL do modelo no IndexedDB. */
const MODEL_URL = 'indexeddb://sign-model';

/** Chaves do localStorage para metadados. */
const LABELS_KEY = 'libras-model-labels';
const INFO_KEY = 'libras-model-info';

/** Índice do pulso (landmark 0). */
const WRIST_IDX = 0;

/** Número de landmarks por mão. */
const NUM_LANDMARKS = 21;

/** Total de features: 21 landmarks × 3 eixos. */
const NUM_FEATURES = NUM_LANDMARKS * 3;

/**
 * Normaliza 63 features (21 landmarks × 3 eixos) para tornar o modelo
 * invariante a translação, escala e lateralidade da mão.
 *
 * 1. Centraliza no pulso (landmark 0).
 * 2. Escala pela distância máxima do pulso.
 * 3. Espelha X se mão esquerda (unifica com direita).
 *
 * @param features - Array plano de 63 valores (X0,Y0,Z0, X1,Y1,Z1, ...).
 * @param isLeftHand - Se a mão é esquerda (ativa espelhamento em X).
 * @returns 63 valores normalizados.
 */
export function normalizeLandmarks(
  features: number[],
  isLeftHand: boolean,
): number[] {
  const wristX = features[WRIST_IDX * 3];
  const wristY = features[WRIST_IDX * 3 + 1];
  const wristZ = features[WRIST_IDX * 3 + 2];

  // Passo 1: centralizar e calcular distância máxima do pulso
  const centered = new Array(NUM_FEATURES);
  let maxDist = 0;

  for (let i = 0; i < NUM_LANDMARKS; i++) {
    const x = features[i * 3] - wristX;
    const y = features[i * 3 + 1] - wristY;
    const z = features[i * 3 + 2] - wristZ;
    const finalX = isLeftHand ? -x : x;

    centered[i * 3] = finalX;
    centered[i * 3 + 1] = y;
    centered[i * 3 + 2] = z;

    const dist = Math.sqrt(finalX * finalX + y * y + z * z);
    if (dist > maxDist) maxDist = dist;
  }

  // Passo 2: escalar uniformemente
  const scale = maxDist > 0 ? 1 / maxDist : 1;
  const result = new Array(NUM_FEATURES);
  for (let i = 0; i < NUM_FEATURES; i++) {
    result[i] = centered[i] * scale;
  }

  return result;
}

/**
 * Extrai a letra e lateralidade da mão a partir do label composto.
 *
 * @param label - Formato "D_A" (direita) ou "E_A" (esquerda).
 * @returns Objeto com letra e flag de mão esquerda.
 */
export function parseLabel(label: string): {
  letter: string;
  isLeftHand: boolean;
} {
  const prefix = label[0]; // 'D' ou 'E'
  const letter = label.slice(2);
  return { letter, isLeftHand: prefix === 'E' };
}

/**
 * Prepara o dataset para treino: normaliza cada amostra, extrai labels
 * únicas e codifica em one‑hot.
 *
 * @param samples - Amostras do IndexedDB (features + label composto).
 * @returns Tensores xs [N,63], ys [N,C] + lista de labels ordenadas.
 */
export function prepareDataset(
  samples: (DatasetEntry & { id?: number })[],
): {
  xs: tf.Tensor2D;
  ys: tf.Tensor2D;
  labels: string[];
  counts: Map<string, number>;
} {
  const normalized: number[][] = [];
  const labelIndices: number[] = [];
  const labelSet = new Set<string>();
  const counts = new Map<string, number>();

  // Primeira passagem: coletar labels únicas e contar
  for (const s of samples) {
    const { letter } = parseLabel(s.label);
    labelSet.add(letter);
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }

  const labels = Array.from(labelSet).sort();
  const labelToIndex = new Map(labels.map((l, i) => [l, i]));

  // Segunda passagem: normalizar e indexar
  for (const s of samples) {
    const { letter, isLeftHand } = parseLabel(s.label);
    const norm = normalizeLandmarks(s.features, isLeftHand);
    normalized.push(norm);
    labelIndices.push(labelToIndex.get(letter)!);
  }

  const xs = tf.tensor2d(normalized); // [N, 63]
  const ys = tf.oneHot(
    tf.tensor1d(labelIndices, 'int32'),
    labels.length,
  ) as tf.Tensor2D; // [N, C]

  console.info(
    `[ModelTrainer] Dataset preparado: ${samples.length} amostras, ` +
      `${labels.length} classes (${labels.join(', ')}), ${NUM_FEATURES} features.`,
  );

  return { xs, ys, labels, counts };
}

/**
 * Cria o modelo Sequential conforme especificação do PLAN.md:
 * Dense(128, ReLU) → Dropout(0.3) → Dense(N, softmax)
 *
 * @param numClasses - Número de letras distintas nos dados.
 * @returns Modelo compilado pronto para treino.
 */
export function createModel(numClasses: number): tf.Sequential {
  const model = tf.sequential();

  model.add(
    tf.layers.dense({ units: 128, activation: 'relu', inputShape: [63] }),
  );
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(
    tf.layers.dense({ units: numClasses, activation: 'softmax' }),
  );

  model.compile({
    optimizer: tf.train.adam(),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  console.info(
    `[ModelTrainer] Modelo criado: 63 → Dense(128,ReLU) → Dropout(0.3) → Dense(${numClasses},softmax).`,
  );

  return model;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Embaralha índices via Fisher‑Yates. */
function shuffleIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Divide tensores xs/ys em treino e teste. Garante pelo menos 1 amostra em cada split. */
function splitTensors(
  xs: tf.Tensor2D,
  ys: tf.Tensor2D,
  testRatio: number,
): {
  trainXs: tf.Tensor2D;
  trainYs: tf.Tensor2D;
  testXs: tf.Tensor2D;
  testYs: tf.Tensor2D;
} {
  const n = xs.shape[0];
  const indices = shuffleIndices(n);

  // Garantir pelo menos 1 amostra em cada split
  const splitIdx = Math.max(1, Math.min(n - 1, Math.round(n * (1 - testRatio))));
  const trainIdx = indices.slice(0, splitIdx);
  const testIdx = indices.slice(splitIdx);

  return {
    trainXs: tf.gather(xs, trainIdx) as tf.Tensor2D,
    trainYs: tf.gather(ys, trainIdx) as tf.Tensor2D,
    testXs: tf.gather(xs, testIdx) as tf.Tensor2D,
    testYs: tf.gather(ys, testIdx) as tf.Tensor2D,
  };
}

// ---------------------------------------------------------------------------
// Treinamento
// ---------------------------------------------------------------------------

/** Opções de treinamento. */
export interface TrainOptions {
  validationSplit?: number;
  epochs?: number;
  batchSize?: number;
  testSplit?: number;
  onProgress?: (p: TrainingProgress) => void;
}

/**
 * Treina o modelo com os dados fornecidos.
 *
 * Divisão: testSplit para conjunto de teste final,
 * validationSplit sobre o conjunto de treino para curva de validação.
 * Usa early stopping (patience=10, monitor=val_loss).
 *
 * @param model - Modelo compilado.
 * @param xs - Features [N, 63].
 * @param ys - Labels one‑hot [N, C].
 * @param options - Configuração de treino.
 * @returns Resultado com acurácia no teste.
 */
export async function trainModel(
  model: tf.Sequential,
  xs: tf.Tensor2D,
  ys: tf.Tensor2D,
  options: TrainOptions = {},
): Promise<TrainingResult> {
  const {
    validationSplit = 0.2,
    epochs = 50,
    batchSize = 8,
    testSplit = 0.2,
    onProgress,
  } = options;

  const { trainXs, trainYs, testXs, testYs } = splitTensors(xs, ys, testSplit);

  console.info(
    `[ModelTrainer] Treino: ${trainXs.shape[0]} amostras, ` +
      `teste: ${testXs.shape[0]}, ${epochs} épocas, batch ${batchSize}.`,
  );

  let lastValLoss = 0;
  let lastValAcc = 0;
  let trainedEpochs = 0;

  const onEpochEnd: tf.CustomCallbackArgs = {
    onEpochEnd: async (epoch, logs) => {
      if (!logs) return;
      trainedEpochs = epoch + 1;
      lastValLoss = logs.val_loss;
      lastValAcc = logs.val_acc;
      onProgress?.({
        epoch: epoch + 1,
        totalEpochs: epochs,
        loss: logs.loss,
        accuracy: logs.acc,
        valLoss: logs.val_loss,
        valAccuracy: logs.val_acc,
      });
    },
  };

  await model.fit(trainXs, trainYs, {
    epochs,
    batchSize,
    validationSplit,
    shuffle: true,
    callbacks: [
      onEpochEnd,
      tf.callbacks.earlyStopping({ monitor: 'val_loss', patience: 10 }),
    ],
  });

  // Avaliar no conjunto de teste separado
  const evalResult = model.evaluate(testXs, testYs) as tf.Scalar[];
  const testLossData = await evalResult[0].data();
  const testAccData = await evalResult[1].data();
  const testLoss = testLossData[0];
  const testAcc = testAccData[0];

  // Liberar memória
  evalResult.forEach((t) => t.dispose());
  testXs.dispose();
  testYs.dispose();
  trainXs.dispose();
  trainYs.dispose();

  console.info(
    `[ModelTrainer] Treino concluído: acurácia teste = ${(testAcc * 100).toFixed(1)}%, ` +
      `perda = ${testLoss.toFixed(4)} (${trainedEpochs} épocas).`,
  );

  return {
    accuracy: testAcc,
    loss: testLoss,
    valAccuracy: lastValAcc,
    valLoss: lastValLoss,
    epochs: trainedEpochs,
    numClasses: ys.shape[1],
  };
}

// ---------------------------------------------------------------------------
// Persistência do modelo (IndexedDB)
// ---------------------------------------------------------------------------

/** Salva o modelo treinado no IndexedDB. */
export async function saveModel(model: tf.LayersModel): Promise<void> {
  await model.save(MODEL_URL);
  console.info('[ModelTrainer] Modelo salvo no IndexedDB.');
}

/** Carrega o modelo do IndexedDB, ou null se não existir. */
export async function loadModel(): Promise<tf.LayersModel | null> {
  try {
    const model = await tf.loadLayersModel(MODEL_URL);
    console.info('[ModelTrainer] Modelo carregado do IndexedDB.');
    return model;
  } catch {
    console.warn('[ModelTrainer] Nenhum modelo encontrado no IndexedDB.');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Metadados (localStorage)
// ---------------------------------------------------------------------------

/** Salva metadados do modelo (labels, acurácia). */
export function saveModelMetadata(labels: string[], accuracy: number): void {
  const metadata: ModelInfo = {
    trained: true,
    numClasses: labels.length,
    labels,
    accuracy,
    trainedAt: Date.now(),
  };
  localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
  localStorage.setItem(INFO_KEY, JSON.stringify(metadata));
  console.info('[ModelTrainer] Metadados salvos em localStorage.');
}

/** Carrega metadados do modelo. */
export function loadModelMetadata(): ModelInfo {
  const labelsStr = localStorage.getItem(LABELS_KEY);
  const infoStr = localStorage.getItem(INFO_KEY);

  if (labelsStr && infoStr) {
    try {
      return JSON.parse(infoStr) as ModelInfo;
    } catch {
      const labels = JSON.parse(labelsStr) as string[];
      return {
        trained: true,
        numClasses: labels.length,
        labels,
        accuracy: 0,
        trainedAt: 0,
      };
    }
  }

  return {
    trained: false,
    numClasses: 0,
    labels: [],
    accuracy: 0,
    trainedAt: 0,
  };
}

/** Remove metadados (ex.: ao resetar ou retreinar). */
export function clearModelMetadata(): void {
  localStorage.removeItem(LABELS_KEY);
  localStorage.removeItem(INFO_KEY);
  console.info('[ModelTrainer] Metadados removidos.');
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

/** Auxiliar: dispara download de Blob no navegador. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta o modelo treinado como arquivos para download.
 *
 * Gera 3 arquivos:
 *  - sign-model.json   (topologia + manifest)
 *  - sign-model.weights.bin (pesos binários)
 *  - labels.json       (mapeamento índice → letra)
 *
 * Também salva no IndexedDB antes de exportar.
 */
export async function exportModel(
  model: tf.LayersModel,
  labels: string[],
): Promise<void> {
  // Garantir que está persistido no IndexedDB
  await saveModel(model);

  // Handler customizado para download dos artefatos
  const handler = tf.io.withSaveHandler(async (artifacts) => {
    const modelPayload = {
      modelTopology: artifacts.modelTopology,
      weightsManifest: artifacts.weightSpecs,
      format: 'layers-model',
      generatedBy: 'tradutor-libras',
      convertedBy: null,
      userDefinedMetadata: {},
    };

    downloadBlob(
      new Blob([JSON.stringify(modelPayload, null, 2)], {
        type: 'application/json',
      }),
      'sign-model.json',
    );

    if (artifacts.weightData) {
      const weightBuffer: ArrayBuffer = Array.isArray(artifacts.weightData)
        ? artifacts.weightData[0]
        : artifacts.weightData;
      downloadBlob(
        new Blob([weightBuffer], {
          type: 'application/octet-stream',
        }),
        'sign-model.weights.bin',
      );
    }

    return {
      modelArtifactsInfo: {
        dateSaved: new Date(),
        modelTopologyType: 'JSON',
      },
    };
  });

  await model.save(handler);

  // Labels como JSON separado
  downloadBlob(
    new Blob([JSON.stringify(labels, null, 2)], { type: 'application/json' }),
    'labels.json',
  );

  console.info(
    '[ModelTrainer] Modelo exportado (sign-model.json + weights.bin + labels.json).',
  );
}
