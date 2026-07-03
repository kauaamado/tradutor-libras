import { describe, it, expect } from 'vitest';

import { getFingerStates, distance3D, isThumbTouching } from '@/modules/inference/fingerStates';
import type { HandLandmarks, HandLandmark } from '@/types/hand';

// --- Helpers ---

function lm(x = 0, y = 0, z = 0): HandLandmark {
  return { x, y, z };
}

/** Cria dedo estendido (reto, ~180° nas juntas) a partir do MCP. */
function extendedFingerJoints(mcp: HandLandmark, seg = 0.08): [HandLandmark, HandLandmark, HandLandmark, HandLandmark] {
  return [
    mcp,
    lm(mcp.x, mcp.y + seg),
    lm(mcp.x, mcp.y + seg * 2),
    lm(mcp.x, mcp.y + seg * 3),
  ];
}

/** Cria dedo dobrado (~60° no PIP). */
function foldedFingerJoints(mcp: HandLandmark, seg = 0.08): [HandLandmark, HandLandmark, HandLandmark, HandLandmark] {
  // 60° entre MCP→PIP e PIP→DIP
  const sin60 = Math.sin(Math.PI / 3);
  const cos60 = Math.cos(Math.PI / 3);
  const pip = lm(mcp.x, mcp.y + seg);
  const dip = lm(pip.x + seg * sin60, pip.y - seg * cos60);
  const tip = lm(dip.x + seg * sin60, dip.y - seg * cos60);
  return [mcp, pip, dip, tip];
}

/** Cria dedo curvado (~135° no PIP). */
function curledFingerJoints(mcp: HandLandmark, seg = 0.08): [HandLandmark, HandLandmark, HandLandmark, HandLandmark] {
  // 135° entre MCP→PIP e PIP→DIP
  const sin135 = Math.sin(3 * Math.PI / 4);
  const cos135 = Math.cos(3 * Math.PI / 4);
  const pip = lm(mcp.x, mcp.y + seg);
  const dip = lm(pip.x + seg * sin135, pip.y - seg * cos135);
  const tip = lm(dip.x + seg * sin135, dip.y - seg * cos135);
  return [mcp, pip, dip, tip];
}

/** Cria 21 landmarks da mão inteira a partir das juntas de cada dedo. */
function buildHand(
  wrist: HandLandmark,
  thumb: [HandLandmark, HandLandmark, HandLandmark, HandLandmark],
  index: [HandLandmark, HandLandmark, HandLandmark, HandLandmark],
  middle: [HandLandmark, HandLandmark, HandLandmark, HandLandmark],
  ring: [HandLandmark, HandLandmark, HandLandmark, HandLandmark],
  pinky: [HandLandmark, HandLandmark, HandLandmark, HandLandmark],
): HandLandmarks {
  return [
    wrist,           // 0
    thumb[0], thumb[1], thumb[2], thumb[3],   // 1-4
    index[0], index[1], index[2], index[3],   // 5-8
    middle[0], middle[1], middle[2], middle[3], // 9-12
    ring[0], ring[1], ring[2], ring[3],       // 13-16
    pinky[0], pinky[1], pinky[2], pinky[3],   // 17-20
  ];
}

const wrist = lm(0.5, 0.6);
const SEG = 0.08;

// --- Testes ---

