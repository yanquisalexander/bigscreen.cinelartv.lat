import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';

// Initialize stores immediately at module load time
useAuthStore.getState().initialize();
useConfigStore.getState().loadConfig();

export default function App() {
  // Subscribe to auth state to re-render when ready
  const isReady = useAuthStore((s) => s.isReady);

  if (!isReady) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-bg">
        <h1 className="text-5xl font-medium">
          <span className="text-white">CinelarTV</span>
        </h1>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
