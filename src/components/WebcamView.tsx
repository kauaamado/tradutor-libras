import { useEffect } from 'react';

import { useWebcam } from '@/hooks/useWebcam';
import { useHandTracking } from '@/hooks/useHandTracking';
import { HandCanvas } from '@/components/HandCanvas';

/**
 * Componente que gerencia a captura de vídeo da webcam + canvas overlay.
 * Inicia a webcam automaticamente ao montar e faz cleanup ao desmontar.
 */
export function WebcamView() {
  const { videoRef, isActive, error, start } = useWebcam();
  const { result, isReady, error: trackingError } = useHandTracking(videoRef, isActive);

  useEffect(() => {
    start();
  }, [start]);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '640px', aspectRatio: '4/3' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)', // espelhar para parecer um espelho
        }}
      />
      <HandCanvas trackingResult={result} videoRef={videoRef} />

      {/* Status */}
      <div style={{ position: 'absolute', top: 8, left: 8, color: '#fff', fontSize: '0.85rem' }}>
        {!isActive && !error && <p>Iniciando webcam...</p>}
        {error && <p style={{ color: '#d32f2f' }}>Erro: {error}</p>}
        {isActive && !isReady && !trackingError && <p>Carregando MediaPipe...</p>}
        {trackingError && <p style={{ color: '#d32f2f' }}>Erro MediaPipe: {trackingError}</p>}
        {isActive && isReady && result && <p>Mãos detectadas: {result.landmarks.length}</p>}
        {isActive && isReady && !result && <p>Nenhuma mão detectada</p>}
      </div>
    </div>
  );
}
