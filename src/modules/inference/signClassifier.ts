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
 * Cruza se a ponta do indicador está à direita da do médio (em mão direita).
 */
function areIndexMiddleCrossed(landmarks: HandLandmarks): boolean {
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const indexPip = landmarks[6];
  const middlePip = landmarks[10];
  if (!indexTip || !middleTip || !indexPip || !middlePip) return false;

  // Se cruzaram, a ordem X das pontas é inversa à ordem X das PIPs
  return Math.abs(indexTip.x - middleTip.x) < 0.05 &&
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
 * Classifica um sinal estático de LIBRAS a partir dos 21 landmarks.
 * Suporta letras do alfabeto manual (A-Z, exceto dinâmicas: G, H, J, K, P, Q, Z)
 * e números 1-5.
 *
 * @param landmarks - 21 landmarks de uma mão.
 * @returns Letra/número detectado ou null se não reconhecido.
 */
export function classifySign(landmarks: HandLandmarks): ClassificationResult {
  const f = getFingerStates(landmarks);

  // --- NÚMEROS 1-5 ---

  // 5: mão aberta (todos estendidos incluindo polegar)
  if (f.thumb === 'extended' && allFourInState(f, 'extended')) {
    return { label: '5', confidence: 0.9 };
  }

  // 4: 4 dedos estendidos, polegar dobrado (diferente de B pelo polegar)
  if (f.thumb === 'folded' && allFourInState(f, 'extended')) {
    return { label: '4', confidence: 0.85 };
  }

  // 3: indicador + médio + anelar estendidos, mínimo e polegar dobrados
  if (
    f.index === 'extended' && f.middle === 'extended' && f.ring === 'extended' &&
    f.pinky === 'folded' && f.thumb === 'folded'
  ) {
    return { label: '3', confidence: 0.85 };
  }

  // 2 / V: indicador + médio estendidos
  if (f.index === 'extended' && f.middle === 'extended' && f.ring === 'folded' && f.pinky === 'folded') {
    if (areIndexMiddleSpread(landmarks)) {
      return { label: 'V', confidence: 0.85 };
    }
    return { label: '2', confidence: 0.8 };
  }

  // 1 / D: só indicador estendido
  if (f.index === 'extended' && f.middle === 'folded' && f.ring === 'folded' && f.pinky === 'folded') {
    // D: polegar tocando ou próximo aos dedos dobrados
    if (isThumbTouching(landmarks, 12, 0.12) || f.thumb === 'curled') {
      return { label: 'D', confidence: 0.8 };
    }
    return { label: '1', confidence: 0.85 };
  }

  // --- LETRAS ---

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

  // W: indicador + médio + anelar estendidos (igual ao 3 mas com polegar diferente)
  if (f.index === 'extended' && f.middle === 'extended' && f.ring === 'extended' && f.pinky === 'folded') {
    if (f.thumb === 'extended') {
      return { label: 'W', confidence: 0.85 };
    }
    return { label: '3', confidence: 0.85 };
  }

  // U: indicador + médio estendidos juntos (não espalhados)
  if (f.index === 'extended' && f.middle === 'extended' && f.ring === 'folded' && f.pinky === 'folded') {
    if (!areIndexMiddleSpread(landmarks)) {
      return { label: 'U', confidence: 0.8 };
    }
    return { label: 'V', confidence: 0.85 };
  }

  // R: indicador + médio cruzados
  if (f.index === 'extended' && f.middle === 'extended' && areIndexMiddleCrossed(landmarks)) {
    return { label: 'R', confidence: 0.7 };
  }

  // I: só mínimo estendido
  if (f.pinky === 'extended' && f.index === 'folded' && f.middle === 'folded' && f.ring === 'folded') {
    return { label: 'I', confidence: 0.85 };
  }

  // F: polegar + indicador em círculo, demais estendidos
  if (isCircleShape(landmarks) && f.middle === 'extended' && f.ring === 'extended' && f.pinky === 'extended') {
    return { label: 'F', confidence: 0.8 };
  }

  // X: indicador curvado (gancho), demais dobrados
  if (f.index === 'curled' && f.middle === 'folded' && f.ring === 'folded' && f.pinky === 'folded') {
    return { label: 'X', confidence: 0.75 };
  }

  // B: 4 dedos estendidos + polegar dobrado (igual ao 4, mas B tem polegar cruzado na palma)
  if (f.thumb === 'folded' && allFourInState(f, 'extended')) {
    // B: polegar cruzado (toca a palma) vs 4: polegar simplesmente dobrado
    if (isThumbTouching(landmarks, 9, 0.12)) {
      return { label: 'B', confidence: 0.75 };
    }
    return { label: '4', confidence: 0.85 };
  }

  // O: todos curvados em círculo (polegar tocando indicador)
  if (allFourInState(f, 'curled') && isCircleShape(landmarks)) {
    return { label: 'O', confidence: 0.75 };
  }

  // C: todos curvados mas não em círculo (mão aberta em C)
  if (allFourInState(f, 'curled') && !isCircleShape(landmarks)) {
    return { label: 'C', confidence: 0.7 };
  }

  // E: todos curvados tocando o polegar (mais fechado que C)
  if (allFourInState(f, 'curled') && f.thumb === 'curled') {
    return { label: 'E', confidence: 0.65 };
  }

  // --- LETRAS COM PUNHO FECHADO (A, S, M, N, T) ---

  if (allFourInState(f, 'folded')) {
    // T: polegar entre indicador e médio (polegar extended/curled, saindo entre os dedos)
    if (f.thumb === 'extended' || f.thumb === 'curled') {
      const thumbTip = landmarks[4];
      const indexPip = landmarks[6];
      const middlePip = landmarks[10];
      if (thumbTip && indexPip && middlePip) {
        const distToIndex = distance3D(thumbTip, indexPip);
        const distToMiddle = distance3D(thumbTip, middlePip);
        // Polegar entre os dois dedos
        if (distToIndex < 0.1 && distToMiddle < 0.1) {
          return { label: 'T', confidence: 0.7 };
        }
      }
      return { label: 'S', confidence: 0.65 };
    }

    // M: polegar dobrado sob 3 dedos (indicador, médio, anelar)
    // N: polegar dobrado sob 2 dedos (indicador, médio)
    // A: polegar dobrado ao lado do punho
    if (f.thumb === 'folded') {
      // Verificar se polegar está sob indicador+médio (M ou N) ou ao lado (A)
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];

      if (thumbTip && indexTip && middleTip) {
        // Se a ponta do polegar está perto das pontas dos dedos dobrados = M ou N
        const distToIndex = distance3D(thumbTip, indexTip);
        const distToMiddle = distance3D(thumbTip, middleTip);

        if (ringTip && distance3D(thumbTip, ringTip) < 0.12) {
          return { label: 'M', confidence: 0.7 };
        }
        if (distToIndex < 0.12 && distToMiddle < 0.12) {
          return { label: 'N', confidence: 0.65 };
        }
      }
      return { label: 'A', confidence: 0.75 };
    }
  }

  // Não reconhecido
  return { label: null, confidence: 0 };
}
