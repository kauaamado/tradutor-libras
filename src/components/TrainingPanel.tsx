import { useMemo } from 'react';

import { useTraining } from '@/hooks/useTraining';

/** Formata acurácia como percentual. */
function fmtAcc(v: number): string {
  return (v * 100).toFixed(1) + '%';
}

export function TrainingPanel() {
  const {
    modelStatus,
    isTraining,
    progress,
    result,
    modelInfo,
    error,
    train,
    exportModel,
  } = useTraining();

  /** Resumo das classes do modelo (se treinado). */
  const classList = useMemo(
    () => (modelInfo.labels.length > 0 ? modelInfo.labels.join(', ') : '—'),
    [modelInfo.labels],
  );

  return (
    <section className="training-panel" aria-label="Treinamento do modelo de ML">
      <div className="training-header">
        <h2>Treinamento</h2>
        {modelInfo.trained && (
          <span className="training-model-badge">
            Modelo: {classList} ({modelInfo.numClasses} classes)
          </span>
        )}
      </div>

      {/* Status do modelo */}
      <div className="training-status" aria-live="polite">
        {modelStatus === 'none' && <p>Nenhum modelo treinado ainda.</p>}
        {modelStatus === 'trained' && result && (
          <p>
            Modelo treinado — Acurácia teste: <strong>{fmtAcc(result.accuracy)}</strong>
            {' '}(validação: {fmtAcc(result.valAccuracy)}, {result.epochs} épocas)
          </p>
        )}
        {modelStatus === 'error' && (
          <p className="training-error">{error}</p>
        )}
      </div>

      {/* Progresso do treino */}
      {isTraining && progress && (
        <div className="training-progress" aria-live="polite">
          <p>
            Época {progress.epoch} / {progress.totalEpochs}
          </p>
          <progress
            className="training-progress-bar"
            value={progress.epoch}
            max={progress.totalEpochs}
          />
          <div className="training-metrics">
            <span>Treino: loss {progress.loss.toFixed(3)} / acc {fmtAcc(progress.accuracy)}</span>
            <span>Val: loss {progress.valLoss.toFixed(3)} / acc {fmtAcc(progress.valAccuracy)}</span>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="training-actions">
        <button
          type="button"
          className="primary-button"
          onClick={() => { void train(); }}
          disabled={isTraining}
        >
          {isTraining ? 'Treinando...' : 'Treinar Modelo'}
        </button>

        <button
          type="button"
          className="primary-button"
          onClick={() => { void exportModel(); }}
          disabled={modelStatus !== 'trained'}
        >
          Exportar Modelo
        </button>
      </div>
    </section>
  );
}
