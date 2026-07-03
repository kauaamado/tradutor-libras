import { useWebcam } from '@/hooks/useWebcam';
import { useHandTracking } from '@/hooks/useHandTracking';
import { useClassifier } from '@/hooks/useClassifier';
import { WebcamView } from '@/components/WebcamView';
import { AlphabetCheatSheet } from '@/components/AlphabetCheatSheet';
import { DataCollectorPanel } from '@/components/DataCollectorPanel';

export function App() {
  const { videoRef, isActive, isStarting, error, start, stop } = useWebcam();
  const { result, isReady, error: trackingError } = useHandTracking(videoRef, isActive);
  const { confirmed, current } = useClassifier(result);

  const handleCameraToggle = () => {
    if (isActive || isStarting) {
      stop();
      return;
    }
    void start();
  };

  return (
    <div className="app-shell">
      <header className="app-header" aria-label="Cabeçalho">
        <h1>Tradutor LIBRAS</h1>
      </header>
      <AlphabetCheatSheet />
      <main className="app-main">
        <WebcamView
          videoRef={videoRef}
          isActive={isActive}
          isStarting={isStarting}
          error={error}
          trackingResult={result}
          isReady={isReady}
          trackingError={trackingError}
          confirmed={confirmed}
          current={current}
          onToggleCamera={handleCameraToggle}
        />
        <DataCollectorPanel trackingResult={result} isActive={isActive} isReady={isReady} />
      </main>
    </div>
  );
}
