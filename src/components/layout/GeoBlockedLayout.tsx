import { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { Focusable } from '@/components/tv/Focusable';
import { TvRegular } from '@fluentui/react-icons';
import { LucideRefreshCw, LucideMapPinOff } from 'lucide-react';
import { classNames, isBackKey } from '@/utils/helpers';
import { checkGeoBlock, clearGeoCache } from '@/services/geoblocking';
import { useToastStore } from '@/stores/toastStore';
import { ExitDialog } from '@/components/ui/ExitDialog';
import { exitApp } from '@/services/NativeBridge';
import { GeoblockedModeContext, SIDEBAR_FOCUS_KEY } from './geoblockedModeContext';

export function GeoBlockedLayout() {
  useSpatialNavInit();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const { ref, focusKey, hasFocusedChild } = useFocusable({
    focusKey: SIDEBAR_FOCUS_KEY,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'nav-live',
  });

  useEffect(() => {
    setSidebarFocused(hasFocusedChild);
  }, [hasFocusedChild]);

  const isSidebarFocused = useCallback(() => {
    const key = getCurrentFocusKey();
    return !!key && (key === SIDEBAR_FOCUS_KEY || key.startsWith('nav-'));
  }, []);

  // Back key: close exit dialog, or open it when the sidebar has focus.
  // When focus is in the content area, LiveTVScreen delegates to us via
  // GeoblockedModeContext to move focus to the sidebar.
  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      const sidebarHasFocus = isSidebarFocused();
      if (!showExitDialog && !sidebarHasFocus) return;
      e.preventDefault();
      if (showExitDialog) {
        setShowExitDialog(false);
      } else {
        setShowExitDialog(true);
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [isSidebarFocused, showExitDialog]);

  const focusContent = useCallback((direction: string) => {
    if (direction !== 'right') return true;
    setFocus('livetv-root');
    return false;
  }, []);

  const handleRetry = useCallback(async () => {
    if (retrying) return;
    useToastStore.getState().show('Intentando verificar tu ubicación nuevamente', 'info', 3000, 'Verificando ubicación');
    setRetrying(true);
    try {
      await clearGeoCache();
      const geo = await checkGeoBlock();
      if (!geo.blocked) {
        window.location.href = '/';
        return;
      }
    } catch {
      // ignore
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  const collapsed = !hasFocusedChild;
  const isActive = location.pathname === '/live';

  const itemBaseClasses = 'flex h-11 items-center gap-3 rounded-md text-sm font-medium';
  const itemClasses = classNames(
    itemBaseClasses,
    collapsed ? 'justify-center px-0' : 'justify-start px-3',
    isActive ? 'text-white border-l-2 border-accent' : 'text-white/55 border-l-2 border-transparent',
  );

  const labelStyle: React.CSSProperties = {
    display: hasFocusedChild ? 'block' : 'none',
  };

  return (
    <GeoblockedModeContext.Provider value={SIDEBAR_FOCUS_KEY}>
      <div
        className="grid h-dvh overflow-hidden bg-bg"
        style={{
          gridTemplateColumns: sidebarFocused
            ? 'var(--sidebar-w, 200px) 1fr'
            : 'var(--sidebar-w-collapsed, 72px) 1fr',
          gridTemplateAreas: '"sidebar main"',
        }}
      >
        <FocusContext.Provider value={focusKey}>
          <aside
            ref={ref as React.RefObject<HTMLElement>}
            style={{ gridArea: 'sidebar' }}
            className={classNames(
              'relative h-full w-full flex flex-col py-4 bg-bg',
              collapsed ? 'px-0' : 'px-2',
            )}
          >
            <nav className="flex-1 flex flex-col gap-1 justify-center">
              <Focusable
                onEnterPress={() => navigate('/live')}
                onArrowPress={focusContent}
                focusKey="nav-live"
                focusedClassName="bg-white !text-black border-transparent"
                className={itemClasses}
                playSound
              >
                <span className="w-6 flex items-center justify-center flex-shrink-0">
                  <TvRegular className="text-xl" />
                </span>
                <span className="truncate whitespace-nowrap" style={labelStyle}>
                  TV en Vivo
                </span>
              </Focusable>
            </nav>

            <div className="flex flex-col gap-1 pt-2 mt-2 border-t border-white/10">
              <Focusable
                onEnterPress={handleRetry}
                onArrowPress={focusContent}
                focusKey="nav-retry"
                focusedClassName="bg-white !text-black border-transparent"
                className={classNames(
                  itemBaseClasses,
                  collapsed ? 'justify-center px-0' : 'justify-start px-3',
                  'text-white/55 border-l-2 border-transparent',
                )}
                playSound
              >
                <span className="w-6 flex items-center justify-center flex-shrink-0">
                  {retrying ? (
                    <LucideRefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <LucideMapPinOff className="w-5 h-5" />
                  )}
                </span>
                <span className="truncate whitespace-nowrap" style={labelStyle}>
                  Verificar ubicación
                </span>
              </Focusable>
            </div>
          </aside>
        </FocusContext.Provider>

        <main className="h-full w-full overflow-hidden" style={{ gridArea: 'main' }}>
          <Outlet />
        </main>
      </div>

      {showExitDialog && (
        <ExitDialog
          onConfirm={() => exitApp()}
          onCancel={() => setShowExitDialog(false)}
        />
      )}
    </GeoblockedModeContext.Provider>
  );
}
