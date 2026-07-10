import { useNavigate, useLocation } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { deassignProfile } from '@/features/auth/session';
import { classNames } from '@/utils/helpers';
import { LucideSearch, LucideTelescope, LucideTv, LucideSettings, LucideLogIn } from "lucide-react";
import { CollectionsEmptyRegular, CollectionsRegular, SearchFilled, SearchRegular, SettingsRegular, TvRegular } from "@fluentui/react-icons";
const NAV_ITEMS = [
  { key: 'home', label: 'Inicio', icon: CollectionsEmptyRegular, path: '/home' },
  { key: 'search', label: 'Buscar', icon: SearchFilled, path: '/search' },
  { key: 'live', label: 'TV en Vivo', icon: TvRegular, path: '/live' },
  //{ key: 'my-list', label: 'Mi Lista', icon: LucideTelescope, path: '/my-list' },
];

export function TVSidebar() {
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

  const focusKeyForPath = (path: string): string => {
    if (path.startsWith('/content/')) return 'content-root';
    if (path.startsWith('/search')) return 'search-root';
    if (path.startsWith('/live')) return 'livetv-root';
    if (path.startsWith('/settings')) return 'settings-root';
    return 'home-root';
  };

  const navigateAndCollapse = (path: string) => {
    navigate(path);
    requestAnimationFrame(() => setFocus(focusKeyForPath(path)));
  };

  const focusContent = (direction: string) => {
    if (direction !== 'right') return true;
    setFocus(focusKeyForPath(location.pathname));
    return false;
  };

  return (
    <FocusContext.Provider value={focusKey}>
      <aside
        ref={ref as React.RefObject<HTMLElement>}
        className={classNames(
          'absolute left-0 top-0 z-50 h-full py-6',
          'flex flex-col',
          // Gradiente izq -> der, opaco -> transparente (look YouTube TV)
          'bg-gradient-to-r',
          hasFocusedChild
            ? 'from-black from-40% via-black/80 to-transparent w-80 px-4'
            : 'from-black/85 from-20% via-black/30 to-transparent w-24 px-2',
          'transition-[width,padding] duration-300 ease-out',
        )}
      >
        <div className={classNames('flex items-center mb-12 h-8 px-2', hasFocusedChild ? 'justify-start' : 'justify-center')}>

        </div>

        <nav className="flex-1 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Focusable
                key={item.key}
                onEnterPress={() => navigateAndCollapse(item.path)}
                onArrowPress={focusContent}
                focusKey={`nav-${item.key}`}
                focusedClassName="bg-white !text-black"
                className={classNames(
                  'flex h-12 items-center gap-4 rounded-full px-3 text-base font-medium',
                  hasFocusedChild ? 'justify-start' : 'justify-center',
                  isActive ? 'text-white' : 'text-white/70',
                )}
              >
                <item.icon className="text-2xl" />
                <span
                  className={classNames(
                    'truncate whitespace-nowrap',
                    hasFocusedChild ? 'opacity-100' : 'w-0 opacity-0',
                  )}
                >
                  {item.label}
                </span>
              </Focusable>
            );
          })}
        </nav>

        <Focusable
          onEnterPress={() => navigateAndCollapse('/settings')}
          onArrowPress={focusContent}
          focusKey="nav-settings"
          focusedClassName="bg-white !text-black"
          className={classNames(
            'flex h-12 items-center gap-4 rounded-full px-3 text-base font-medium mb-1',
            hasFocusedChild ? 'justify-start' : 'justify-center',
            'text-white/70',
          )}
        >
          <SettingsRegular className="text-2xl" />
          <span
            className={classNames(
              'truncate whitespace-nowrap',
              hasFocusedChild ? 'opacity-100' : 'w-0 opacity-0',
            )}
          >
            Ajustes
          </span>
        </Focusable>

        {isGuest ? (
          <Focusable
            onEnterPress={() => {
              exitGuestMode();
              navigateAndCollapse('/auth');
            }}
            onArrowPress={focusContent}
            focusKey="nav-login"
            focusedClassName="bg-white !text-black"
            className={classNames(
              'flex h-12 items-center gap-4 rounded-full px-3 text-base font-medium mb-1',
              hasFocusedChild ? 'justify-start' : 'justify-center',
              'text-white/70',
            )}
          >
            <LucideLogIn className="text-2xl" />
            <span
              className={classNames(
                'truncate whitespace-nowrap',
                hasFocusedChild ? 'opacity-100' : 'w-0 opacity-0',
              )}
            >
              Iniciar sesión
            </span>
          </Focusable>
        ) : profile && (
          <Focusable
            onEnterPress={() => {
              const token = useAuthStore.getState().tokens?.accessToken;
              if (token) deassignProfile(token).catch(() => { });
              navigateAndCollapse('/select-profile');
            }}
            onArrowPress={focusContent}
            focusKey="nav-profile"
            focusedClassName="bg-white !text-black [&_span]:text-black"
            className={classNames(
              'flex h-12 items-center gap-3 rounded-full px-2',
              hasFocusedChild ? 'justify-start' : 'justify-center',
            )}
          >
            <img
              src={`${clientEndpoint}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'}.png`}
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
            <span
              className={classNames(
                'truncate whitespace-nowrap text-white',
                hasFocusedChild ? 'opacity-100' : 'w-0 opacity-0',
              )}
            >
              {profile.name}
            </span>
          </Focusable>
        )}
      </aside>
    </FocusContext.Provider>
  );
}
