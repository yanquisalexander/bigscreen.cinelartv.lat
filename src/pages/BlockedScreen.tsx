import { useRef, useState } from 'react';
import { checkGeoBlock, clearGeoCache, getGeoblockConfig } from '@/services/geoblocking';

export function BlockedScreen() {
    const [loading, setLoading] = useState(false);
    const buttonRef = useRef<HTMLDivElement>(null);

    const cfg = getGeoblockConfig();

    const handleRetry = async (clearCache = false) => {
        setLoading(true);
        try {
            if (clearCache) await clearGeoCache();
            const geo = await checkGeoBlock();
            // Si ya no está bloqueado, recargamos para volver al flujo normal
            if (!geo.blocked) {
                window.location.href = '/';
            }
        } catch (e) {
            console.warn('Geo-check failed', e);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, clearCache: boolean) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRetry(clearCache);
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
            <div style={{ fontSize: '64px', marginBottom: '32px' }}>&#128205;</div>
            <h1
                style={{
                    fontSize: '36px',
                    fontWeight: 'bold',
                    margin: '0 0 24px 0',
                }}
            >
                Contenido no disponible
            </h1>
            <p
                style={{
                    fontSize: '20px',
                    lineHeight: '1.6',
                    color: '#cccccc',
                    maxWidth: '600px',
                    margin: '0 0 48px 0',
                }}
            >
                {cfg.message || 'Esta aplicación no está disponible en tu ubicación actual.'}
            </p>
            <div
                ref={buttonRef}
                tabIndex={0}
                role="button"
                aria-label="Reintentar"
                onClick={() => handleRetry(false)}
                onKeyDown={(e) => handleKeyDown(e, false)}
                style={{
                    padding: '16px 48px',
                    fontSize: '22px',
                    fontWeight: 'bold',
                    color: '#000000',
                    backgroundColor: '#ffffff',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    outline: 'none',
                    border: '3px solid transparent',
                    marginBottom: '16px',
                    opacity: loading ? 0.5 : 1,
                }}
                onFocus={(e) => {
                    (e.target as HTMLElement).style.borderColor = '#ffffff';
                    (e.target as HTMLElement).style.boxShadow = '0 0 0 4px rgba(255,255,255,0.3)';
                }}
                onBlur={(e) => {
                    (e.target as HTMLElement).style.borderColor = 'transparent';
                    (e.target as HTMLElement).style.boxShadow = 'none';
                }}
            >
                {loading ? 'Comprobando…' : 'Reintentar'}
            </div>
            <div
                tabIndex={0}
                role="button"
                aria-label="Borrar caché y reintentar"
                onClick={() => handleRetry(true)}
                onKeyDown={(e) => handleKeyDown(e, true)}
                style={{
                    fontSize: '18px',
                    color: '#4da3ff',
                    cursor: 'pointer',
                    outline: 'none',
                    opacity: loading ? 0.5 : 1,
                }}
            >
                Borrar caché y reintentar
            </div>
        </div>
    );
}
