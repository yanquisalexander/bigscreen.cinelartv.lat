import type { CompatResult } from '@/services/compat';

interface Props {
  result: CompatResult;
}

export function IncompatibleBrowserScreen({ result }: Props) {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f0f0f',
        color: '#ffffff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        textAlign: 'center',
        padding: '40px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: '64px', marginBottom: '32px' }}>&#9888;</div>
      <h1
        style={{
          fontSize: '36px',
          fontWeight: 'bold',
          margin: '0 0 24px 0',
        }}
      >
        Navegador no compatible
      </h1>
      <p
        style={{
          fontSize: '20px',
          lineHeight: '1.6',
          color: '#cccccc',
          maxWidth: '600px',
          margin: '0 0 32px 0',
        }}
      >
        Tu dispositivo necesita una versión más reciente de Android WebView para
        ejecutar CinelarTV.
      </p>
      <div
        style={{
          fontSize: '18px',
          color: '#999999',
          lineHeight: '1.8',
        }}
      >
        {result.detectedVersion != null && (
          <p style={{ margin: '0' }}>
            Versión detectada: Chrome {result.detectedVersion}
          </p>
        )}
        <p style={{ margin: '0' }}>
          Versión mínima requerida: Chrome {result.minimumVersion}
        </p>
      </div>
      <div
        style={{
          marginTop: '40px',
          fontSize: '18px',
          color: '#999999',
          lineHeight: '1.6',
        }}
      >
        <p style={{ margin: '0' }}>
          Actualiza Android System WebView desde Google Play
        </p>
        <p style={{ margin: '0' }}>e intenta nuevamente.</p>
      </div>
    </div>
  );
}
