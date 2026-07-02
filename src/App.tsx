import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { TVToast } from '@/components/ui/TVToast';
import { useToastStore } from '@/stores/toastStore';
import { checkCompat } from '@/services/compat';
import { IncompatibleBrowserScreen } from '@/components/ui/IncompatibleBrowserScreen';
import { useNativeBridgeSync } from '@/hooks/useNativeBridgeSync';

// Initialize stores immediately at module load time
useAuthStore.getState().initialize();
useConfigStore.getState().loadConfig();

const compatResult = checkCompat();

let betaToastShown = false;

export default function App() {
  const isReady = useAuthStore((s) => s.isReady);
  useNativeBridgeSync();

  useEffect(() => {
    if (!isReady || betaToastShown) return;
    betaToastShown = true;
    useToastStore.getState().show('Gracias por probar la beta', 'info', 5000);
  }, [isReady]);

  if (!compatResult.compatible) {
    return <IncompatibleBrowserScreen result={compatResult} />;
  }

  if (!isReady) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-bg">
        <h1 className="text-5xl font-medium">
          <span className="text-white">CinelarTV</span>
        </h1>
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
