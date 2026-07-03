import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getExplore } from '@/features/content/explore';
import { resolveImageUrl } from '@/utils/helpers';
import { HeroSection } from '@/components/home/HeroSection';
import { FocusableCard } from '@/components/tv/FocusableCard';
import { FocusableRow } from '@/components/tv/FocusableRow';
import { Focusable } from '@/components/tv/Focusable';
import type { ContentItem, ExploreResponse } from '@/types/content';
import { syncContinueWatching, syncRecommendations } from '@/services/NativeBridge';
import type { AndroidTvHomeItem } from '@/services/NativeBridge';


export function HomeScreen() {
  const navigate = useNavigate();

  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);

  const fetchData = useCallback(async () => {
    if (!tokens) return;
    try {
      const explore = await getExplore(tokens.accessToken, {
        include_trailers: true,
      });
      setData(explore);
    } catch {
      // silently fail, show empty state
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data) return;
    const items: AndroidTvHomeItem[] = [];
    for (const cat of data.content ?? []) {
      for (const item of cat.content ?? []) {
        items.push({
          content_id: item.id,
          title: item.title,
          description: item.description,
          content_type: item.content_type,
          cover: resolveImageUrl(item.cover, clientEndpoint)!,
          cover_resized: resolveImageUrl(item.cover_resized, clientEndpoint)!,
          banner: resolveImageUrl(item.banner, clientEndpoint)!,
          banner_resized: resolveImageUrl(item.banner_resized, clientEndpoint)!,
          progress: item.progress,
          year: item.year,
          url: `/content/${item.id}`,
          image_url: resolveImageUrl(item.banner_resized ?? item.banner ?? item.cover_resized ?? item.cover, clientEndpoint)!,
        });
      }
    }
    syncContinueWatching(
      items
        .filter((i) => i.progress != null && i.progress > 0)
        .slice(0, 3)
        .map((i) => ({ ...i, progress: undefined }))
    );
    syncRecommendations(items);
  }, [data, clientEndpoint]);

  const handlePlay = (item: ContentItem) => {
    navigate(`/watch/${item.id}`);
  };

  const handleInfo = (item: ContentItem) => {
    navigate(`/content/${item.id}`);
  };

  const bannerItems = data?.banner_content ?? [];
  const firstRowFirstItemId = data?.content?.[0]?.content?.[0]?.id;
  const firstRowFocusKey = firstRowFirstItemId != null ? `home-row-0-item-${firstRowFirstItemId}` : undefined;
  const preferredChildFocusKey = bannerItems.length > 0 ? 'hero-section' : 'home-row-0';
  const { ref, focusKey } = useFocusable({
    focusKey: 'home-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey,
  });

  const focusHeroFromFirstRow = useCallback((direction: string) => {
    if (direction !== 'up' || bannerItems.length === 0) return true;
    setFocus('hero-view-more');
    return false;
  }, [bannerItems.length]);

  const focusSidebarFromRowStart = useCallback((direction: string) => {
    if (direction !== 'left') return true;
    setFocus('nav-home');
    return false;
  }, []);

  // Detect if sidebar has focus
  const isSidebarFocused = useCallback(() => {
    const focused = document.activeElement;
    if (!focused) return false;
    const key = focused.getAttribute('data-focus-key');
    return !!key && key.startsWith('nav-');
  }, []);

  // Back key: expand sidebar or show exit dialog
  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'XF86Back' || e.key === 'GoBack' || e.key === 'BrowserBack') {
        e.preventDefault();
        if (showExitDialog) {
          setShowExitDialog(false);
          return;
        }
        if (isSidebarFocused()) {
          setShowExitDialog(true);
        } else {
          setFocus('nav-home');
        }
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [isSidebarFocused, showExitDialog]);

  return (
    <>
      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="w-full h-dvh overflow-y-auto hide-scrollbar bg-bg"
        >
          <h1 className="fixed top-[clamp(1rem,3vh,1.5rem)] right-[clamp(1.5rem,4vw,2rem)] text-white text-[clamp(1.5rem,2vw,2rem)] font-medium z-999">CinelarTV</h1>
          {loading ? (
            <div className="w-full h-full flex flex-col">
              <div className="w-full h-[clamp(360px,70vh,680px)] bg-surface animate-pulse-slow" />
              <div className="px-[clamp(3rem,7.5vw,6rem)] py-[clamp(1.25rem,4vh,2rem)] space-y-[clamp(1.5rem,4vh,2rem)]">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <div className="h-[clamp(1.125rem,2.4vh,1.5rem)] w-[clamp(10rem,15vw,12rem)] bg-surface rounded mb-[clamp(0.75rem,2vh,1rem)] animate-pulse-slow" />
                    <div className="flex gap-[clamp(0.5rem,1vw,0.75rem)]">
                      {[1, 2, 3, 4, 5].map((j) => (
                        <div key={j} className="w-[clamp(156px,18vw,230px)] h-[clamp(88px,10.2vw,130px)] bg-surface rounded-xl animate-pulse-slow" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {bannerItems.length > 0 && (
                <HeroSection
                  items={bannerItems}
                  onPlay={handlePlay}
                  onInfo={handleInfo}
                  clientEndpoint={clientEndpoint}
                  firstRowFocusKey={firstRowFocusKey}
                  sidebarFocusKey="nav-home"
                />
              )}

              <div className="mt-[clamp(1.5rem,4vh,3rem)] relative z-10 pb-[clamp(3rem,8vh,4rem)]">
                {data?.content?.map((category, catIdx) => (
                  <FocusableRow
                    key={catIdx}
                    title={category.title}
                    focusKey={`home-row-${catIdx}`}
                    className="scroll-smooth"
                    preferredChildFocusKey={
                      category.content?.[0]?.id != null ? `home-row-${catIdx}-item-${category.content[0].id}` : undefined
                    }
                  >
                    {category.content?.map((item, itemIdx) => (
                      <FocusableCard
                        key={item.id}
                        focusKey={`home-row-${catIdx}-item-${item.id}`}
                        title={item.title}
                        image={resolveImageUrl(
                          item.banner_resized ?? item.banner ?? item.cover_resized ?? item.cover,
                          clientEndpoint,
                        )}
                        subtitle={item.content_type === 'TVSHOW' ? 'Serie' : undefined}
                        progress={item.progress}
                        onArrowPress={(direction) => {
                          if (catIdx === 0 && direction === 'up') return focusHeroFromFirstRow(direction);
                          if (itemIdx === 0 && direction === 'left') return focusSidebarFromRowStart(direction);
                          return true;
                        }}
                        onEnterPress={() => handleInfo(item)}
                      />
                    ))}
                  </FocusableRow>
                ))}
              </div>
            </>
          )}
        </div>
      </FocusContext.Provider>

      {showExitDialog && (
        <ExitDialog
          onConfirm={() => window.close()}
          onCancel={() => setShowExitDialog(false)}
        />
      )}
    </>
  );
}

function ExitDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { ref } = useFocusable({
    focusKey: 'exit-dialog',
    trackChildren: true,
    preferredChildFocusKey: 'exit-cancel',
  });

  useEffect(() => {
    setFocus('exit-cancel');
  }, []);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="bg-[#1a1a1a] rounded-2xl p-8 w-[400px] shadow-2xl border border-white/10"
      >
        <h2 className="text-white text-xl font-bold mb-2">Salir de CinelarTV</h2>
        <p className="text-white/50 text-sm mb-8">¿Quieres cerrar la aplicación?</p>
        <div className="flex gap-3 justify-end">
          <Focusable
            onEnterPress={onCancel}
            focusKey="exit-cancel"
            focusedClassName="bg-white/15"
            className="px-6 py-2.5 rounded-full text-white/70 text-sm font-medium transition-colors cursor-pointer"
          >
            Cancelar
          </Focusable>
          <Focusable
            onEnterPress={onConfirm}
            focusKey="exit-confirm"
            focusedClassName="bg-white scale-105"
            className="px-6 py-2.5 rounded-full bg-accent text-white text-sm font-semibold transition-all cursor-pointer"
          >
            Salir
          </Focusable>
        </div>
      </div>
    </div>
  );
}
