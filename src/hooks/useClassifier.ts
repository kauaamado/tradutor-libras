import { useEffect, useMemo, useRef, useState } from 'react';

import { classifySign } from '@/modules/inference/signClassifier';
import type { HandTrackingResult, ClassificationResult } from '@/types/hand';

/** Número de frames consecutivos necessários para confirmar uma detecção. */
const DEBOUNCE_FRAMES = 15;

const NULL_RESULT: ClassificationResult = { label: null, confidence: 0 };

interface UseClassifierReturn {
  confirmed: ClassificationResult;
  current: ClassificationResult;
}

/**
 * Hook que classifica sinais de LIBRAS a partir dos landmarks em tempo real.
 * Implementa debounce: uma letra só é confirmada após DEBOUNCE_FRAMES detecções
 * consistentes seguidas.
 *
 * @param trackingResult - Resultado do useHandTracking (landmarks em tempo real).
 */
export function useClassifier(trackingResult: HandTrackingResult | null): UseClassifierReturn {
  // current: classificação instantânea (derivada, sem setState em effect)
  const current = useMemo<ClassificationResult>(() => {
    if (!trackingResult || trackingResult.landmarks.length === 0) {
      return NULL_RESULT;
    }
    return classifySign(trackingResult.landmarks[0]);
  }, [trackingResult]);

  const [confirmed, setConfirmed] = useState<ClassificationResult>(NULL_RESULT);

  const lastLabelRef = useRef<string | null>(null);
  const countRef = useRef(0);

  // Debounce: só confirma após N frames consistentes
  useEffect(() => {
    if (current.label === lastLabelRef.current) {
      countRef.current += 1;
    } else {
      lastLabelRef.current = current.label;
      countRef.current = 1;
    }

    if (countRef.current >= DEBOUNCE_FRAMES) {
      setConfirmed(current);
    }
  }, [current]);

  return { confirmed, current };
}
