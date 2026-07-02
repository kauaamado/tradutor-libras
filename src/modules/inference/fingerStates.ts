import type { HandLandmarks, FingerStates, FingerState } from '@/types/hand';
import { FINGER_LANDMARKS } from '@/types/hand';

/** Ângulo mínimo (em graus) para considerar um dedo estendido. */
const EXTENDED_ANGLE_THRESHOLD = 160;

/** Ângulo máximo (em graus) para considerar um dedo dobrado. */
const FOLDED_ANGLE_THRESHOLD = 70;

/**
 * Calcula o ângulo entre três pontos (em graus), usando o ponto central como vértice.
 */
function angleBetween(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);

  if (magBA === 0 || magBC === 0) return 0;

  const cos = Math.min(1, Math.max(-1, dot / (magBA * magBC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Determina o estado de um dedo (exceto polegar) a partir dos ângulos das juntas.
 * Usa os índices [tip, dip, pip, mcp] do dedo.
 */
function classifyFinger(landmarks: HandLandmarks, indices: readonly number[]): FingerState {
  const [tipIdx, dipIdx, pipIdx, mcpIdx] = indices;
  const tip = landmarks[tipIdx];
  const dip = landmarks[dipIdx];
  const pip = landmarks[pipIdx];
  const mcp = landmarks[mcpIdx];

  if (!tip || !dip || !pip || !mcp) return 'folded';

  // Ângulo na junta PIP (entre MCP→PIP e PIP→DIP)
  const pipAngle = angleBetween(mcp, pip, dip);
  // Ângulo na junta DIP (entre PIP→DIP e DIP→TIP)
  const dipAngle = angleBetween(pip, dip, tip);

  // Dedo estendido: ambas as juntas quase retas
  if (pipAngle >= EXTENDED_ANGLE_THRESHOLD && dipAngle >= EXTENDED_ANGLE_THRESHOLD) {
    return 'extended';
  }

  // Dedo curvado: juntas significativamente dobradas
  if (pipAngle < FOLDED_ANGLE_THRESHOLD) {
    return 'folded';
  }

  // Estado intermediário (curvado parcialmente, como em C, E, O)
  return 'curled';
}

/**
 * Determina o estado do polegar.
 * O polegar tem anatomia diferente — usa o ângulo na junta IP e a distância da ponta ao punho.
 */
function classifyThumb(landmarks: HandLandmarks): FingerState {
  const wrist = landmarks[0];
  const cmc = landmarks[1]; // base do polegar
  const mcp = landmarks[2];
  const ip = landmarks[3];
  const tip = landmarks[4];

  if (!wrist || !cmc || !mcp || !ip || !tip) return 'folded';

  // Ângulo na junta IP (entre MCP→IP e IP→TIP)
  const ipAngle = angleBetween(mcp, ip, tip);

  // Distância da ponta do polegar ao punho vs distância da base ao punho
  const tipToWrist = Math.sqrt(
    (tip.x - wrist.x) ** 2 + (tip.y - wrist.y) ** 2 + (tip.z - wrist.z) ** 2,
  );
  const cmcToWrist = Math.sqrt(
    (cmc.x - wrist.x) ** 2 + (cmc.y - wrist.y) ** 2 + (cmc.z - wrist.z) ** 2,
  );

  // Polegar estendido: IP reta E ponta longe do punho (mais longe que a base)
  if (ipAngle >= EXTENDED_ANGLE_THRESHOLD && tipToWrist > cmcToWrist * 1.5) {
    return 'extended';
  }

  // Polegar dobrado: IP muito dobrada
  if (ipAngle < FOLDED_ANGLE_THRESHOLD) {
    return 'folded';
  }

  return 'curled';
}

/**
 * Calcula o estado de todos os 5 dedos a partir dos 21 landmarks.
 *
 * @param landmarks - Array com 21 landmarks (ponta → base por dedo).
 * @returns Estado de cada dedo (extended, folded, curled).
 */
export function getFingerStates(landmarks: HandLandmarks): FingerStates {
  return {
    thumb: classifyThumb(landmarks),
    index: classifyFinger(landmarks, FINGER_LANDMARKS.index),
    middle: classifyFinger(landmarks, FINGER_LANDMARKS.middle),
    ring: classifyFinger(landmarks, FINGER_LANDMARKS.ring),
    pinky: classifyFinger(landmarks, FINGER_LANDMARKS.pinky),
  };
}

/**
 * Calcula a distância 3D entre dois landmarks.
 */
export function distance3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Verifica se a ponta do polegar está próxima da ponta de outro dedo.
 * @param landmarks - Array com 21 landmarks.
 * @param fingerTipIdx - Índice da ponta do dedo a comparar (ex: 8 = indicador).
 * @param threshold - Distância máxima normalizada para considerar "tocando".
 */
export function isThumbTouching(
  landmarks: HandLandmarks,
  fingerTipIdx: number,
  threshold = 0.1,
): boolean {
  const thumbTip = landmarks[4];
  const fingerTip = landmarks[fingerTipIdx];
  if (!thumbTip || !fingerTip) return false;
  return distance3D(thumbTip, fingerTip) < threshold;
}
