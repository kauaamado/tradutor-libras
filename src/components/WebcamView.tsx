import { HandCanvas } from '@/components/HandCanvas';
import type { HandTrackingResult, ClassificationResult } from '@/types/hand';

interface WebcamViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  isStarting: boolean;
  error: string | null;
  trackingResult: HandTrackingResult | null;
  isReady: boolean;
  trackingError: string | null;
  confirmed: ClassificationResult;
  current: ClassificationResult;
  onToggleCamera: () => void;
}

/**
 * Componente que gerencia a exibição do feed da webcam + canvas overlay.
 * Recebe estado e callbacks como props (hooks gerenciados pelo App.tsx).
 */
export function WebcamView({
  videoRef,
  isActive,
  isStarting,
  error,
  trackingResult,
  isReady,
  trackingError,
  confirmed,
  current,
  onToggleCamera,
}: WebcamViewProps) {
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
        <HandCanvas trackingResult={trackingResult} videoRef={videoRef} />

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
          {isActive && !isReady && !trackingError && <p>Carregando MediaPipe...</p>}
          {trackingError && <p className="status-error">Erro MediaPipe: {trackingError}</p>}
          {isActive && isReady && trackingResult && <p>Mãos: {trackingResult.landmarks.length}</p>}
          {isActive && isReady && !trackingResult && <p>Nenhuma mão detectada</p>}
        </div>
      </div>

      <div className="phrase-display" aria-live="polite">
        <p>Frase: aguardando sinais</p>
      </div>

      <div className="control-bar" role="toolbar" aria-label="Controles da tradução">
        <button
          className="primary-button"
          type="button"
          onClick={onToggleCamera}
          disabled={isStarting}
          aria-pressed={isActive}
        >
          {isActive ? 'Desligar câmera' : isStarting ? 'Ligando câmera' : 'Ligar câmera'}
        </button>
      </div>
    </section>
  );
}
