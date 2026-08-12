import { useEffect, useState } from 'react';
import { RouterProvider, createHashRouter, createBrowserRouter, Navigate } from 'react-router-dom';
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { useSiteSettingsStore } from '@/stores/siteSettingsStore';
import { TVToast } from '@/components/ui/TVToast';
import { useToastStore } from '@/stores/toastStore';
import { checkCompat } from '@/services/compat';
import { IncompatibleBrowserScreen } from '@/components/ui/IncompatibleBrowserScreen';
import { useNativeBridgeSync } from '@/hooks/useNativeBridgeSync';
import { checkGeoBlock } from '@/services/geoblocking';
import { GeoBlockedLayout } from '@/components/layout/GeoBlockedLayout';
import { LiveTVScreen } from '@/pages/LiveTVScreen';
import { OverlayPanelHost } from '@/components/overlay/OverlayPanelHost';
import { IS_DEV } from '@/stores/configStore';
import { CinelarLogo } from "./components/ui/CinelarLogo";

// Initialize stores immediately at module load time
useAuthStore.getState().initialize();
useConfigStore.getState().loadConfig();

const compatResult = checkCompat();

const createRouterFunction = IS_DEV ? createBrowserRouter : createHashRouter;

const geoBlockedRouter = createRouterFunction([
  {
    element: <GeoBlockedLayout />,
    children: [
      {
        path: '/live',
        element: <LiveTVScreen />,
      },
      {
        path: '*',
        element: <Navigate to="/live" replace />,
      },
    ],
  },
]);

let betaToastShown = false;

export default function App() {
  const isReady = useAuthStore((s) => s.isReady);
  const configLoaded = useConfigStore((s) => s.isLoaded);
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [geoCheckDone, setGeoCheckDone] = useState(false);
  useNativeBridgeSync();

  useEffect(() => {
    if (!configLoaded) return;
    let mounted = true;
    (async () => {
      try {
        const geo = await checkGeoBlock();
        if (mounted) setGeoBlocked(geo.blocked);
      } catch (err) {
        console.warn('checkGeoBlock failed', err);
      } finally {
        if (mounted) setGeoCheckDone(true);
      }
    })();
    return () => { mounted = false; };
  }, [configLoaded]);

  // Load site settings once config is ready (non-blocking, non-critical)
  useEffect(() => {
    if (!configLoaded) return;
    useSiteSettingsStore.getState().loadSettings();
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
    return (
      <>
        <RouterProvider router={geoBlockedRouter} />
        <OverlayPanelHost />
        <TVToast />
      </>
    );
  }


  if (!isReady || !geoCheckDone) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg">
        <CinelarLogo
          className="w-[clamp(180px,32vw,280px)] h-auto"
        />

      </div>
    );
  }



  return (
    <>
      <RouterProvider router={router} />
      <OverlayPanelHost />
      <TVToast />
    </>
  );
}