describe('getFingerStates', () => {
  it('detecta mão totalmente estendida', () => {
    const hand = buildHand(
      wrist,
      extendedFingerJoints(lm(0.53, 0.58), SEG), // thumb
      extendedFingerJoints(lm(0.45, 0.60), SEG), // index
      extendedFingerJoints(lm(0.50, 0.60), SEG), // middle
      extendedFingerJoints(lm(0.55, 0.60), SEG), // ring
      extendedFingerJoints(lm(0.60, 0.60), SEG), // pinky
    );

    const states = getFingerStates(hand);

    // Polegar estendido: IP reta + ponta longe do pulso
    expect(states.thumb).toBe('extended');
    expect(states.index).toBe('extended');
    expect(states.middle).toBe('extended');
    expect(states.ring).toBe('extended');
    expect(states.pinky).toBe('extended');
  });

  it('detecta mão fechada (todos dobrados)', () => {
    const hand = buildHand(
      wrist,
      foldedFingerJoints(lm(0.53, 0.58), SEG),
      foldedFingerJoints(lm(0.45, 0.60), SEG),
      foldedFingerJoints(lm(0.50, 0.60), SEG),
      foldedFingerJoints(lm(0.55, 0.60), SEG),
      foldedFingerJoints(lm(0.60, 0.60), SEG),
    );

    const states = getFingerStates(hand);

    // Com 60° no PIP, todos os 4 dedos ficam 'folded' (< 70°)
    expect(states.index).toBe('folded');
    expect(states.middle).toBe('folded');
    expect(states.ring).toBe('folded');
    expect(states.pinky).toBe('folded');
  });

  it('detecta apenas indicador estendido (letra D)', () => {
    const hand = buildHand(
      wrist,
      foldedFingerJoints(lm(0.53, 0.58), SEG),   // thumb folded
      extendedFingerJoints(lm(0.45, 0.60), SEG),  // index extended
      foldedFingerJoints(lm(0.50, 0.60), SEG),    // middle folded
      foldedFingerJoints(lm(0.55, 0.60), SEG),    // ring folded
      foldedFingerJoints(lm(0.60, 0.60), SEG),    // pinky folded
    );

    const states = getFingerStates(hand);

    expect(states.index).toBe('extended');
    expect(states.middle).toBe('folded');
    expect(states.ring).toBe('folded');
    expect(states.pinky).toBe('folded');
  });

  it('detecta dedos curvados (todos)', () => {
    const hand = buildHand(
      wrist,
      curledFingerJoints(lm(0.53, 0.58), SEG),
      curledFingerJoints(lm(0.45, 0.60), SEG),
      curledFingerJoints(lm(0.50, 0.60), SEG),
      curledFingerJoints(lm(0.55, 0.60), SEG),
      curledFingerJoints(lm(0.60, 0.60), SEG),
    );

    const states = getFingerStates(hand);

    // Com 135° no PIP, os 4 dedos ficam 'curled' (entre 70° e 160°)
    expect(states.index).toBe('curled');
    expect(states.middle).toBe('curled');
    expect(states.ring).toBe('curled');
    expect(states.pinky).toBe('curled');
  });
});

describe('distance3D', () => {
  it('calcula distância entre dois pontos', () => {
    const a = lm(0, 0, 0);
    const b = lm(3, 4, 0);

    expect(distance3D(a, b)).toBe(5); // triângulo 3-4-5
  });

  it('retorna 0 para pontos idênticos', () => {
    const a = lm(0.5, 0.5, 0.5);

    expect(distance3D(a, a)).toBe(0);
  });

  it('calcula distância com eixo Z', () => {
    const a = lm(0, 0, 0);
    const b = lm(1, 2, 2);

    // sqrt(1 + 4 + 4) = sqrt(9) = 3
    expect(distance3D(a, b)).toBe(3);
  });
});

describe('isThumbTouching', () => {
  it('detecta polegar próximo ao indicador', () => {
    const hand = buildHand(
      wrist,
      [lm(0.5, 0.62), lm(0.5, 0.66), lm(0.5, 0.70), lm(0.50, 0.74)], // thumb tip close to index tip
      extendedFingerJoints(lm(0.50, 0.60), 0.05), // index tip very close to thumb tip
      extendedFingerJoints(lm(0.52, 0.60), SEG),
      extendedFingerJoints(lm(0.55, 0.60), SEG),
      extendedFingerJoints(lm(0.60, 0.60), SEG),
    );

    expect(isThumbTouching(hand, 8, 0.1)).toBe(true);
  });

  it('detecta polegar longe do indicador', () => {
    const hand = buildHand(
      wrist,
      extendedFingerJoints(lm(0.53, 0.58), SEG),
      extendedFingerJoints(lm(0.40, 0.60), SEG), // index far from thumb
      extendedFingerJoints(lm(0.50, 0.60), SEG),
      extendedFingerJoints(lm(0.55, 0.60), SEG),
      extendedFingerJoints(lm(0.60, 0.60), SEG),
    );

    expect(isThumbTouching(hand, 8, 0.05)).toBe(false);
  });
});
