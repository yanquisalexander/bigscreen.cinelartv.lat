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

  const collapsed = !hasFocusedChild;

  const itemClasses = (isActive: boolean) => classNames(
    'flex h-10 items-center gap-3 rounded-lg text-sm font-medium',
    collapsed ? 'justify-center px-0' : 'justify-start px-2',
    isActive ? 'text-white' : 'text-white/70',
  );

  const bottomItemClasses = classNames(
    'flex h-10 items-center gap-3 rounded-lg text-sm font-medium mb-1',
    collapsed ? 'justify-center px-0' : 'justify-start px-2',
    'text-white/70',
  );

  const labelStyle = (show: boolean): React.CSSProperties => ({
    display: show ? 'block' : 'none',
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <aside
        ref={ref as React.RefObject<HTMLElement>}
        style={{ gridArea: 'sidebar' }}
        className={classNames(
          'relative h-full w-full flex flex-col py-4 bg-surface/10',
          collapsed ? 'px-0' : 'px-2',
        )}
      >
        <nav className="flex-1 flex flex-col gap-1 justify-center">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Focusable
                key={item.key}
                onEnterPress={() => navigate(item.path)}
                onArrowPress={focusContent}
                focusKey={`nav-${item.key}`}
                focusedClassName="bg-white !text-black"
                className={itemClasses(isActive)}
                playSound
              >
                <item.icon className="text-xl flex-shrink-0" />
                <span className="truncate whitespace-nowrap" style={labelStyle(hasFocusedChild)}>
                  {item.label}
                </span>
              </Focusable>
            );
          })}
        </nav>

        <Focusable
          onEnterPress={() => navigate('/settings')}
          onArrowPress={focusContent}
          focusKey="nav-settings"
          focusedClassName="bg-white !text-black"
          className={bottomItemClasses}
          playSound
        >
          <SettingsRegular className="text-xl flex-shrink-0" />
          <span className="truncate whitespace-nowrap" style={labelStyle(hasFocusedChild)}>
            Ajustes
          </span>
        </Focusable>

        {isGuest ? (
          <Focusable
            onEnterPress={handleLogin}
            onArrowPress={focusContent}
            focusKey="nav-login"
            focusedClassName="bg-white !text-black"
            className={bottomItemClasses}
            playSound
          >
            <LucideLogIn className="text-xl flex-shrink-0" />
            <span className="truncate whitespace-nowrap" style={labelStyle(hasFocusedChild)}>
              Iniciar sesión
            </span>
          </Focusable>
        ) : profile && (
          <Focusable
            onEnterPress={handleProfile}
            onArrowPress={focusContent}
            focusKey="nav-profile"
            focusedClassName="bg-white !text-black [&_span]:text-black"
            className={classNames(
              'flex h-10 items-center gap-2 rounded-lg',
              collapsed ? 'justify-center px-0' : 'justify-start px-2',
            )}
            playSound
          >
            <img
              src={avatarUrl}
              alt={profile.name}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div
              className="w-7 h-7 rounded-full bg-accent items-center justify-center text-white font-bold text-xs flex-shrink-0"
              style={{ display: 'none' }}
            >
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <span className="truncate whitespace-nowrap text-white" style={labelStyle(hasFocusedChild)}>
              {profile.name}
            </span>
          </Focusable>
        )}
      </aside>
    </FocusContext.Provider>
  );
});
