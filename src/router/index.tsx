import { createHashRouter, createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { BootScreen } from '@/pages/BootScreen';
import { AuthScreen } from '@/pages/AuthScreen';
import { ProfileSelectScreen } from '@/pages/ProfileSelectScreen';
import { HomeScreen } from '@/pages/HomeScreen';
import { SearchScreen } from '@/pages/SearchScreen';
import { ContentDetailScreen } from '@/pages/ContentDetailScreen';
import { WatchScreen } from '@/pages/WatchScreen';
import { IS_DEV } from "@/stores/configStore";

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
          },
          {
            path: '/search',
            element: <SearchScreen />,
          },
          {
            path: '/content/:contentId',
            element: <ContentDetailScreen />,
          },
        ],
      },
      {
        path: '/watch/:contentId',
        element: <WatchScreen />,
      },
      {
        path: '/watch/:contentId/:episodeId',
        element: <WatchScreen />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
