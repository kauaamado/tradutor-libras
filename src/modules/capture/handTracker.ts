import {
  HandLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

import type { HandTrackingResult, HandLandmarks } from '@/types/hand';

/** Versão do @mediapipe/tasks-vision — deve acompanhar o package.json. */
const MEDIAPIPE_VERSION = '0.10.35';

/** URL do CDN para os arquivos WASM do MediaPipe. */
const WASM_CDN_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;

/** URL do modelo pré-treinado de hand landmarker. */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/** Conexões do esqueleto da mão (índices dos pares de landmarks). */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Polegar
  [0, 5], [5, 6], [6, 7], [7, 8], // Indicador
  [5, 9], [9, 10], [10, 11], [11, 12], // Médio
  [9, 13], [13, 14], [14, 15], [15, 16], // Anelar
  [13, 17], [17, 18], [18, 19], [19, 20], // Mínimo
  [0, 17], // Palma
];

let landmarker: HandLandmarker | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Carrega o HandLandmarker do MediaPipe (WASM) uma única vez.
 * Usa cache de Promise para evitar race condition em React StrictMode.
 */
export function initHandLandmarker(): Promise<void> {
  if (landmarker) {
    return Promise.resolve();
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = doInit()
    .catch((error) => {
      console.error('[HandTracker] Erro ao carregar HandLandmarker:', error);
      initPromise = null; // permite retry em caso de falha
      throw error;
    });

  return initPromise;
}

async function doInit(): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(WASM_CDN_URL);

  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
  });

  console.info('[HandTracker] HandLandmarker carregado com sucesso.');
}

/**
 * Processa um frame de vídeo e retorna os landmarks detectados.
 *
 * @param video - Elemento <video> com o feed da webcam.
 * @param timestamp - Timestamp do frame (performance.now()).
 * @returns Resultado com landmarks de cada mão detectada, ou null se nenhuma mão.
 */
export function detectHands(
  video: HTMLVideoElement,
  timestamp: number,
): HandTrackingResult | null {
  if (!landmarker) {
    console.warn(
      '[HandTracker] HandLandmarker não inicializado. Chame initHandLandmarker() primeiro.',
    );
    return null;
  }

  const result: HandLandmarkerResult = landmarker.detectForVideo(video, timestamp);

  if (!result.landmarks || result.landmarks.length === 0) {
    return null;
  }

  const landmarks: HandLandmarks[] = result.landmarks as HandLandmarks[];
  const worldLandmarks: HandLandmarks[] =
    (result.worldLandmarks as HandLandmarks[]) ?? [];
  const handedness = result.handedness.map(
    (h) => (h[0].categoryName === 'Left' ? 'Left' : 'Right') as 'Left' | 'Right',
  );

  return { landmarks, worldLandmarks, handedness };
}

/**
 * Verifica se nenhum landmark é nulo antes de alimentar o modelo.
 *
 * @param landmarks - Lista de landmarks de uma mão.
 * @returns true se todos os 63 valores são válidos (não-null, não-NaN).
 */
export function validateLandmarks(landmarks: HandLandmarks): boolean {
  if (!landmarks || landmarks.length !== 21) {
    return false;
  }

  return landmarks.every(
    (lm) =>
      lm != null &&
      typeof lm.x === 'number' &&
      typeof lm.y === 'number' &&
      typeof lm.z === 'number' &&
      !Number.isNaN(lm.x) &&
      !Number.isNaN(lm.y) &&
      !Number.isNaN(lm.z),
  );
}
