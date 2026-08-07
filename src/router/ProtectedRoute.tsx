import { useEffect, useRef } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { getCurrentSession } from '@/features/auth/session';
import { useNavigate } from 'react-router-dom';

const GUEST_ALLOWED_PATHS = ['/home', '/search', '/live'];
const GUEST_BLOCKED_PREFIXES = ['/watch', '/select-profile'];

function isGuestAllowed(pathname: string): boolean {
  if (GUEST_ALLOWED_PATHS.includes(pathname)) return true;
  // Permitimos ver el detalle del contenido (overview) pero no reproducirlo (watch)
  if (pathname.startsWith('/content/')) return true;
  return !GUEST_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));
}

function SyncSession({ token }: { token: string }) {
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    getCurrentSession(token)
      .then((session) => {
        setSession(session);
      })
      .catch(() => {
        logout();
        navigate('/auth', { replace: true });
      });
  }, [token, setSession, logout, navigate]);

  return null;
}

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const selectedProfile = useAuthStore((s) => s.selectedProfile);
  const isReady = useAuthStore((s) => s.isReady);
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const location = useLocation();

  if (!isReady) return null;

  // Guest mode
  if (isGuest) {
    if (!isGuestAllowed(location.pathname)) {
      return <Navigate to="/auth" replace />;
    }
    return <Outlet />;
  }

  // Authenticated mode
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  const onProfileSelect = location.pathname === '/select-profile';

  if (!selectedProfile && !onProfileSelect) {
    return <Navigate to="/select-profile" replace />;
  }

  return (
    <>
      {token && <SyncSession token={token} />}
      <Outlet />
    </>
  );
}
