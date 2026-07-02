import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function BootScreen() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedProfile = useAuthStore((s) => s.selectedProfile);
  const isReady = useAuthStore((s) => s.isReady);

  useEffect(() => {
    if (!isReady) return;

    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        navigate('/auth', { replace: true });
      } else if (!selectedProfile) {
        navigate('/select-profile', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [isReady, isAuthenticated, selectedProfile, navigate]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-bg">
      <div className="relative">
        <h1 className="text-5xl font-medium">
          <span className="text-white">CinelarTV</span>
        </h1>
      </div>

    </div>
  );
}
