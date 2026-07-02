import {
  HandLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

import type { HandTrackingResult, HandLandmarks } from '@/types/hand';

let landmarker: HandLandmarker | null = null;

/**
 * Carrega o HandLandmarker do MediaPipe (WASM) uma única vez.
 * Usa CDN jsdelivr para os arquivos WASM.
 */
export async function initHandLandmarker(): Promise<void> {
  if (landmarker) {
    console.info('[HandTracker] HandLandmarker já carregado.');
    return;
  }

  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
    );

    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    });

    console.info('[HandTracker] HandLandmarker carregado com sucesso.');
  } catch (error) {
    console.error('[HandTracker] Erro ao carregar HandLandmarker:', error);
    throw error;
  }
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
    console.warn('[HandTracker] HandLandmarker não inicializado. Chame initHandLandmarker() primeiro.');
    return null;
  }

  const result: HandLandmarkerResult = landmarker.detectForVideo(video, timestamp);

  if (!result.landmarks || result.landmarks.length === 0) {
    return null;
  }

  const landmarks: HandLandmarks[] = result.landmarks as HandLandmarks[];
  const handedness = result.handedness.map(
    (h) => (h[0].categoryName === 'Left' ? 'Left' : 'Right') as 'Left' | 'Right',
  );

  return { landmarks, handedness };
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
