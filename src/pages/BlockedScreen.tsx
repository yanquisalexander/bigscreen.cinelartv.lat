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

            <pre className="bg-zinc-800 !font-mono text-white p-4 mt-8" style={{ maxWidth: '600px', overflowX: 'auto' }}>
                ERR_GEO_BLOCKED
            </pre>
        </div>
    );
}
