import * as tf from '@tensorflow/tfjs';

import type { HandLandmarks, ClassificationResult } from '@/types/hand';
import { flattenLandmarks } from '@/modules/training/dataCollector';
import { normalizeLandmarks } from '@/modules/training/modelTrainer';

/** Resultado nulo quando não há detecção. */
const NULL_RESULT: ClassificationResult = { label: null, confidence: 0 };

/**
 * Classifica um sinal de LIBRAS usando o modelo TF.js treinado.
 *
 * Pipeline:
 *   landmarks → flatten → normalizar (centro+pulso+espelho) → tensor → predict → argmax
 *
 * Toda operação com tensores é envolvida em `tf.tidy()` para disposal automático.
 *
 * @param landmarks - 21 pontos da mão detectada.
 * @param isLeftHand - Se a mão é esquerda (ativa espelhamento X).
 * @param model - Modelo TF.js carregado do IndexedDB.
 * @param labels - Mapeamento índice → letra (do localStorage).
 * @returns Letra prevista com confiança.
 */
export function classifyWithModel(
  landmarks: HandLandmarks,
  isLeftHand: boolean,
  model: tf.LayersModel,
  labels: string[],
): ClassificationResult {
  if (landmarks.length !== 21) {
    return NULL_RESULT;
  }

  return tf.tidy(() => {
    const features = flattenLandmarks(landmarks);
    const normalized = normalizeLandmarks(features, isLeftHand);
    const input = tf.tensor2d([normalized]);
    const prediction = model.predict(input) as tf.Tensor;

    // dataSync é síncrono — modelo pequeno (< 1ms), seguro no requestAnimationFrame
    const scores = Array.from(prediction.dataSync());

    let maxIdx = 0;
    let maxScore = scores[0];
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > maxScore) {
        maxScore = scores[i];
        maxIdx = i;
      }
    }

    return {
      label: labels[maxIdx] ?? null,
      confidence: maxScore,
    };
  });
}

/**
 * Versão batch: classifica múltiplos frames de uma vez.
 * Útil para processamento offline ou validação.
 */
export function classifyBatch(
  frames: HandLandmarks[],
  isLeftHand: boolean,
  model: tf.LayersModel,
  labels: string[],
): ClassificationResult[] {
  return tf.tidy(() => {
    const normalized = frames.map((lm) => {
      const features = flattenLandmarks(lm);
      return normalizeLandmarks(features, isLeftHand);
    });
    const input = tf.tensor2d(normalized);         // [N, 63]
    const prediction = model.predict(input) as tf.Tensor;  // [N, C]
    const scoresMatrix = prediction.arraySync() as number[][];

    return scoresMatrix.map((scores) => {
      let maxIdx = 0;
      let maxScore = scores[0];
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > maxScore) {
          maxScore = scores[i];
          maxIdx = i;
        }
      }
      return {
        label: labels[maxIdx] ?? null,
        confidence: maxScore,
      };
    });
  });
}
