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
import { useToastStore } from '@/stores/toastStore';
import type { ContentDetail } from '@/types/content';
import { isTVShow } from '@/types/content';
import { M3eLoadingIndicator } from '@m3e/react/loading-indicator';
import { isBackKey } from '@/utils/helpers';
import { showPanel, buttonItem } from '@/services/overlayPanel';

// ── Local presentational helper ─────────────────────────────────
// Editorial-style heading: title + trailing gradient rule, replaces
// the old uppercase micro-label pattern used for every section.
function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-[clamp(1rem,2vw,1.5rem)] mb-[clamp(1.25rem,3vh,2rem)]">
      <h2 className="shrink-0 text-white font-bold tracking-tight text-[clamp(1.125rem,1.6vw,1.5rem)]">
        {title}
      </h2>
      <div className="flex-1 h-px bg-gradient-to-r from-white/15 via-white/5 to-transparent" />
    </div>
  );
}

function showAuthPanel(navigate: ReturnType<typeof useNavigate>) {
  showPanel({
    title: 'Iniciar sesión',
    subtitle: 'Para mirar este contenido debes iniciar sesión o crear una cuenta',
    items: [
      buttonItem(
        { title: 'Iniciar sesión', subtitle: 'Usar una cuenta existente', icon: 'login' },
        () => navigate('/auth'),
      ),
      buttonItem(
        { title: 'Crear cuenta', subtitle: 'Regístrate gratis', icon: 'user' },
        () => navigate('/auth'),
      ),
      buttonItem({ title: 'Volver', subtitle: 'Cancelar', icon: 'x' }),
    ],
  });
}

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
        const topSafeArea = Math.min(80, window.innerHeight * 0.1);
        const bottomSafeArea = Math.min(40, window.innerHeight * 0.06);

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

  // ── Initial focus ──────────────────────────────────────────────
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
    if (!tokens && isGuest) { showAuthPanel(navigate); return; }

    const episodeId = content.continue_watching?.episode_id;
    if (episodeId) { navigate(`/watch/${content.id}/${episodeId}`); return; }

    if (!isTVShow(content)) { navigate(`/watch/${content.id}`); return; }

    const firstEpisode = content.seasons?.[0]?.episodes?.[0];
    if (firstEpisode) navigate(`/watch/${content.id}/${firstEpisode.id}`);
  }, [content, navigate, canPlay, tokens, isGuest]);

  const handlePlayEpisode = useCallback(
    (episodeId: string | number) => {
      if (!tokens && isGuest) { showAuthPanel(navigate); return; }
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

  const handlePlayTrailer = useCallback(() => {
    const trailerUrl = content?.trailer_sources?.[0]?.url ?? content?.trailer_video_sources?.[0]?.url;
    if (trailerUrl) {
      navigate(`/watch/${content?.id}`);
    } else {
      useToastStore.getState().show('Tráiler no disponible', 'info', 3000);
    }
  }, [content, navigate]);

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
      <div className="w-full h-dvh bg-bg flex flex-col items-center justify-center gap-[clamp(1rem,2.5vh,1.5rem)]">
        <div className="w-[clamp(3rem,6vh,4rem)] h-[clamp(3rem,6vh,4rem)] rounded-full bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
          <span className="text-white/30 text-[clamp(1.25rem,2vh,1.5rem)] font-bold">!</span>
        </div>
        <p className="text-white/50 text-[clamp(1rem,1.6vw,1.25rem)]">Contenido no encontrado</p>
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
          onPlayTrailer={handlePlayTrailer}
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

        {/* Content sections — generous rhythm instead of hairline dividers */}
        <div className="px-[clamp(2rem,5vw,6rem)] pb-[clamp(5rem,12vh,7.5rem)] flex flex-col gap-[clamp(2.5rem,6vh,4.5rem)]">
          {/* Overview */}
          <DetailOverview
            description={content.description}
            className="pt-[clamp(1.5rem,3vh,2.5rem)]"
          />

          {/* Seasons & Episodes */}
          {seasons.length > 0 && (
            <section>
              <SectionHeading title="Episodios" />

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
              <SectionHeading title="También te puede gustar" />
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