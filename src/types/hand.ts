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
  handedness: ('Left' | 'Right')[];
}

/** Conexões do esqueleto da mão (índices dos pares de landmarks). */
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Polegar
  [0, 5], [5, 6], [6, 7], [7, 8], // Indicador
  [5, 9], [9, 10], [10, 11], [11, 12], // Médio
  [9, 13], [13, 14], [14, 15], [15, 16], // Anelar
  [13, 17], [17, 18], [18, 19], [19, 20], // Mínimo
  [0, 17], // Palma
];
