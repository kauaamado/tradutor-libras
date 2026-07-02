/** Coordenadas normalizadas de um ponto da mão (0.0 a 1.0). */
export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

/** 21 landmarks de uma mão (63 valores: 21 x 3). */
export type HandLandmarks = HandLandmark[];

/** Resultado do HandLandmarker para um frame. */
export interface HandTrackingResult {
  landmarks: HandLandmarks[];
  worldLandmarks: HandLandmarks[];
  handedness: ('Left' | 'Right')[];
}

/** Estado de um dedo individual. */
export type FingerState = 'extended' | 'folded' | 'curled';

/** Estado de todos os 5 dedos de uma mão. */
export interface FingerStates {
  thumb: FingerState;
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  pinky: FingerState;
}

/** Resultado da classificação de um sinal. */
export interface ClassificationResult {
  label: string | null;
  confidence: number;
}

/** Índices dos landmarks de cada dedo (ponta → base). */
export const FINGER_LANDMARKS = {
  thumb: [4, 3, 2, 1],
  index: [8, 7, 6, 5],
  middle: [12, 11, 10, 9],
  ring: [16, 15, 14, 13],
  pinky: [20, 19, 18, 17],
} as const;
