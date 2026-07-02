import { useRef, useEffect } from 'react';
import type { CompatResult } from '@/services/compat';
import { openUrl, PLAY_STORE_WEBVIEW_URL } from '@/services/NativeBridge';

interface Props {
  result: CompatResult;
}

export function IncompatibleBrowserScreen({ result }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  const handleAction = () => {
    openUrl(PLAY_STORE_WEBVIEW_URL);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAction();
    }
  };

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
        ejecutar CinelarT.
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
        ref={buttonRef}
        tabIndex={0}
        role="button"
        aria-label="Abrir Google Play para actualizar WebView"
        onClick={handleAction}
        onKeyDown={handleKeyDown}
        style={{
          marginTop: '48px',
          padding: '16px 48px',
          fontSize: '22px',
          fontWeight: 'bold',
          color: '#000000',
          backgroundColor: '#ffffff',
          borderRadius: '999px',
          cursor: 'pointer',
          outline: 'none',
          border: '3px solid transparent',
          transition: 'none',
        }}
        onFocus={(e) => {
          (e.target as HTMLElement).style.borderColor = '#ffffff';
          (e.target as HTMLElement).style.boxShadow = '0 0 0 4px rgba(255,255,255,0.3)';
        }}
        onBlur={(e) => {
          (e.target as HTMLElement).style.borderColor = 'transparent';
          (e.target as HTMLElement).style.boxShadow = 'none';
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.backgroundColor = '#e0e0e0';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.backgroundColor = '#ffffff';
        }}
      >
        Actualizar WebView
      </div>
    </div>
  );
}
