
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { CinelarLogo } from '@/components/ui/CinelarLogo';

const MIN_BOOT_DURATION = 700;

export function BootScreen() {
  const navigate = useNavigate();
  const bootStartedAt = useRef(performance.now());

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const selectedProfile = useAuthStore((s) => s.selectedProfile);
  const isReady = useAuthStore((s) => s.isReady);

  useEffect(() => {
    if (!isReady) return;

    const elapsed = performance.now() - bootStartedAt.current;
    const remaining = Math.max(0, MIN_BOOT_DURATION - elapsed);

    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        useAuthStore.getState().enterGuestMode();
        navigate('/home', { replace: true });
      } else if (!selectedProfile) {
        navigate('/select-profile', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }, remaining);

    return () => clearTimeout(timer);
  }, [isReady, isAuthenticated, selectedProfile, navigate]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-bg">
      {/* Logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <CinelarLogo
          className="
            w-[clamp(180px,32vw,280px)]
            h-auto
            text-white
          "
        />
      </div>

      {/* Loading indicator */}
      <div
        className="
          animate-fade-in
          absolute
          bottom-[clamp(32px,6vh,72px)]
          left-0
          w-full
          flex
          justify-center
        "
      >
        <div
          className="
            w-[clamp(28px,3vw,48px)]
            aspect-square
            rounded-full
            border-[clamp(3px,0.35vw,5px)]
            border-white/20
            border-t-white
            animate-spin
          "
        />
      </div>
    </div>
  );
}

