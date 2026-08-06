import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getContentById, prefetchWatchData } from '@/features/content/api';
import { DetailHero } from '@/components/detail/DetailHero';
import { DetailOverview } from '@/components/detail/DetailOverview';
import { DetailSeasonSelector } from '@/components/detail/DetailSeasonSelector';
import { DetailEpisodeRail } from '@/components/detail/DetailEpisodeRail';
import { DetailRecommendations } from '@/components/detail/DetailRecommendations';
import { FocusableButton } from '@/components/tv/FocusableButton';
import type { ContentDetail } from '@/types/content';
import { isTVShow } from '@/types/content';
import { M3eLoadingIndicator } from '@m3e/react/loading-indicator';
import { isBackKey } from '@/utils/helpers';

export function ContentDetailScreen() {
  useSpatialNavInit();
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const isGuest = useAuthStore((s) => s.isGuest);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);

  const [content, setContent] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seasons = content?.seasons ?? [];
  const categories = content?.categories ?? [];
  const currentEpisodes = seasons[selectedSeason]?.episodes ?? [];
  const relatedContent = content?.related_content ?? [];

  const firstEpisodeId = currentEpisodes[0]?.id;
  const firstEpisodeFocusKey = firstEpisodeId != null ? `detail-episode-${firstEpisodeId}` : undefined;
  const selectedSeasonFocusKey = seasons[selectedSeason]?.id != null
    ? `detail-season-${seasons[selectedSeason].id}`
    : undefined;

  const { ref: focusRootRef, focusKey } = useFocusable({
    focusKey: 'content-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'detail-hero-play',
  });

  // ── Data fetching ──────────────────────────────────────────────
  useEffect(() => {
    if (!contentId) return;
    setLoading(true);
    getContentById(tokens?.accessToken ?? '', contentId)
      .then(setContent)
      .finally(() => setLoading(false));
  }, [tokens, contentId]);

  // ── Back key ───────────────────────────────────────────────────
  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.preventDefault();
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [navigate]);

  // ── Cleanup prefetch timer ─────────────────────────────────────
  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    };
  }, []);

  // ── Vertical scroll-to-focus tracking ──────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId = 0;

    const onFocusChange = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const focused = el.querySelector<HTMLElement>('[data-focused="true"]');
        if (!focused) return;
        const rect = focused.getBoundingClientRect();
        const containerRect = el.getBoundingClientRect();
        const topSafeArea = Math.min(96, window.innerHeight * 0.12);
        const bottomSafeArea = Math.min(48, window.innerHeight * 0.07);

        if (rect.top < containerRect.top + topSafeArea) {
          el.scrollBy({
            top: rect.top - containerRect.top - topSafeArea,
            behavior: 'smooth',
          });
        } else if (rect.bottom > containerRect.bottom - bottomSafeArea) {
          el.scrollBy({
            top: rect.bottom - containerRect.bottom + bottomSafeArea,
            behavior: 'smooth',
          });
        }
      });
    };

    const observer = new MutationObserver(onFocusChange);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, [content]);

  // ── Derived state ──────────────────────────────────────────────
  const canPlay = useMemo(() => {
    if (!content) return false;
    if (!isTVShow(content)) return true;
    if (content.continue_watching?.episode_id) return true;
    return (content.seasons?.[0]?.episodes?.length ?? 0) > 0;
  }, [content]);

  // ── Initial focus: never leave the screen without focus ────────
  useEffect(() => {
    if (!content) return;
    const id = requestAnimationFrame(() => {
      if (canPlay) setFocus('detail-hero-play');
    });
    return () => cancelAnimationFrame(id);
  }, [content, canPlay]);

  // ── Handlers ───────────────────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (!content || !canPlay) return;
    if (!tokens && isGuest) { navigate('/auth'); return; }

    const episodeId = content.continue_watching?.episode_id;
    if (episodeId) { navigate(`/watch/${content.id}/${episodeId}`); return; }

    if (!isTVShow(content)) { navigate(`/watch/${content.id}`); return; }

    const firstEpisode = content.seasons?.[0]?.episodes?.[0];
    if (firstEpisode) navigate(`/watch/${content.id}/${firstEpisode.id}`);
  }, [content, navigate, canPlay, tokens, isGuest]);

  const handlePlayEpisode = useCallback(
    (episodeId: string | number) => {
      if (!tokens && isGuest) { navigate('/auth'); return; }
      navigate(`/watch/${contentId}/${episodeId}`);
    },
    [contentId, navigate, tokens, isGuest],
  );

  const handlePlayEpisodeFocus = useCallback(
    (episodeId: string | number) => {
      if (!tokens || !contentId) return;
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = setTimeout(() => {
        prefetchTimerRef.current = null;
        prefetchWatchData(tokens?.accessToken ?? '', contentId, episodeId);
      }, 4000);
    },
    [tokens, contentId],
  );

  const handlePlayFocus = useCallback(() => {
    if (!content || !tokens) return;
    const episodeId = content.continue_watching?.episode_id
      ?? (isTVShow(content)
        ? content.seasons?.[0]?.episodes?.[0]?.id
        : undefined);
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = setTimeout(() => {
      prefetchTimerRef.current = null;
      prefetchWatchData(tokens?.accessToken ?? '', content.id, episodeId);
    }, 4000);
  }, [content, tokens]);

  const handleToggleList = useCallback(() => {
    // TODO: implement toggle like
  }, []);

  const handleSelectRelated = useCallback(
    (item: { id: string | number }) => {
      navigate(`/content/${item.id}`);
    },
    [navigate],
  );

  const focusSidebarFromLeftEdge = useCallback((direction: string) => {
    if (direction !== 'left') return true;
    setFocus('sidebar');
    return false;
  }, []);

  const focusContentTarget = useCallback((focusKey?: string) => {
    if (!focusKey) return true;
    setFocus(focusKey);
    return false;
  }, []);

  const handleSeasonArrowUp = useCallback(
    (direction: string) => {
      if (direction !== 'up') return true;
      return focusContentTarget('detail-hero-play');
    },
    [focusContentTarget],
  );

  const handleSeasonArrowDown = useCallback(
    (epFocusKey?: string) => (direction: string) => {
      if (direction !== 'down') return true;
      return focusContentTarget(epFocusKey);
    },
    [focusContentTarget],
  );

  const handleEpisodeArrowUp = useCallback(
    (direction: string) => {
      if (direction !== 'up') return true;
      return focusContentTarget(selectedSeasonFocusKey ?? 'detail-hero-play');
    },
    [focusContentTarget, selectedSeasonFocusKey],
  );

  const handleEpisodeArrowLeft = useCallback(
    (direction: string) => {
      if (direction !== 'left') return true;
      return focusSidebarFromLeftEdge(direction);
    },
    [focusSidebarFromLeftEdge],
  );

  const handleRelatedArrowUp = useCallback(
    (direction: string) => {
      if (direction !== 'up') return true;
      return focusContentTarget(firstEpisodeFocusKey ?? selectedSeasonFocusKey ?? 'detail-hero-play');
    },
    [focusContentTarget, firstEpisodeFocusKey, selectedSeasonFocusKey],
  );

  const handleHeroFocus = useCallback(() => {
    requestAnimationFrame(() => {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);


  // ── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full h-dvh bg-bg flex items-center justify-center">
        <M3eLoadingIndicator style={{ '--m3e-loading-indicator-active-indicator-color': '#ddd' } as any} />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────
  if (!content) {
    return (
      <div className="w-full h-dvh bg-bg flex flex-col items-center justify-center gap-[clamp(0.75rem,2vh,1rem)]">
        <p className="text-text-secondary text-[clamp(1rem,1.6vw,1.25rem)]">Contenido no encontrado</p>
        <FocusableButton onEnterPress={() => navigate('/home')} autoFocus playSound>
          Volver al inicio
        </FocusableButton>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────
  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={(node) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          (focusRootRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className="w-full h-dvh overflow-y-auto hide-scrollbar bg-bg"
      >
        {/* Hero */}
        <DetailHero
          content={content}
          clientEndpoint={clientEndpoint}
          canPlay={canPlay}
          onPlay={handlePlay}
          onToggleList={handleToggleList}
          onNavigateDown={(dir) => {
            if (dir !== 'down') return true;
            if (seasons.length > 0) {
              return focusContentTarget(selectedSeasonFocusKey ?? firstEpisodeFocusKey);
            }
            return true;
          }}
          onNavigateLeft={focusSidebarFromLeftEdge}
          onNavigateUp={() => true}
          onPlayFocus={handlePlayFocus}
          onHeroFocus={handleHeroFocus}
          firstEpisodeFocusKey={firstEpisodeFocusKey}
          firstSeasonFocusKey={selectedSeasonFocusKey}
        />

        {/* Content sections */}
        <div className="px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(4rem,10vh,6rem)] space-y-[clamp(2rem,5vh,3.5rem)]">
          {/* Overview */}
          <DetailOverview description={content.description} />

          {/* Seasons & Episodes */}
          {seasons.length > 0 && (
            <section>
              <h2 className="text-[clamp(1.125rem,1.6vw,1.375rem)] font-bold text-white mb-[clamp(0.75rem,2vh,1rem)]">
                Episodios
              </h2>

              <div className="mb-[clamp(1rem,2.5vh,1.5rem)]">
                <DetailSeasonSelector
                  seasons={seasons}
                  selectedIndex={selectedSeason}
                  onSelect={setSelectedSeason}
                  onArrowUp={handleSeasonArrowUp}
                  onArrowDown={handleSeasonArrowDown(firstEpisodeFocusKey)}
                />
              </div>

              {currentEpisodes.length > 0 && (
                <DetailEpisodeRail
                  key={selectedSeason}
                  episodes={currentEpisodes}
                  seasonIndex={selectedSeason}
                  preferredChildFocusKey={firstEpisodeFocusKey}
                  onPlayEpisode={handlePlayEpisode}
                  onFocusEpisode={handlePlayEpisodeFocus}
                  onArrowUp={handleEpisodeArrowUp}
                  onArrowLeft={handleEpisodeArrowLeft}
                />
              )}
            </section>
          )}

          {/* Recommendations */}
          {relatedContent.length > 0 && (
            <section>
              <h2 className="text-[clamp(1.125rem,1.6vw,1.375rem)] font-bold text-white mb-[clamp(0.75rem,2vh,1rem)]">
                También te puede gustar
              </h2>
              <DetailRecommendations
                items={relatedContent}
                onSelect={handleSelectRelated}
                onArrowUp={handleRelatedArrowUp}
              />
            </section>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
}
