import { useState, useCallback } from 'react';

import { WebcamView } from '@/components/WebcamView';
import { AlphabetCheatSheet } from '@/components/AlphabetCheatSheet';
import { DataCollectorPanel } from '@/components/DataCollectorPanel';
import { TrainingPanel } from '@/components/TrainingPanel';
import type { HandTrackingResult } from '@/types/hand';

export function App() {
  const [trackingResult, setTrackingResult] = useState<HandTrackingResult | null>(null);

  const handleTrackingUpdate = useCallback((result: HandTrackingResult | null) => {
    setTrackingResult(result);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-header" aria-label="Cabeçalho">
        <h1>Tradutor LIBRAS</h1>
      </header>
      <AlphabetCheatSheet />
      <main className="app-main">
        <WebcamView onTrackingUpdate={handleTrackingUpdate} />
        <DataCollectorPanel
          trackingResult={trackingResult}
          isActive={trackingResult !== null}
          isReady={true}
        />
        <TrainingPanel />
      </main>
    </div>
  );
}
