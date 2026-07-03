import type { HandLandmarks, ClassificationResult, FingerStates } from '@/types/hand';
import { getFingerStates, isThumbTouching, distance3D } from './fingerStates';

/** Helper: verifica se os 4 dedos (sem polegar) estão no mesmo estado. */
function allFourInState(f: FingerStates, state: FingerStates['index']): boolean {
  return f.index === state && f.middle === state && f.ring === state && f.pinky === state;
}

/** Helper: verifica se indicador e médio estão espalhados (para distinguir V de U). */
function areIndexMiddleSpread(landmarks: HandLandmarks): boolean {
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const indexMcp = landmarks[5];
  if (!indexTip || !middleTip || !indexMcp) return false;

  const distTips = distance3D(indexTip, middleTip);
  const distMcps = distance3D(landmarks[5], landmarks[9]);
  return distTips > distMcps * 1.5;
}

/**
 * Verifica se indicador e médio estão cruzados (letra R).
 * Cruza se as pontas estão próximas em X e a ordem Y das pontas é inversa à ordem Y das PIPs.
 */
function areIndexMiddleCrossed(landmarks: HandLandmarks): boolean {
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const indexPip = landmarks[6];
  const middlePip = landmarks[10];
  if (!indexTip || !middleTip || !indexPip || !middlePip) return false;

  // Pontas próximas em X (cruzadas horizontalmente)
  // Ordem Y das pontas é inversa à ordem Y das PIPs (cruzamento vertical)
  // Threshold de 0.15 para detectar cruzamento real
  return Math.abs(indexTip.x - middleTip.x) < 0.15 &&
    (indexTip.y - middleTip.y) * (indexPip.y - middlePip.y) < 0;
}

/**
 * Verifica se a mão está em formato de círculo (O, F).
 * Polegar tocando indicador + demais dedos estendidos ou curvados.
 */
function isCircleShape(landmarks: HandLandmarks): boolean {
  return isThumbTouching(landmarks, 8, 0.08);
}

/**
 * Verifica se o polegar está sanduichado entre as PIPs do indicador e médio (letra T).
 * O polegar deve estar visualmente entre os dois dedos (Y entre as PIPs) e perto delas.
 */
function isThumbBetweenIndexMiddle(landmarks: HandLandmarks): boolean {
  const thumbTip = landmarks[4];
  const indexPip = landmarks[6];
  const middlePip = landmarks[10];
  if (!thumbTip || !indexPip || !middlePip) return false;

  const distToIndex = distance3D(thumbTip, indexPip);
  const distToMiddle = distance3D(thumbTip, middlePip);

  // Polegar deve estar perto de ambas as PIPs (threshold mais rígido: 0.06)
  if (distToIndex > 0.06 || distToMiddle > 0.06) return false;

  // Polegar Y deve estar entre as PIPs (visualmente entre os dedos)
  const minY = Math.min(indexPip.y, middlePip.y);
  const maxY = Math.max(indexPip.y, middlePip.y);
  return thumbTip.y >= minY && thumbTip.y <= maxY;
}

/** Resultado nulo quando não há detecção. */
const NULL_RESULT: ClassificationResult = { label: null, confidence: 0 };

/**
 * Classifica um sinal estático de LIBRAS a partir dos 21 landmarks.
 * Suporta letras do alfabeto manual (A-Z, exceto dinâmicas: G, H, J, K, P, Q, Z).
 *
 * @param landmarks - 21 landmarks de uma mão.
 * @returns Letra detectada ou null se não reconhecido.
 */
