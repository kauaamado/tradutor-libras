import { WebcamView } from '@/components/WebcamView';

export default function App() {
  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      <header style={{ padding: '1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Tradutor LIBRAS</h1>
      </header>
      <main
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1rem',
        }}
      >
        <WebcamView />
      </main>
    </div>
  );
}
