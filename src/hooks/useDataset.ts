import { useCallback, useEffect, useRef, useState } from 'react';

import type { DatasetStats } from '@/types/dataset';
import type { HandTrackingResult, HandLandmarks } from '@/types/hand';
import {
  flattenLandmarks,
  isValidForCollection,
  computeMedianLandmarks,
  saveSample,
  getDatasetStats,
  clearDataset as clearDB,
  exportDataset as exportDB,
} from '@/modules/training/dataCollector';

/** Número de frames a coletar por amostra. */
const FRAMES_PER_SAMPLE = 15;

/** Preferência de mão para coleta. */
export type HandPreference = 'right' | 'left';

/** Encontra os landmarks da mão especificada no resultado do rastreador. */
function getHandByPreference(
  result: HandTrackingResult,
  preference: HandPreference,
): HandLandmarks | null {
  for (let i = 0; i < result.handedness.length; i++) {
    const side = result.handedness[i].toLowerCase();
    if (side === preference) {
      return result.landmarks[i] ?? null;
    }
  }
  return null;
}

interface UseDatasetReturn {
  stats: DatasetStats[];
  isCollecting: boolean;
  frameProgress: number;
  collectingLabel: string | null;
  startCollecting: (label: string, hand: HandPreference) => void;
  cancelCollecting: () => void;
  refreshStats: () => void;
  clearData: () => void;
  exportData: () => void;
}

/**
 * Hook para coleta de dados de treinamento.
 * Acumula FRAMES_PER_SAMPLE frames, calcula a mediana e salva no IndexedDB.
 * Suporta seleção de mão direita ou esquerda via handedness do MediaPipe.
 *
 * @param trackingResult - Resultado do useHandTracking (landmarks em tempo real).
 */
export function useDataset(trackingResult: HandTrackingResult | null): UseDatasetReturn {
  const [stats, setStats] = useState<DatasetStats[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [frameProgress, setFrameProgress] = useState(0);
  const [collectingLabel, setCollectingLabel] = useState<string | null>(null);

  const bufferRef = useRef<number[][]>([]);
  const labelRef = useRef<string>('');
  const handRef = useRef<HandPreference>('right');

  const refreshStats = useCallback(() => {
    void getDatasetStats().then(setStats);
  }, []);

  // Carrega estatísticas ao montar
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // Coleta frames enquanto estiver ativo
  useEffect(() => {
    if (!isCollecting || !trackingResult || trackingResult.landmarks.length === 0) return;

    const hand = getHandByPreference(trackingResult, handRef.current);
    if (!hand || !isValidForCollection(hand)) return;

    const flat = flattenLandmarks(hand);
    bufferRef.current.push(flat);
    setFrameProgress(bufferRef.current.length);

    if (bufferRef.current.length >= FRAMES_PER_SAMPLE) {
      const medianFeatures = computeMedianLandmarks(bufferRef.current);
      void saveSample(medianFeatures, labelRef.current).then(() => {
        console.info('[Dataset] Amostra salva para label:', labelRef.current);
        bufferRef.current = [];
        setIsCollecting(false);
        setCollectingLabel(null);
        setFrameProgress(0);
        refreshStats();
      });
    }
  }, [isCollecting, trackingResult, refreshStats]);

  const startCollecting = useCallback((label: string, hand: HandPreference) => {
    bufferRef.current = [];
    labelRef.current = label;
    handRef.current = hand;
    setFrameProgress(0);
    setIsCollecting(true);
    setCollectingLabel(label);
    console.info('[Dataset] Iniciando coleta para label:', label, 'mão:', hand);
  }, []);

  const cancelCollecting = useCallback(() => {
    bufferRef.current = [];
    setIsCollecting(false);
    setCollectingLabel(null);
    setFrameProgress(0);
    console.info('[Dataset] Coleta cancelada.');
  }, []);

  const clearData = useCallback(() => {
    void clearDB().then(() => {
      console.info('[Dataset] Dataset limpo.');
      refreshStats();
    });
  }, [refreshStats]);

  const exportData = useCallback(() => {
    void exportDB().then((json) => {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dataset-libras-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.info('[Dataset] Dataset exportado.');
    });
  }, []);

  return {
    stats,
    isCollecting,
    frameProgress,
    collectingLabel,
    startCollecting,
    cancelCollecting,
    refreshStats,
    clearData,
    exportData,
  };
}

/** Letras suportadas pelo classificador (estáticas, sem dinâmicas). */
export const COLLECTABLE_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'I', 'L', 'M', 'N',
  'O', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y',
] as const;