export function classifySign(landmarks: HandLandmarks): ClassificationResult {
  // Defense-in-depth: requer exatamente 21 landmarks válidos
  if (landmarks.length !== 21) {
    return NULL_RESULT;
  }

  const f = getFingerStates(landmarks);

  // --- GRUPO 1: DEDOS ÚNICOS (muito específicos) ---

  // I: só mínimo estendido
  if (f.pinky === 'extended' && f.index === 'folded' && f.middle === 'folded' && f.ring === 'folded') {
    return { label: 'I', confidence: 0.9 };
  }

  // Y: polegar + mínimo estendidos, demais dobrados
  if (f.thumb === 'extended' && f.pinky === 'extended' &&
      f.index === 'folded' && f.middle === 'folded' && f.ring === 'folded') {
    return { label: 'Y', confidence: 0.9 };
  }

  // L: indicador + polegar estendidos, demais dobrados
  if (f.thumb === 'extended' && f.index === 'extended' &&
      f.middle === 'folded' && f.ring === 'folded' && f.pinky === 'folded') {
    return { label: 'L', confidence: 0.9 };
  }

  // D: só indicador estendido
  if (f.index === 'extended' && f.middle === 'folded' && f.ring === 'folded' && f.pinky === 'folded') {
    return { label: 'D', confidence: 0.85 };
  }

  // --- GRUPO 2: PAR CRUZADO ---

  // R: indicador + médio cruzados
  if (f.index === 'extended' && f.middle === 'extended' && areIndexMiddleCrossed(landmarks)) {
    return { label: 'R', confidence: 0.75 };
  }

  // --- GRUPO 3: PAR INDICADOR+MÉDIO ---

  // V: indicador + médio estendidos + espalhados
  // U: indicador + médio estendidos + não espalhados
  if (f.index === 'extended' && f.middle === 'extended' && f.ring === 'folded' && f.pinky === 'folded') {
    if (areIndexMiddleSpread(landmarks)) {
      return { label: 'V', confidence: 0.85 };
    }
    return { label: 'U', confidence: 0.8 };
  }

  // --- GRUPO 4: TRIO ---

  // W: indicador + médio + anelar estendidos, mínimo dobrado
  if (f.index === 'extended' && f.middle === 'extended' && f.ring === 'extended' && f.pinky === 'folded') {
    return { label: 'W', confidence: 0.85 };
  }

  // --- GRUPO 5: 4 DEDOS / CÍRCULO+ESTENDIDOS ---

  // F: polegar+indicador em círculo, demais estendidos
  if (isCircleShape(landmarks) && f.middle === 'extended' && f.ring === 'extended' && f.pinky === 'extended') {
    return { label: 'F', confidence: 0.8 };
  }

  // B: 4 dedos estendidos, polegar dobrado
  if (f.thumb === 'folded' && allFourInState(f, 'extended')) {
    return { label: 'B', confidence: 0.85 };
  }

  // --- GRUPO 6: CURVADOS (ordem: O → E → C) ---

  // O: todos curvados + círculo (polegar toca indicador)
  if (allFourInState(f, 'curled') && isCircleShape(landmarks)) {
    return { label: 'O', confidence: 0.75 };
  }

  // E: todos curvados + polegar curvado (fechado, polegar curvado)
  if (allFourInState(f, 'curled') && f.thumb === 'curled') {
    return { label: 'E', confidence: 0.7 };
  }

  // C: todos curvados + não é O nem E (mais aberto, polegar estendido/curled mas não tocando)
  if (allFourInState(f, 'curled') && !isCircleShape(landmarks) && f.thumb !== 'curled') {
    return { label: 'C', confidence: 0.65 };
  }

  // --- GRUPO 7: ÍNDICE CURVADO ---

  // X: indicador curvado (gancho), demais dobrados
  if (f.index === 'curled' && f.middle === 'folded' && f.ring === 'folded' && f.pinky === 'folded') {
    return { label: 'X', confidence: 0.75 };
  }

  // --- GRUPO 8: PUNHO + POLEGAR ADELANTE (S e T) ---

  // S: punho fechado + polegar extended/curled (cruza a frente, NÃO entre dedos)
  // T: punho fechado + polegar sanduichado entre indicador e médio
  if (allFourInState(f, 'folded') && (f.thumb === 'extended' || f.thumb === 'curled')) {
    if (isThumbBetweenIndexMiddle(landmarks)) {
      return { label: 'T', confidence: 0.75 };
    }
    return { label: 'S', confidence: 0.7 };
  }

  // --- GRUPO 9: PUNHO + POLEGAR DOBRADO ---

  // M: punho fechado + polegar folded + ponta perto de 3 pontas (indicador, médio, anelar)
  // N: punho fechado + polegar folded + ponta perto de 2 pontas (indicador, médio)
  // A: punho fechado + polegar folded (lateral do punho)
  if (allFourInState(f, 'folded') && f.thumb === 'folded') {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];

    if (thumbTip && indexTip && middleTip) {
      const distToIndex = distance3D(thumbTip, indexTip);
      const distToMiddle = distance3D(thumbTip, middleTip);
      const distToRing = ringTip ? distance3D(thumbTip, ringTip) : Infinity;

      // M: polegar perto de 3 pontas
      if (distToIndex < 0.10 && distToMiddle < 0.10 && distToRing < 0.10) {
        return { label: 'M', confidence: 0.7 };
      }
      // N: polegar perto de 2 pontas
      if (distToIndex < 0.10 && distToMiddle < 0.10) {
        return { label: 'N', confidence: 0.65 };
      }
    }
    // A: polegar dobrado na lateral do punho
    return { label: 'A', confidence: 0.75 };
  }

  // Não reconhecido
  return NULL_RESULT;
}
