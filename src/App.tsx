import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { TVToast } from '@/components/ui/TVToast';
import { useToastStore } from '@/stores/toastStore';
import { checkCompat } from '@/services/compat';
import { IncompatibleBrowserScreen } from '@/components/ui/IncompatibleBrowserScreen';
import { useNativeBridgeSync } from '@/hooks/useNativeBridgeSync';
import { checkGeoBlock } from '@/services/geoblocking';
import { BlockedScreen } from '@/pages/BlockedScreen';

// Initialize stores immediately at module load time
useAuthStore.getState().initialize();
useConfigStore.getState().loadConfig();

const compatResult = checkCompat();

let betaToastShown = false;

export default function App() {
  const isReady = useAuthStore((s) => s.isReady);
  const configLoaded = useConfigStore((s) => s.isLoaded);
  const [geoBlocked, setGeoBlocked] = useState(false);
  useNativeBridgeSync();

  useEffect(() => {
    if (!configLoaded) return;
    let mounted = true;
    (async () => {
      try {
        const geo = await checkGeoBlock();
        if (mounted && geo.blocked) setGeoBlocked(true);
      } catch (err) {
        console.warn('checkGeoBlock failed', err);
      }
    })();
    return () => { mounted = false; };
  }, [configLoaded]);

  useEffect(() => {
    if (!isReady || betaToastShown) return;
    betaToastShown = true;
    useToastStore.getState().show('Gracias por probar la beta', 'info', 5000);
  }, [isReady]);

  if (!compatResult.compatible) {
    return <IncompatibleBrowserScreen result={compatResult} />;
  }

  if (geoBlocked) {
    return <BlockedScreen />;
  }

  if (!isReady) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-[clamp(1rem,3vh,1.75rem)] bg-bg">
        {/* Single opacity-only keyframe — no transform, no blur, no layout cost */}
        <style>{`
          @keyframes splashPulse { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
          .splash-dot { animation: splashPulse 1.1s ease-in-out infinite; }
          .splash-dot:nth-child(2) { animation-delay: .15s; }
          .splash-dot:nth-child(3) { animation-delay: .3s; }
        `}</style>

        <h1 className="font-medium tracking-tight text-[clamp(2rem,6vw,3.25rem)] leading-none">
          <span className="text-white">CinelarTV</span>
        </h1>

        <div className="flex items-center gap-[clamp(0.375rem,0.8vw,0.5rem)]" aria-hidden>
          <span className="splash-dot w-[clamp(0.375rem,0.6vw,0.5rem)] h-[clamp(0.375rem,0.6vw,0.5rem)] rounded-full bg-white/60" />
          <span className="splash-dot w-[clamp(0.375rem,0.6vw,0.5rem)] h-[clamp(0.375rem,0.6vw,0.5rem)] rounded-full bg-white/60" />
          <span className="splash-dot w-[clamp(0.375rem,0.6vw,0.5rem)] h-[clamp(0.375rem,0.6vw,0.5rem)] rounded-full bg-white/60" />
        </div>
      </div>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <TVToast />
    </>
  );
}