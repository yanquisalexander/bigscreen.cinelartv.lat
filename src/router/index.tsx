import { createHashRouter, createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { BootScreen } from '@/pages/BootScreen';
import { AuthScreen } from '@/pages/AuthScreen';
import { ProfileSelectScreen } from '@/pages/ProfileSelectScreen';
import { HomeScreen } from '@/pages/HomeScreen';
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
    path: '/select-profile',
    element: (
      <ProtectedRoute>
        <ProfileSelectScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '/home',
    element: (
      <ProtectedRoute>
        <HomeScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '/content/:contentId',
    element: (
      <ProtectedRoute>
        <ContentDetailScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '/watch/:contentId',
    element: (
      <ProtectedRoute>
        <WatchScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '/watch/:contentId/:episodeId',
    element: (
      <ProtectedRoute>
        <WatchScreen />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
