import { useEffect, useRef } from 'react';

import { HAND_CONNECTIONS } from '@/modules/capture/handTracker';
import type { HandTrackingResult } from '@/types/hand';

interface HandCanvasProps {
  trackingResult: HandTrackingResult | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/** Cores dos landmarks e conexões (em canvas, formato CSS). */
const COLOR_LANDMARK = '#00ff00';
const COLOR_CONNECTION = '#00cc00';

/**
 * Canvas overlay que desenha landmarks e conexões da mão sobre o vídeo.
 */
export function HandCanvas({ trackingResult, videoRef }: HandCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sincroniza o tamanho do canvas com o vídeo
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const syncSize = () => {
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };

    syncSize();
    video.addEventListener('loadedmetadata', syncSize);
    return () => video.removeEventListener('loadedmetadata', syncSize);
  }, [videoRef]);

  // Desenha landmarks a cada atualização
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!trackingResult || trackingResult.landmarks.length === 0) return;

    for (const hand of trackingResult.landmarks) {
      // Desenha conexões (esqueleto)
      ctx.strokeStyle = COLOR_CONNECTION;
      ctx.lineWidth = 2;
      for (const [start, end] of HAND_CONNECTIONS) {
        const p1 = hand[start];
        const p2 = hand[end];
        if (!p1 || !p2) continue;

        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }

      // Desenha pontos (21 landmarks)
      ctx.fillStyle = COLOR_LANDMARK;
      for (const point of hand) {
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [trackingResult]);

  return (
    <canvas
      ref={canvasRef}
      className="hand-canvas"
    />
  );
}
