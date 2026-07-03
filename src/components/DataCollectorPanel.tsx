import { useState } from 'react';

import { COLLECTABLE_LETTERS, useDataset } from '@/hooks/useDataset';
import type { HandPreference } from '@/hooks/useDataset';
import type { HandTrackingResult } from '@/types/hand';

interface DataCollectorPanelProps {
  trackingResult: HandTrackingResult | null;
  isActive: boolean;
  isReady: boolean;
}

/** Descrição amigável para cada preferência de mão. */
const HAND_OPTIONS: { value: HandPreference; label: string }[] = [
  { value: 'right', label: 'Direita' },
  { value: 'left', label: 'Esquerda' },
];

export function DataCollectorPanel({ trackingResult, isActive, isReady }: DataCollectorPanelProps) {
  const [selectedLabel, setSelectedLabel] = useState<string>(COLLECTABLE_LETTERS[0]);
  const [selectedHand, setSelectedHand] = useState<HandPreference>('right');

  const {
    stats,
    isCollecting,
    frameProgress,
    collectingLabel,
    startCollecting,
    cancelCollecting,
    clearData,
    exportData,
    refreshStats,
  } = useDataset(trackingResult);

  const canCollect =
    !isCollecting &&
    trackingResult !== null &&
    trackingResult.landmarks.length > 0;

  const totalSamples = stats.reduce((sum, s) => sum + s.count, 0);

  const handleCollect = () => {
    const prefix = selectedHand === 'right' ? 'D' : 'E';
    startCollecting(`${prefix}_${selectedLabel}`, selectedHand);
  };

  const handleClear = () => {
    if (confirm('Tem certeza que deseja limpar todos os dados coletados? Esta ação não pode ser desfeita.')) {
      clearData();
    }
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
                  {letter} ({stats.filter((s) => s.label.endsWith(`_${letter}`)).reduce((sum, s) => sum + s.count, 0)})
                </option>
              ))}
            </select>
          </label>

          <label className="collector-label">
            Mão:
            <select
              className="collector-select"
              value={selectedHand}
              onChange={(e) => setSelectedHand(e.target.value as HandPreference)}
            >
              {HAND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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
            Gravar {selectedLabel} ({selectedHand === 'right' ? 'Dir.' : 'Esq.'})
          </button>
        </div>
      )}

      <div className="collector-actions">
        <button type="button" className="primary-button" onClick={exportData} disabled={totalSamples === 0}>
          Exportar JSON
        </button>
        <label className="primary-button collector-import-label">
          Importar JSON
          <input
            type="file"
            accept=".json"
            className="collector-import-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const json = JSON.parse(reader.result as string);
                  const entries = json.entries ?? json.samples ?? json;
                  if (!Array.isArray(entries)) throw new Error('Formato inválido');
                  void import('@/modules/training/dataCollector').then(
                    ({ importDataset }) =>
                      importDataset(entries).then(() => {
                        console.info('[DataCollector] Importação concluída:', entries.length, 'entradas.');
                        refreshStats();
                      }),
                  );
                } catch (err) {
                  console.error('[DataCollector] Erro ao importar JSON:', err);
                  alert('Erro ao importar arquivo. Verifique o formato JSON.');
                }
              };
              reader.readAsText(file);
              // Reset input para permitir reimportar o mesmo arquivo
              e.target.value = '';
            }}
          />
        </label>
        <button type="button" className="primary-button collector-danger" onClick={handleClear} disabled={totalSamples === 0}>
          Limpar dados ({totalSamples})
        </button>
      </div>

      {stats.length > 0 && (
        <div className="collector-stats" aria-label="Estatísticas de coleta">
          {stats
            .filter((s) => s.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((s) => (
              <span key={s.label} className="collector-stat-item">
                {s.label}: {s.count}
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
        <p className="collector-hint" style={{ color: '#00cc00' }}>
          {trackingResult.handedness.length > 1
            ? 'Duas mãos detectadas.'
            : `Mão ${trackingResult.handedness[0] === 'Right' ? 'direita' : 'esquerda'} detectada.`}{' '}
          Clique em Gravar.
        </p>
      )}
    </section>
  );
}
