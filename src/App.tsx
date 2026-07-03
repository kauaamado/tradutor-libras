import { useState, useCallback } from 'react';

import { WebcamView } from '@/components/WebcamView';
import { AlphabetCheatSheet } from '@/components/AlphabetCheatSheet';
import { DataCollectorPanel } from '@/components/DataCollectorPanel';
import { TrainingPanel } from '@/components/TrainingPanel';
import type { HandTrackingResult } from '@/types/hand';

export function App() {
  const [trackingResult, setTrackingResult] =
    useState<HandTrackingResult | null>(null);
  const [modelVersion, setModelVersion] = useState(0);

  const handleTrackingUpdate = useCallback(
    (result: HandTrackingResult | null) => {
      setTrackingResult(result);
    },
    [],
  );

  /** Chamado pelo TrainingPanel após treino bem‑sucedido.
   *  Incrementa modelVersion para forçar recarga do modelo no useClassifier. */
  const handleModelTrained = useCallback(() => {
    setModelVersion((v) => v + 1);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header" aria-label="Cabeçalho">
        <h1>Tradutor LIBRAS</h1>
      </header>
      <AlphabetCheatSheet />
      <main className="app-main">
        <WebcamView
          onTrackingUpdate={handleTrackingUpdate}
          modelVersion={modelVersion}
        />
        <DataCollectorPanel
          trackingResult={trackingResult}
          isActive={trackingResult !== null}
          isReady={true}
        />
        <TrainingPanel onModelTrained={handleModelTrained} />
      </main>
    </div>
  );
}
