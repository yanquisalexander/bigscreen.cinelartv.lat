import { useNavigate, useLocation } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { deassignProfile } from '@/features/auth/session';
import { classNames } from '@/utils/helpers';
import { LucideLogIn } from "lucide-react";
import { CollectionsEmptyRegular, SearchFilled, SettingsRegular, TvRegular } from "@fluentui/react-icons";
import { memo, useCallback, useEffect, useMemo } from 'react';

const NAV_ITEMS = [
  { key: 'home', label: 'Inicio', icon: CollectionsEmptyRegular, path: '/home' },
  { key: 'search', label: 'Buscar', icon: SearchFilled, path: '/search' },
  { key: 'live', label: 'TV en Vivo', icon: TvRegular, path: '/live' },
];

interface TVSidebarProps {
  onFocusChange?: (focused: boolean) => void;
}

export const TVSidebar = memo(function TVSidebar({ onFocusChange }: TVSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useAuthStore((s) => s.selectedProfile);
  const isGuest = useAuthStore((s) => s.isGuest);
  const exitGuestMode = useAuthStore((s) => s.exitGuestMode);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);

  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: 'sidebar',
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'nav-home',
  });

  useEffect(() => {
    onFocusChange?.(hasFocusedChild);
  }, [hasFocusedChild, onFocusChange]);

  const focusKeyForPath = useCallback((path: string): string => {
    if (path.startsWith('/content/')) return 'content-root';
    if (path.startsWith('/search')) return 'search-root';
    if (path.startsWith('/live')) return 'livetv-root';
    if (path.startsWith('/settings')) return 'settings-root';
    return 'home-root';
  }, []);

  const focusContent = useCallback((direction: string) => {
    if (direction !== 'right') return true;
    setFocus(focusKeyForPath(location.pathname));
    return false;
  }, [focusKeyForPath, location.pathname]);

  const handleLogin = useCallback(() => {
    exitGuestMode();
    navigate('/auth');
  }, [exitGuestMode, navigate]);

  const handleProfile = useCallback(() => {
    const token = useAuthStore.getState().tokens?.accessToken;
    if (token) deassignProfile(token).catch(() => { });
    navigate('/select-profile');
  }, [navigate]);

  const avatarUrl = useMemo(() => {
    if (!profile) return '';
    return profile.avatar_url ?? `${clientEndpoint}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'}.png`;
  }, [profile, clientEndpoint]);

  return (
    <FocusContext.Provider value={focusKey}>
      <aside
        ref={ref as React.RefObject<HTMLElement>}
        style={{ gridArea: 'sidebar' }}
        className={classNames(
          'relative h-full w-full flex flex-col py-6',
          'bg-surface/10',
          hasFocusedChild ? 'px-4' : 'px-2',
        )}
      >
        <div className={classNames('flex items-center mb-12 h-8 px-2', hasFocusedChild ? 'justify-start' : 'justify-center')} />

        <nav className="flex-1 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Focusable
                key={item.key}
                onEnterPress={() => navigate(item.path)}
                onArrowPress={focusContent}
                focusKey={`nav-${item.key}`}
                focusedClassName="bg-white !text-black"
                className={classNames(
                  'flex h-12 items-center gap-4 rounded-xl px-3 text-base font-medium',
                  hasFocusedChild ? 'justify-start' : 'justify-center',
                  isActive ? 'text-white' : 'text-white/70',
                )}
              >
                <item.icon className="text-2xl" />
                {hasFocusedChild && (
                  <span className="truncate whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </Focusable>
            );
          })}
        </nav>

        <Focusable
          onEnterPress={() => navigate('/settings')}
          onArrowPress={focusContent}
          focusKey="nav-settings"
          focusedClassName="bg-white !text-black"
          className={classNames(
            'flex h-12 items-center gap-4 rounded-xl px-3 text-base font-medium mb-1',
            hasFocusedChild ? 'justify-start' : 'justify-center',
            'text-white/70',
          )}
        >
          <SettingsRegular className="text-2xl" />
          {hasFocusedChild && (
            <span className="truncate whitespace-nowrap">
              Ajustes
            </span>
          )}
        </Focusable>

        {isGuest ? (
          <Focusable
            onEnterPress={handleLogin}
            onArrowPress={focusContent}
            focusKey="nav-login"
            focusedClassName="bg-white !text-black"
            className={classNames(
              'flex h-12 items-center gap-4 rounded-xl px-3 text-base font-medium mb-1',
              hasFocusedChild ? 'justify-start' : 'justify-center',
              'text-white/70',
            )}
          >
            <LucideLogIn className="text-2xl" />
            {hasFocusedChild && (
              <span className="truncate whitespace-nowrap">
                Iniciar sesión
              </span>
            )}
          </Focusable>
        ) : profile && (
          <Focusable
            onEnterPress={handleProfile}
            onArrowPress={focusContent}
            focusKey="nav-profile"
            focusedClassName="bg-white !text-black [&_span]:text-black"
            className={classNames(
              'flex h-12 items-center gap-3 rounded-xl px-2',
              hasFocusedChild ? 'justify-start' : 'justify-center',
            )}
          >
            <img
              src={avatarUrl}
              alt={profile.name}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div
              className="w-9 h-9 rounded-full bg-accent items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ display: 'none' }}
            >
              {profile.name.charAt(0).toUpperCase()}
            </div>
            {hasFocusedChild && (
              <span className="truncate whitespace-nowrap text-white">
                {profile.name}
              </span>
            )}
          </Focusable>
        )}
      </aside>
    </FocusContext.Provider>
  );
});
