import { useEffect, useRef, useState } from 'react';

import { initHandLandmarker, detectHands, validateLandmarks } from '@/modules/capture/handTracker';
import type { HandTrackingResult } from '@/types/hand';

interface UseHandTrackingReturn {
  result: HandTrackingResult | null;
  isReady: boolean;
  error: string | null;
}

/**
 * Hook que processa frames de vídeo via HandLandmarker em loop (requestAnimationFrame).
 * Retorna os landmarks detectados em tempo real, filtrando mãos com landmarks inválidos.
 *
 * @param videoRef - Referência ao elemento <video> da webcam.
 * @param isActive - Se o stream da webcam está ativo.
 */
export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
): UseHandTrackingReturn {
  const [result, setResult] = useState<HandTrackingResult | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  // Inicializa o HandLandmarker uma vez
  useEffect(() => {
    initHandLandmarker()
      .then(() => setIsReady(true))
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Erro ao carregar HandLandmarker';
        console.error('[HandTracking] Falha na inicialização:', message);
        setError(message);
      });
  }, []);

  // Loop de detecção via requestAnimationFrame
  useEffect(() => {
    if (!isActive || !isReady || !videoRef.current) {
      return;
    }

    const loop = () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        const timestamp = performance.now();
        const detection = detectHands(video, timestamp);

        if (detection) {
          // Filtra mãos cujos landmarks são inválidos (RF-02: validar null antes de processar)
          const validIndices = detection.landmarks
            .map((hand, i) => (validateLandmarks(hand) ? i : -1))
            .filter((i) => i >= 0);

          if (validIndices.length === 0) {
            setResult(null);
          } else {
            setResult({
              landmarks: validIndices.map((i) => detection.landmarks[i]),
              worldLandmarks: validIndices.map(
                (i) => detection.worldLandmarks[i] ?? detection.landmarks[i],
              ),
              handedness: validIndices.map((i) => detection.handedness[i]),
            });
          }
        } else {
          setResult(null);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isActive, isReady, videoRef]);

  return { result, isReady, error };
}
