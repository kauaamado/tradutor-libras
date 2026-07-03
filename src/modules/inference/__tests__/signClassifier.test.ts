import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks de fingerStates são hoisted pelo vitest
vi.mock('@/modules/inference/fingerStates', () => ({
  getFingerStates: vi.fn(),
  isThumbTouching: vi.fn(),
  distance3D: vi.fn(),
}));

import { classifySign } from '@/modules/inference/signClassifier';
import { getFingerStates, isThumbTouching, distance3D } from '@/modules/inference/fingerStates';
import type { FingerStates, HandLandmarks } from '@/types/hand';

const mockGetFingerStates = vi.mocked(getFingerStates);
const mockIsThumbTouching = vi.mocked(isThumbTouching);
const mockDistance3D = vi.mocked(distance3D);

function lm(_x = 0, _y = 0, _z = 0) {
  return { x: _x, y: _y, z: _z };
}

/** Cria 21 landmarks com posições fictícias (os valores não importam com mocks). */
function fakeHand(): HandLandmarks {
  return Array.from({ length: 21 }, (_, i) => lm(0.5, 0.3 + i * 0.02));
}

function setFingerStates(overrides: Partial<FingerStates>): FingerStates {
  return {
    thumb: 'folded',
    index: 'folded',
    middle: 'folded',
    ring: 'folded',
    pinky: 'folded',
    ...overrides,
  };
}

beforeEach(() => {
  mockGetFingerStates.mockReset();
  mockIsThumbTouching.mockReset();
  mockDistance3D.mockReset();

  mockGetFingerStates.mockReturnValue(setFingerStates({}));
  mockIsThumbTouching.mockReturnValue(false);
  mockDistance3D.mockReturnValue(1); // distância grande por padrão
});

// --- Testes ---

