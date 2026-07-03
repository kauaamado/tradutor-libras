import { useEffect } from 'react';

import { useWebcam } from '@/hooks/useWebcam';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useClassifier } from '@/hooks/useClassifier';
import { HandCanvas } from '@/components/HandCanvas';
import type { HandTrackingResult } from '@/types/hand';

interface WebcamViewProps {
  onTrackingUpdate?: (result: HandTrackingResult | null) => void;
  /** Versão do modelo — incrementar força recarga (pós‑treino). */
  modelVersion?: number;
}

/**
 * Componente que gerencia a captura de vídeo da webcam + canvas overlay.
 * Mantém seus próprios hooks (useWebcam, useHandTracking, useClassifier).
 */
export function WebcamView({
  onTrackingUpdate,
  modelVersion = 0,
}: WebcamViewProps) {
  const { videoRef, isActive, isStarting, error, start, stop } = useWebcam();
  const { result, isReady, error: trackingError } = useHandTracking(
    videoRef,
    isActive,
  );
  const { confirmed, current, mode, wordQueue, clearQueue } = useClassifier(
    result,
    modelVersion,
  );

  // Notifica o pai sobre mudanças no trackingResult (para DataCollectorPanel).
  useEffect(() => {
    onTrackingUpdate?.(result);
  }, [result, onTrackingUpdate]);

  const handleCameraToggle = () => {
    if (isActive || isStarting) {
      stop();
      return;
    }
    void start();
  };

  return (
    <section className="camera-shell" aria-label="Área de tradução por webcam">
      <div className="camera-frame">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="webcam-video"
        />
        <HandCanvas trackingResult={result} videoRef={videoRef} />

        {!isActive && !isStarting && (
          <div className="camera-placeholder" aria-live="polite">
            <p>Câmera desligada</p>
          </div>
        )}

        {confirmed.label && (
          <div className="detection-badge" aria-live="polite">
            Palavra: {confirmed.label}
          </div>
        )}

        {current.label && current.label !== confirmed.label && (
          <div className="detection-pending" aria-live="polite">
            {current.label}...
          </div>
        )}

        <div className="model-status" aria-live="polite">
          {isStarting && !error && <p>Iniciando webcam...</p>}
          {error && <p className="status-error">Erro: {error}</p>}
          {isActive && !isReady && !trackingError && (
            <p>Carregando MediaPipe...</p>
          )}
          {trackingError && (
            <p className="status-error">Erro MediaPipe: {trackingError}</p>
          )}
          {isActive && isReady && result && (
            <p>
              Mãos: {result.landmarks.length}
              {' · '}
              Modelo:{' '}
              {mode === 'tfjs'
                ? 'TF.js'
                : mode === 'heuristic'
                  ? 'Heurístico'
                  : 'Carregando...'}
            </p>
          )}
          {isActive && isReady && !result && <p>Nenhuma mão detectada</p>}
        </div>
      </div>

      <div className="phrase-display" aria-live="polite">
        <p>
          Frase:{' '}
          {wordQueue.length > 0
            ? wordQueue.join(' ')
            : 'aguardando sinais'}
        </p>
      </div>

      <div
        className="control-bar"
        role="toolbar"
        aria-label="Controles da tradução"
      >
        <button
          className="primary-button"
          type="button"
          onClick={handleCameraToggle}
          disabled={isStarting}
          aria-pressed={isActive}
        >
          {isActive
            ? 'Desligar câmera'
            : isStarting
              ? 'Ligando câmera'
              : 'Ligar câmera'}
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={clearQueue}
          disabled={wordQueue.length === 0}
        >
          Limpar
        </button>
      </div>
    </section>
  );
}
