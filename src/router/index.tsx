import { Suspense, lazy } from 'react';
import { createHashRouter, createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { BootScreen } from '@/pages/BootScreen';
import { AuthScreen } from '@/pages/AuthScreen';
import { ProfileSelectScreen } from '@/pages/ProfileSelectScreen';
import { HomeScreen } from '@/pages/HomeScreen';
import { SearchScreen } from '@/pages/SearchScreen';
import { LiveTVScreen } from '@/pages/LiveTVScreen';
import { SettingsScreen } from '@/pages/SettingsScreen';
import { ContentDetailScreen } from '@/pages/ContentDetailScreen';
import { BlockedScreen } from '@/pages/BlockedScreen';
import { IS_DEV } from "@/stores/configStore";
import { FallbackScreen } from '@/pages/FallbackScreen';

const WatchScreen = lazy(() =>
  import('@/pages/WatchScreen').then(m => ({ default: m.WatchScreen }))
);

const WatchFallback = (
  <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
    <p className="text-white/40 text-base tracking-wide">Cargando...</p>
  </div>
);

function WatchRoute() {
  return (
    <Suspense fallback={WatchFallback}>
      <WatchScreen />
    </Suspense>
  );
}

const createRouterFunction = IS_DEV ? createBrowserRouter : createHashRouter;

export const router = createRouterFunction([
  {
    path: '/',
    element: <BootScreen />,
  },
  {
    path: '/auth',
    element: <AuthScreen />,
  },
  {
    path: '/blocked',
    element: <BlockedScreen />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/select-profile',
        element: <ProfileSelectScreen />,
      },
      {
        element: <AppShell />,
        children: [
          {
            path: '/home',
            element: <HomeScreen />,
            errorElement: <FallbackScreen />,
          },
          {
            path: '/search',
            element: <SearchScreen />,
          },
          {
            path: '/live',
            element: <LiveTVScreen />,
          },
          {
            path: '/settings',
            element: <SettingsScreen />,
          },
          {
            path: '/content/:contentId',
            element: <ContentDetailScreen />,
          },
        ],
      },
      {
        path: '/watch/:contentId',
        element: <WatchRoute />,
      },
      {
        path: '/watch/:contentId/:episodeId',
        element: <WatchRoute />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