describe('classifySign', () => {
  it('retorna null para array vazio (defense-in-depth)', () => {
    const result = classifySign([]);
    expect(result.label).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('retorna null para menos de 21 landmarks', () => {
    const result = classifySign([lm()]);
    expect(result.label).toBeNull();
  });

  it('retorna null quando nenhuma configuração é reconhecida', () => {
    // Todos folded + thumb extended (seria S ou T)
    // Mas distance3D alta → não entre PIPs → S
    mockGetFingerStates.mockReturnValue(setFingerStates({ thumb: 'extended' }));
    // S é o fallback desse grupo, então vai retornar S, não null
    // Para testar null, precisamos de outras combinações

    // Testa: D tem que ser ext+fold+fold+fold
    mockGetFingerStates.mockReturnValue(setFingerStates({
      index: 'curled', middle: 'extended', ring: 'folded', pinky: 'folded',
    }));
    expect(classifySign(fakeHand()).label).toBeNull();
  });

  // --- GRUPO 1: DEDOS ÚNICOS ---

  describe('letra I', () => {
    it('detecta I: só mínimo estendido', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ pinky: 'extended' }));
      expect(classifySign(fakeHand()).label).toBe('I');
    });
  });

  describe('letra Y', () => {
    it('detecta Y: polegar + mínimo estendidos', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        thumb: 'extended', pinky: 'extended',
      }));
      expect(classifySign(fakeHand()).label).toBe('Y');
    });
  });

  describe('letra L', () => {
    it('detecta L: polegar + indicador estendidos', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        thumb: 'extended', index: 'extended',
      }));
      expect(classifySign(fakeHand()).label).toBe('L');
    });
  });

  describe('letra D', () => {
    it('detecta D: só indicador estendido', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ index: 'extended' }));
      expect(classifySign(fakeHand()).label).toBe('D');
    });
  });

  // --- GRUPO 3: PAR INDICADOR+MÉDIO ---

  describe('letra V', () => {
    it('detecta V: indicador+médio estendidos e espalhados', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        index: 'extended', middle: 'extended',
      }));

      // areIndexMiddleSpread: distTips > distMcps * 1.5
      // Chamada 1: distTips (landmarks[8] vs landmarks[12])
      // Chamada 2: distMcps (landmarks[5] vs landmarks[9])
      mockDistance3D
        .mockReturnValueOnce(0.3)  // distTips grande
        .mockReturnValueOnce(0.1);  // distMcps pequena

      expect(classifySign(fakeHand()).label).toBe('V');
    });
  });

  describe('letra U', () => {
    it('detecta U: indicador+médio estendidos e juntos', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        index: 'extended', middle: 'extended',
      }));

      // distTips <= distMcps * 1.5 → não espalhado
      mockDistance3D
        .mockReturnValueOnce(0.1)  // distTips
        .mockReturnValueOnce(0.1);  // distMcps

      expect(classifySign(fakeHand()).label).toBe('U');
    });
  });

  // --- GRUPO 4: TRIO ---

  describe('letra W', () => {
    it('detecta W: indicador+médio+anelar estendidos', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        index: 'extended', middle: 'extended', ring: 'extended',
      }));
      expect(classifySign(fakeHand()).label).toBe('W');
    });
  });

  // --- GRUPO 5: 4 DEDOS / CÍRCULO+ESTENDIDOS ---

  describe('letra F', () => {
    it('detecta F: círculo + demais 3 estendidos', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        middle: 'extended', ring: 'extended', pinky: 'extended',
      }));
      mockIsThumbTouching.mockReturnValue(true);

      expect(classifySign(fakeHand()).label).toBe('F');
    });
  });

  describe('letra B', () => {
    it('detecta B: 4 dedos estendidos, polegar dobrado', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        thumb: 'folded',
        index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended',
      }));
      expect(classifySign(fakeHand()).label).toBe('B');
    });
  });

  // --- GRUPO 6: CURVADOS ---

  describe('letra O', () => {
    it('detecta O: todos curvados + círculo', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled',
      }));
      mockIsThumbTouching.mockReturnValue(true);

      expect(classifySign(fakeHand()).label).toBe('O');
    });
  });

  describe('letra E', () => {
    it('detecta E: todos curvados + polegar curvado', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        thumb: 'curled',
        index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled',
      }));
      // isCircleShape retorna false (isThumbTouching = false)
      mockIsThumbTouching.mockReturnValue(false);

      expect(classifySign(fakeHand()).label).toBe('E');
    });
  });

  describe('letra C', () => {
    it('detecta C: todos curvados + polegar não curvado + sem círculo', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        thumb: 'extended',
        index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled',
      }));
      mockIsThumbTouching.mockReturnValue(false);

      expect(classifySign(fakeHand()).label).toBe('C');
    });
  });

  // --- GRUPO 7: ÍNDICE CURVADO ---

  describe('letra X', () => {
    it('detecta X: indicador curvado, demais dobrados', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ index: 'curled' }));
      expect(classifySign(fakeHand()).label).toBe('X');
    });
  });

  // --- GRUPO 8: PUNHO + POLEGAR ADELANTE ---

  describe('letras S e T', () => {
    it('detecta S: punho fechado + polegar estendido (fora das PIPs)', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ thumb: 'extended' }));
      // isThumbBetweenIndexMiddle usa distance3D → retorna 1 (alto) → não entre
      mockDistance3D.mockReturnValue(1);

      expect(classifySign(fakeHand()).label).toBe('S');
    });

    it('detecta T: punho fechado + polegar entre indicador e médio', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ thumb: 'extended' }));

      // distancia3D deve retornar baixo para isThumbBetweenIndexMiddle
      mockDistance3D.mockReturnValue(0.01);

      // Landmarks com polegar Y entre as PIPs do indicador e médio
      const tHand: HandLandmarks = [
        lm(0.5, 0.5),
        lm(0.5, 0.55), lm(0.5, 0.57), lm(0.5, 0.58), lm(0.45, 0.59), // thumb tip Y=0.59
        lm(0.4, 0.5), lm(0.4, 0.58), lm(0.4, 0.62), lm(0.4, 0.68),    // index pip Y=0.58
        lm(0.5, 0.5), lm(0.5, 0.60), lm(0.5, 0.64), lm(0.5, 0.70),    // middle pip Y=0.60
        lm(0.55, 0.5), lm(0.55, 0.55), lm(0.55, 0.58), lm(0.55, 0.62),
        lm(0.60, 0.5), lm(0.60, 0.55), lm(0.60, 0.58), lm(0.60, 0.62),
      ];
      // thumb tip Y=0.59 >= 0.58 && 0.59 <= 0.60 ✓ (entre as PIPs)

      expect(classifySign(tHand).label).toBe('T');
    });

    it('detecta S: punho fechado + polegar curled', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ thumb: 'curled' }));
      mockDistance3D.mockReturnValue(1);

      expect(classifySign(fakeHand()).label).toBe('S');
    });
  });

  // --- GRUPO 9: PUNHO + POLEGAR DOBRADO ---

  describe('letras M, N, A', () => {
    it('detecta M: polegar folded perto de 3 pontas', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ thumb: 'folded' }));
      // distance3D chamada 3x: thumb→index, thumb→middle, thumb→ring
      // Todas < 0.10
      mockDistance3D.mockReturnValue(0.05);

      expect(classifySign(fakeHand()).label).toBe('M');
    });

    it('detecta N: polegar folded perto de 2 pontas', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ thumb: 'folded' }));
      // distToIndex < 0.10, distToMiddle < 0.10, distToRing >= 0.10
      mockDistance3D
        .mockReturnValueOnce(0.05)  // thumb→index
        .mockReturnValueOnce(0.05)  // thumb→middle
        .mockReturnValueOnce(0.5);   // thumb→ring

      expect(classifySign(fakeHand()).label).toBe('N');
    });

    it('detecta A: polegar folded longe de todas as pontas', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({ thumb: 'folded' }));
      mockDistance3D.mockReturnValue(0.5); // longe de tudo

      expect(classifySign(fakeHand()).label).toBe('A');
    });
  });

  // --- GRUPO 2: PAR CRUZADO ---

  describe('letra R', () => {
    it('detecta R: indicador+médio cruzados', () => {
      mockGetFingerStates.mockReturnValue(setFingerStates({
        index: 'extended', middle: 'extended',
      }));

      // areIndexMiddleCrossed: precisa de X próximos e Y invertidos
      //   Math.abs(indexTip.x - middleTip.x) < 0.15
      //   (indexTip.y - middleTip.y) * (indexPip.y - middlePip.y) < 0
      const hand: HandLandmarks = [
        lm(0.5, 0.5),
        lm(0.5, 0.55), lm(0.5, 0.57), lm(0.5, 0.58), lm(0.45, 0.59), // thumb
        lm(0.4, 0.5), lm(0.4, 0.58), lm(0.4, 0.62), lm(0.55, 0.68),   // index (PIP Y=0.58, TIP Y=0.68)
        lm(0.5, 0.5), lm(0.5, 0.60), lm(0.5, 0.62), lm(0.56, 0.64),   // middle (PIP Y=0.60, TIP Y=0.64)
        lm(0.55, 0.5), lm(0.55, 0.55), lm(0.55, 0.58), lm(0.55, 0.62),
        lm(0.60, 0.5), lm(0.60, 0.55), lm(0.60, 0.58), lm(0.60, 0.62),
      ];
      // |0.55 - 0.56| = 0.01 < 0.15 ✓
      // indexPip > middlePip (0.58 > 0.60)? NÃO. indexPip Y=0.58, middlePip Y=0.60
      // (indexTip.y - middleTip.y) = 0.68 - 0.64 = 0.04 > 0
      // (indexPip.y - middlePip.y) = 0.58 - 0.60 = -0.02 < 0
      // Produto: 0.04 * -0.02 = -0.0008 < 0 ✓

      expect(classifySign(hand).label).toBe('R');
    });
  });
});
