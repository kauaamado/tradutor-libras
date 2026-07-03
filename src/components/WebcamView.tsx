import { useEffect, useState } from 'react';

import { useWebcam } from '@/hooks/useWebcam';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useClassifier } from '@/hooks/useClassifier';
import { useTranslator } from '@/hooks/useTranslator';
import { HandCanvas } from '@/components/HandCanvas';
import { ConsentDialog } from '@/components/ConsentDialog';
import type { HandTrackingResult } from '@/types/hand';

const LLM_CONSENT_KEY = 'tradutor-libras-llm-consent';

interface WebcamViewProps {
  onTrackingUpdate?: (result: HandTrackingResult | null) => void;
}

/**
 * Componente que gerencia a captura de vídeo da webcam + canvas overlay.
 * Mantém seus próprios hooks (useWebcam, useHandTracking, useClassifier,
 * useTranslator).
 */
export function WebcamView({ onTrackingUpdate }: WebcamViewProps) {
  const { videoRef, isActive, isStarting, error, start, stop } = useWebcam();
  const { result, isReady, error: trackingError } = useHandTracking(
    videoRef,
    isActive,
  );
  const { confirmed, current, mode, wordQueue, clearQueue } =
    useClassifier(result);
  const {
    status: tlStatus,
    frase,
    downloadProgress,
    error: tlError,
    webgpuAvailable,
    translate,
    translateSimple,
    clear: clearFrase,
  } = useTranslator();

  // Consentimento para download do modelo LLM
  const [consentGiven, setConsentGiven] = useState(() => {
    return localStorage.getItem(LLM_CONSENT_KEY) === 'true';
  });
  const [showConsent, setShowConsent] = useState(false);

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

  const handleClear = () => {
    clearQueue();
    clearFrase();
  };

  /** Botão Traduzir — verifica consentimento antes de baixar o LLM. */
  const handleTranslateClick = () => {
    if (wordQueue.length === 0) return;

    // Sem WebGPU → fallback direto, sem diálogo
    if (!webgpuAvailable) {
      void translate(wordQueue);
      return;
    }

    // WebGPU disponível mas sem consentimento → mostrar diálogo
    if (!consentGiven) {
      setShowConsent(true);
      return;
    }

    // Consentimento dado → prosseguir com LLM
    void translate(wordQueue);
  };

  /** Usuário aceitou baixar o modelo LLM. */
  const handleConsentAccept = () => {
    localStorage.setItem(LLM_CONSENT_KEY, 'true');
    setConsentGiven(true);
    setShowConsent(false);
    void translate(wordQueue);
  };

  /** Usuário prefere tradução simples sem IA. */
  const handleConsentFallback = () => {
    localStorage.setItem(LLM_CONSENT_KEY, 'true');
    setConsentGiven(true);
    setShowConsent(false);
    translateSimple(wordQueue);
  };

  /** Usuário fechou o diálogo sem decidir — não salva consentimento. */
  const handleConsentClose = () => {
    setShowConsent(false);
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
              {!webgpuAvailable && (
                <span className="status-webgpu-off">
                  {' · '}Sem WebGPU (frase heurística)
                </span>
              )}
            </p>
          )}
          {isActive && isReady && !result && <p>Nenhuma mão detectada</p>}
        </div>
      </div>

      <div className="phrase-display" aria-live="polite">
        {tlStatus === 'loading' && (
          <p className="phrase-loading">
            Baixando modelo... {downloadProgress}%
          </p>
        )}
        {tlStatus === 'translating' && (
          <p className="phrase-loading">Gerando frase...</p>
        )}
        {frase && (
          <p className="phrase-result">
            Frase: <strong>{frase}</strong>
          </p>
        )}
        {!frase && tlStatus !== 'loading' && tlStatus !== 'translating' && (
          <p>
            Frase:{' '}
            {wordQueue.length > 0
              ? wordQueue.join(' ')
              : 'aguardando sinais'}
          </p>
        )}
        {tlError && !frase && (
          <p className="status-error">{tlError}</p>
        )}
        {tlStatus === 'fallback' && (
          <p className="phrase-fallback">(frase gerada sem IA — WebGPU indisponível)</p>
        )}
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
          onClick={handleTranslateClick}
          disabled={
            wordQueue.length === 0 ||
            tlStatus === 'loading' ||
            tlStatus === 'translating'
          }
        >
          {tlStatus === 'loading'
            ? `Baixando... ${downloadProgress}%`
            : tlStatus === 'translating'
              ? 'Traduzindo...'
              : 'Traduzir'}
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={handleClear}
          disabled={wordQueue.length === 0 && !frase}
        >
          Limpar
        </button>
      </div>

      <ConsentDialog
        open={showConsent}
        onAccept={handleConsentAccept}
        onFallback={handleConsentFallback}
        onClose={handleConsentClose}
      />
    </section>
  );
}
