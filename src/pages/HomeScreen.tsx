import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { useToastStore } from '@/stores/toastStore';
import { getExplore } from '@/features/content/explore';
import { resolveImageUrl, isBackKey, resolveBackdrop, resolvePoster } from '@/utils/helpers';
import { HeroSection } from '@/components/home/HeroSection';
import { FocusableCard } from '@/components/tv/FocusableCard';
import { FocusableRow } from '@/components/tv/FocusableRow';
import { Focusable } from '@/components/tv/Focusable';
import type { ContentItem, ExploreResponse } from '@/types/content';
import { isTVShow } from '@/types/content';
import { syncContinueWatching, syncRecommendations, exitApp } from '@/services/NativeBridge';
import { ExitDialog } from '@/components/ui/ExitDialog';
import type { AndroidTvHomeItem } from '@/services/NativeBridge';

const progressPercent = (item: ContentItem) => {
  if (!item.progress || !item.duration) return 0;
  return Math.min(100, Math.round((item.progress / item.duration) * 100));
};

// Memoized image URL resolution per item
function useItemImages(item: ContentItem, clientEndpoint: string) {
  return useMemo(() => ({
    image: resolvePoster(item.images, item.cover_resized ?? item.cover, clientEndpoint),
    bannerImage: resolveBackdrop(item.images, item.banner_resized ?? item.banner, clientEndpoint, 'medium'),
  }), [item.images, item.cover_resized, item.cover, item.banner_resized, item.banner, clientEndpoint]);
}


