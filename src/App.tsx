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
        <svg
          className="w-[clamp(180px,32vw,280px)] h-auto"
          viewBox="0 0 720 180"
        >
          <path
            fill="#fff"
            d="m46.5 106.9q0-11.4 5.1-19.7 5.2-8.3 13.5-12.7 8.3-4.6 18.1-4.6 8.2 0 14.5 2.2 6.4 2.1 11.4 5.7 5.3 3.5 9 7.8v-26.3q-7-5.5-15.3-8.6-8.2-3.1-20.7-3.1-13.1 0-24.3 4.2-11.1 4.3-19.4 12.3-8.2 8-12.7 18.9-4.4 10.7-4.4 23.9 0 13.2 4.4 24.2 4.5 10.7 12.7 18.7 8.3 8 19.4 12.2 11.2 4.3 24.3 4.3 12.5 0 20.7-3.1 8.3-3.1 15.3-8.7v-26.2q-3.7 4.2-9 7.8-5 3.6-11.4 5.7-6.3 2.1-14.5 2.1-9.8 0-18.1-4.4-8.3-4.5-13.5-12.8-5.1-8.5-5.1-19.8zm91.8-46.9q0 5 3.8 8.5 3.7 3.4 8.9 3.4 5.3 0 8.8-3.4 3.8-3.5 3.8-8.5 0-5.2-3.8-8.5-3.5-3.4-8.8-3.4-5.2 0-8.9 3.4-3.8 3.3-3.8 8.5zm22.8 29h-20.5v75h20.5zm70.8 29.3v45.7h21.8v-47.9q0-13.6-6.5-21.1-6.5-7.6-19.9-7.6-8 0-13.7 3.4-5.5 3.3-8.9 9.6v-11.4h-21.2v75h21.2v-45.7q0-4.7 1.8-8.1 1.8-3.4 5.2-5.2 3.4-2 7.8-2 6.5 0 9.5 3.9 2.9 3.9 2.9 11.4zm78.1 47.3q13.5 0 23.1-5.2 9.8-5.4 15.7-16l-18.4-5.7q-3.3 5.4-8.3 8.2-4.9 2.6-12 2.6-6.1 0-10.5-2.8-4.4-2.8-6.7-8-2.2-5.2-2.2-12.7 0.2-7.8 2.3-13 2.3-5.4 6.4-8 4.2-2.8 10.4-2.8 5.1 0 8.8 2.3 3.8 2.3 5.7 6.2 2.2 3.9 2.2 9.4 0 1.2-0.7 3-0.5 1.6-1.1 2.6l5.7-7.5h-48.8v13h67.2q0.1-1 0.1-2.6 0.2-1.6 0.2-3.1 0-12-4.6-20.5-4.5-8.7-13.3-13.1-8.7-4.5-21.1-4.5-12.3 0-21.5 4.9-9.1 4.7-14.2 13.5-4.8 8.6-4.8 20.7 0 11.9 4.8 20.7 5.1 8.6 14.2 13.5 9.2 4.9 21.4 4.9zm76.3-128.8h-21.2v127.2h21.2zm35.8 103.8q0-3.2 1.5-5.3 1.5-2.3 4.6-3.5 3.1-1.3 8-1.3 6 0 11.4 1.7 5.5 1.6 9.9 4.9v-9.8q-1.6-2-5.4-4.1-3.7-2.1-9.2-3.6-5.4-1.5-12.6-1.5-14 0-21.7 6.4-7.6 6.4-7.6 17.3 0 7.6 3.5 13 3.8 5.2 9.8 8 6.1 2.8 13.1 2.8 6.8 0 13-2.5 6.4-2.4 10.3-7.3 4.1-4.9 4.1-12.1l-2.7-9.7q0 5.3-2.4 9.2-2.4 3.8-6.4 5.9-3.9 2-8.8 2-3.4 0-6.3-1.2-2.8-1.3-4.4-3.6-1.7-2.4-1.7-5.7zm-15.9-44.8l7.8 14.4q1.6-1.2 5.1-2.8 3.4-1.6 8.1-2.8 4.7-1.1 9.9-1.1 3.5 0 6.2 0.6 2.8 0.7 4.8 2.1 2.1 1.5 3.1 3.8 0.9 2.1 0.9 5.2v48.8h20.4v-53.2q0-7.7-4.2-12.9-4.3-5.4-11.8-8.1-7.5-2.8-17.1-2.8-10.4 0-18.9 2.9-8.5 2.8-14.3 5.9zm106.6 68.2v-75h-20.7v75zm22-53l9.6-18q-2.3-2.9-6-4.4-3.6-1.4-7.7-1.4-5.8 0-11.4 4.2-5.5 4.1-9 11.1-3.4 6.8-3.4 15.8l5.9 5.9q0-5.4 1.3-9.2 1.5-3.9 4.2-6 2.8-2.1 6.7-2.1 3.3 0 5.4 1.1 2.3 1 4.4 3zm6.5-61.2v21.1h30.7v93.1h23.3v-93.1h30.8v-21.1zm179.3 0l-30.8 74.4-31-74.4h-26.9l57.9 120.8 57.9-120.8z"
          />
        </svg>
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
