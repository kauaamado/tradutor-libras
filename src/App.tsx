import { WebcamView } from '@/components/WebcamView';
import { AlphabetCheatSheet } from '@/components/AlphabetCheatSheet';

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header" aria-label="Cabeçalho">
        <h1>Tradutor LIBRAS</h1>
      </header>
      <AlphabetCheatSheet />
      <main className="app-main">
        <WebcamView />
      </main>
    </div>
  );
}