export function HomeScreen() {
  const navigate = useNavigate();

  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [heroImmersive, setHeroImmersive] = useState(false);

  const fetchData = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const explore = await getExplore(tokens?.accessToken, {
        include_trailers: true,
        img_variants: ['xlarge', 'large', 'medium'],
      });
      setData(explore);
    } catch (e: any) {
      setError(true);
      const errStr = String(e?.message ?? e ?? '');
      const is502 = e?.status === 502 || errStr.includes('502') || errStr.toLowerCase().includes('bad gateway');
      useToastStore.getState().show(
        is502
          ? 'El servicio no está disponible temporalmente. Intenta de nuevo.'
          : 'Error al cargar la página. Intenta de nuevo.',
        'error',
        is502 ? 6000 : 5000,
      );
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
        const poster = resolvePoster(item.images, item.cover_resized ?? item.cover, clientEndpoint);
        const backdrop = resolveBackdrop(item.images, item.banner_resized ?? item.banner, clientEndpoint, 'medium');
        items.push({
          content_id: item.id,
          title: item.title,
          description: item.description,
          content_type: item.content_type ?? item.contentType,
          cover: resolveImageUrl(item.cover, clientEndpoint)!,
          cover_resized: poster ?? resolveImageUrl(item.cover_resized, clientEndpoint)!,
          banner: resolveImageUrl(item.banner, clientEndpoint)!,
          banner_resized: backdrop ?? resolveImageUrl(item.banner_resized, clientEndpoint)!,
          progress: item.progress,
          duration: item.duration,
          year: item.year,
          url: `/content/${item.id}`,
          image_url: backdrop ?? poster ?? resolveImageUrl(item.banner_resized ?? item.banner ?? item.cover_resized ?? item.cover, clientEndpoint)!,
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

  const { bannerItems, firstRowFocusKey, preferredChildFocusKey } = useMemo(() => {
    const banner = data?.banner_content ?? [];
    const firstId = data?.content?.[0]?.content?.[0]?.id;
    return {
      bannerItems: banner,
      firstRowFocusKey: firstId != null ? `home-row-0-item-${firstId}` : undefined,
      preferredChildFocusKey: banner.length > 0 ? 'hero-section' : 'home-row-0',
    };
  }, [data]);
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
    setFocus('sidebar');
    return false;
  }, []);

  // Detect if sidebar has focus via spatial navigation state (document.activeElement is never set)
  const isSidebarFocused = useCallback(() => {
    const key = getCurrentFocusKey();
    return !!key && (key === 'sidebar' || key.startsWith('nav-'));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const currentKey = getCurrentFocusKey();
      if (currentKey && doesFocusableExist(currentKey)) return;
      e.preventDefault();
      setFocus(loading || error ? 'sidebar' : 'home-root');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loading, error]);

  // Back key: focus sidebar or show exit dialog
  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.preventDefault();
        if (showExitDialog) {
          setShowExitDialog(false);
          return;
        }
        if (isSidebarFocused()) {
          setShowExitDialog(true);
        } else {
          setFocus('sidebar');
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
          className={`w-full h-dvh hide-scrollbar bg-bg transition-all duration-700 ${heroImmersive ? 'overflow-hidden' : 'overflow-y-auto'}`}
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
          ) : error ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-8 px-8">
              <p className="text-text-secondary text-[clamp(1rem,1.4vw,1.25rem)] text-center max-w-md">
                No se pudo cargar el contenido. Verifica tu conexión e intenta de nuevo.
              </p>
              <Focusable
                onEnterPress={fetchData}
                focusKey="home-retry"
                focusedClassName="!bg-white !text-black scale-105"
                className="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(2rem,3vw,3rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium transition-all duration-200 cursor-pointer inline-flex items-center"
                playSound
              >
                Reintentar
              </Focusable>
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
                  sidebarFocusKey="sidebar"
                  onImmersiveChange={setHeroImmersive}
                />
              )}

              <div className={`mt-[clamp(1.5rem,4vh,3rem)] relative z-10 pb-[clamp(3rem,8vh,4rem)] transition-all duration-700 will-change-opacity ${heroImmersive ? 'opacity-0 pointer-events-none' : ''}`}>
                {data?.content?.map((category, catIdx) => {
                  const preferredChild = category.content?.[0]?.id != null
                    ? `home-row-${catIdx}-item-${category.content[0].id}`
                    : undefined;

                  const rowContent = (
                    <FocusableRow
                      key={catIdx}
                      title={category.title}
                      focusKey={`home-row-${catIdx}`}
                      className=""
                      preferredChildFocusKey={preferredChild}
                    >
                      {category.content?.map((item, itemIdx) => (
                        <MemoizedCard
                          key={item.id}
                          item={item}
                          clientEndpoint={clientEndpoint}
                          focusKey={`home-row-${catIdx}-item-${item.id}`}
                          catIdx={catIdx}
                          itemIdx={itemIdx}
                          focusHeroFromFirstRow={focusHeroFromFirstRow}
                          focusSidebarFromRowStart={focusSidebarFromRowStart}
                          onEnterPress={() => handleInfo(item)}
                        />
                      ))}
                    </FocusableRow>
                  );

                  // First 2 rows always rendered, rest lazy
                  if (catIdx < 2) return rowContent;
                  if (!category.content?.length) return null;
                  return (
                    <LazyRow
                      key={`lazy-${catIdx}`}
                      focusKey={`home-lazy-${catIdx}`}
                      preferredChildFocusKey={preferredChild}
                    >
                      {rowContent}
                    </LazyRow>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {showExitDialog && (
          <ExitDialog
            onConfirm={() => exitApp()}
            onCancel={() => setShowExitDialog(false)}
          />
        )}
      </FocusContext.Provider>
    </>
  );
}

// Lazy rendering: only mount row content when near the viewport.
// The sentinel doubles as a spatial-navigation target so arrow-key users can
// descend into unrendered rows: norigin focuses the sentinel, the row mounts
// and focus is handed to its first card. Without this, rows below the last
// rendered one are unreachable on TV (no mouse wheel to trigger the observer).
function LazyRow({
  children,
  focusKey,
  preferredChildFocusKey,
  rootMargin = '600px',
}: {
  children: React.ReactNode;
  focusKey: string;
  preferredChildFocusKey?: string;
  rootMargin?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const focusOnMountRef = useRef(false);

  // Pre-mount when the row approaches the viewport (mouse scroll / image preloading)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || shouldRender) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShouldRender(true);
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldRender, rootMargin]);

  // If the row mounted because spatial navigation focused the sentinel,
  // hand focus to the real row's first card (retry until it registers).
  // We do NOT guard on getCurrentFocusKey: when the sentinel unmounts its
  // useFocusable cleanup triggers Norigin's autoRestoreFocus, which
  // redirects focus to home-root's preferredChildFocusKey (hero) before this
  // effect runs. Calling setFocus here corrects that immediately.
  useEffect(() => {
    if (!shouldRender || !focusOnMountRef.current || !preferredChildFocusKey) return;
    let attempts = 0;
    const tryFocus = () => {
      attempts += 1;
      if (doesFocusableExist(preferredChildFocusKey)) {
        focusOnMountRef.current = false;
        setFocus(preferredChildFocusKey);
        return;
      }
      if (attempts < 20) requestAnimationFrame(tryFocus);
    };
    requestAnimationFrame(tryFocus);
  }, [shouldRender, preferredChildFocusKey]);

  return (
    <div ref={sentinelRef}>
      {shouldRender ? (
        children
      ) : (
        <LazySentinel
          focusKey={focusKey}
          onActivate={() => {
            focusOnMountRef.current = true;
            setShouldRender(true);
          }}
        />
      )}
    </div>
  );
}

function LazySentinel({ focusKey, onActivate }: { focusKey: string; onActivate: () => void }) {
  const { ref, focused } = useFocusable({
    focusKey,
    onFocus: onActivate,
  });

  return <div ref={ref} data-focused={focused} className="h-[300px] w-full" />;
}

// Memoized card wrapper — resolves image URLs once per item change
const MemoizedCard = memo(function MemoizedCard({
  item,
  clientEndpoint,
  focusKey,
  catIdx,
  itemIdx,
  focusHeroFromFirstRow,
  focusSidebarFromRowStart,
  onEnterPress,
}: {
  item: ContentItem;
  clientEndpoint: string;
  focusKey: string;
  catIdx: number;
  itemIdx: number;
  focusHeroFromFirstRow: (d: string) => boolean;
  focusSidebarFromRowStart: (d: string) => boolean;
  onEnterPress: () => void;
}) {
  const { image, bannerImage } = useItemImages(item, clientEndpoint);

  return (
    <FocusableCard
      variant="row"
      focusKey={focusKey}
      title={item.title}
      description={item.description}
      year={item.year}
      image={image}
      bannerImage={bannerImage}
      subtitle={undefined}
      progress={progressPercent(item)}
      onArrowPress={(direction) => {
        if (catIdx === 0 && direction === 'up') return focusHeroFromFirstRow(direction);
        if (itemIdx === 0 && direction === 'left') return focusSidebarFromRowStart(direction);
        return true;
      }}
      onEnterPress={onEnterPress}
      playSound
    />
  );
});
