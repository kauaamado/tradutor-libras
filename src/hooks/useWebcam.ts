import { useCallback, useEffect, useRef, useState } from 'react';

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  streamRef: React.RefObject<MediaStream | null>;
  isActive: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Hook que gerencia o stream da webcam via getUserMedia.
 * Faz cleanup obrigatório ao desmontar (parar tracks + limpar srcObject).
 */
export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      console.info('[Webcam] Stream encerrado.');
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (mountedRef.current) {
      setIsActive(false);
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });

      // Se desmontou durante getUserMedia, libera o stream e sai
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (mountedRef.current) {
        setIsActive(true);
        console.info('[Webcam] Stream iniciado com sucesso.');
      }
    } catch (err) {
      // AbortError é esperado em StrictMode (monta→desmonta→monta em dev)
      const isAbortError =
        err instanceof DOMException && err.name === 'AbortError';

      if (!mountedRef.current || isAbortError) {
        return;
      }

      const message = err instanceof Error ? err.message : 'Erro ao acessar webcam';
      console.error('[Webcam] Erro:', message);
      setError(message);
    }
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  return { videoRef, streamRef, isActive, error, start, stop };
}
