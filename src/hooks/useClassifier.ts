import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';

import { classifySign } from '@/modules/inference/signClassifier';
import { classifyWithModel } from '@/modules/inference/tfClassifier';
import { loadModel, loadModelMetadata } from '@/modules/training/modelTrainer';
import type { HandTrackingResult, ClassificationResult } from '@/types/hand';

const DEBOUNCE_FRAMES = 15;
const NULL_RESULT: ClassificationResult = { label: null, confidence: 0 };

export type ClassifierMode = 'loading' | 'tfjs' | 'heuristic';

interface UseClassifierReturn {
  confirmed: ClassificationResult;
  current: ClassificationResult;
  mode: ClassifierMode;
  wordQueue: string[];
  clearQueue: () => void;
}

/**
 * Hook que classifica sinais de LIBRAS a partir dos landmarks em tempo real.
 *
 * Tenta carregar o modelo TF.js do IndexedDB; se disponível, usa-o.
 * Caso contrário, cai de volta para o classificador heurístico.
 *
 * Debounce: uma letra só é confirmada após DEBOUNCE_FRAMES consistentes.
 * Palavras confirmadas são acumuladas em wordQueue (fila para frases).
 */
export function useClassifier(
  trackingResult: HandTrackingResult | null,
  modelVersion = 0,
): UseClassifierReturn {
  // ═══ Estado do modelo TF.js (state, não ref — React 19 proíbe refs no render) ═══
  const [mode, setMode] = useState<ClassifierMode>('loading');
  const [tfModel, setTfModel] = useState<tf.LayersModel | null>(null);
  const [tfLabels, setTfLabels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await tf.ready();
        const model = await loadModel();
        const metadata = loadModelMetadata();

        if (cancelled) { model?.dispose(); return; }

        if (model && metadata.trained && metadata.labels.length >= 2) {
          setTfModel((prev) => { prev?.dispose(); return model; });
          setTfLabels(metadata.labels);
          setMode('tfjs');
          console.info(`[useClassifier] TF.js: ${metadata.labels.length} classes.`);
        } else {
          model?.dispose();
          setMode('heuristic');
          console.info('[useClassifier] Heurístico (sem modelo).');
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[useClassifier] Fallback heurístico:', err);
          setMode('heuristic');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [modelVersion]);

  useEffect(() => () => {
    setTfModel((prev) => { prev?.dispose(); return null; });
  }, []);

  // ═══ Classificação por frame ═══════════════════════════════════════
  const current = useMemo<ClassificationResult>(() => {
    if (!trackingResult || trackingResult.landmarks.length === 0) return NULL_RESULT;
    if (mode === 'tfjs' && tfModel) {
      return classifyWithModel(
        trackingResult.landmarks[0],
        trackingResult.handedness[0] === 'Left',
        tfModel,
        tfLabels,
      );
    }
    return classifySign(trackingResult.landmarks[0]);
  }, [trackingResult, mode, tfModel, tfLabels]);

  // ═══ Debounce (refs: só acessados em useEffect, seguro no React 19) ═══
  const [confirmed, setConfirmed] = useState<ClassificationResult>(NULL_RESULT);
  const lastLabelRef = useRef<string | null>(null);
  const countRef = useRef(0);

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

  // ═══ Fila de palavras ═══════════════════════════════════════════════
  const [wordQueue, setWordQueue] = useState<string[]>([]);
  const lastWordRef = useRef<string | null>(null);

  useEffect(() => {
    if (!confirmed.label || confirmed.label === lastWordRef.current) return;
    lastWordRef.current = confirmed.label;
    setWordQueue((prev) => [...prev, confirmed.label!]);
    console.info(`[useClassifier] Fila +"${confirmed.label}" (${(confirmed.confidence * 100).toFixed(0)}%)`);
  }, [confirmed]);

  const clearQueue = useCallback(() => {
    setWordQueue([]);
    lastWordRef.current = null;
  }, []);

  return { confirmed, current, mode, wordQueue, clearQueue };
}
