import { useState } from 'react';

import { COLLECTABLE_LETTERS, useDataset } from '@/hooks/useDataset';
import type { HandTrackingResult } from '@/types/hand';

interface DataCollectorPanelProps {
  trackingResult: HandTrackingResult | null;
  isActive: boolean;
  isReady: boolean;
}

export function DataCollectorPanel({ trackingResult, isActive, isReady }: DataCollectorPanelProps) {
  const [selectedLabel, setSelectedLabel] = useState<string>(COLLECTABLE_LETTERS[0]);

  const {
    stats,
    isCollecting,
    frameProgress,
    collectingLabel,
    startCollecting,
    cancelCollecting,
    clearData,
    exportData,
  } = useDataset(trackingResult);

  const canCollect = !isCollecting && trackingResult !== null && trackingResult.landmarks.length > 0;
  const totalSamples = stats.reduce((sum, s) => sum + s.count, 0);

  const handleCollect = () => {
    startCollecting(selectedLabel);
  };

  return (
    <section className="collector-panel" aria-label="Coleta de dados para treinamento">
      <div className="collector-header">
        <h2>Coleta de Dados</h2>
        <span className="collector-total">{totalSamples} amostras</span>
      </div>

      {isCollecting ? (
        <div className="collector-recording" aria-live="polite">
          <p>
            Gravando <strong>{collectingLabel}</strong> — frame {frameProgress}/15
          </p>
          <progress className="collector-progress" value={frameProgress} max={15} />
          <button type="button" className="primary-button collector-cancel" onClick={cancelCollecting}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="collector-controls">
          <label className="collector-label">
            Letra:
            <select
              className="collector-select"
              value={selectedLabel}
              onChange={(e) => setSelectedLabel(e.target.value)}
            >
              {COLLECTABLE_LETTERS.map((letter) => (
                <option key={letter} value={letter}>
                  {letter} ({stats.find((s) => s.label === letter)?.count ?? 0})
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="primary-button"
            onClick={handleCollect}
            disabled={!canCollect}
          >
            Gravar {selectedLabel}
          </button>
        </div>
      )}

      {totalSamples > 0 && (
        <div className="collector-actions">
          <button type="button" className="primary-button" onClick={exportData}>
            Exportar JSON
          </button>
          <button type="button" className="primary-button collector-danger" onClick={clearData}>
            Limpar dados
          </button>
        </div>
      )}

      {stats.length > 0 && (
        <div className="collector-stats" aria-label="Estatísticas de coleta">
          {stats
            .filter((s) => s.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((s) => (
              <span key={s.label} className="collector-stat-item">
                {s.label}: {s.count}
                {s.label === selectedLabel ? ' ←' : ''}
              </span>
            ))}
        </div>
      )}

      {!isActive && (
        <p className="collector-hint">Ligue a câmera no botão acima para começar a coletar.</p>
      )}
      {isActive && !isReady && (
        <p className="collector-hint">Carregando modelo de rastreamento...</p>
      )}
      {isActive && isReady && trackingResult && trackingResult.landmarks.length === 0 && (
        <p className="collector-hint">Posicione a mão na frente da câmera.</p>
      )}
      {isActive && isReady && trackingResult && trackingResult.landmarks.length > 0 && !isCollecting && (
        <p className="collector-hint" style={{ color: '#00cc00' }}>Mão detectada. Clique em Gravar.</p>
      )}
    </section>
  );
}
