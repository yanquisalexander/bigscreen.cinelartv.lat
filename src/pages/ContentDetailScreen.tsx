import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getContentById, prefetchWatchData } from '@/features/content/api';
import { resolveImageUrl } from '@/utils/helpers';
import { FocusableButton } from '@/components/tv/FocusableButton';
import { Focusable } from '@/components/tv/Focusable';
import { FocusableCard } from '@/components/tv/FocusableCard';
import { FocusableRow } from '@/components/tv/FocusableRow';
import type { ContentDetail, Season } from '@/types/content';
import { M3eLoadingIndicator } from "@m3e/react/loading-indicator";

// Teclas/códigos de "atrás" según plataforma (teclado, webOS, Tizen)
const BACK_KEYS = new Set(['Escape', 'Backspace', 'GoBack', 'BrowserBack']);
const BACK_KEYCODES = new Set([8, 27, 461, 10009]);

export function ContentDetailScreen() {
  useSpatialNavInit();
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seasons = content?.seasons ?? [];
  const categories = content?.categories ?? [];
  const currentEpisodes = seasons[selectedSeason]?.episodes ?? [];
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
    preferredChildFocusKey: 'detail-play',
  });

  useEffect(() => {
    if (!tokens || !contentId) return;
    setLoading(true);
    getContentById(tokens.accessToken, contentId)
      .then(setContent)
      .finally(() => setLoading(false));
  }, [tokens, contentId]);

  // Botón físico "Atrás" del control / Escape en teclado
  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (BACK_KEYS.has(e.key) || BACK_KEYCODES.has(e.keyCode)) {
        e.preventDefault();
        navigate(-1);
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [navigate]);

  // Cleanup pending prefetch timer on unmount
  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    };
  }, []);

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

  const canPlay = useMemo(() => {
    if (!content) return false;
    if (content.content_type !== 'TVSHOW') return true;
    if (content.continue_watching?.episode_id) return true;
    return (content.seasons?.[0]?.episodes?.length ?? 0) > 0;
  }, [content]);

  const handlePlay = useCallback(() => {
    if (!content || !canPlay) return;

    const episodeId = content.continue_watching?.episode_id;
    if (episodeId) {
      navigate(`/watch/${content.id}/${episodeId}`);
      return;
    }

    if (content.content_type !== 'TVSHOW') {
      navigate(`/watch/${content.id}`);
      return;
    }

    const firstSeason = content.seasons?.[0];
    const firstEpisode = firstSeason?.episodes?.[0];
    if (firstEpisode) {
      navigate(`/watch/${content.id}/${firstEpisode.id}`);
    }
  }, [content, navigate, canPlay]);

  const handlePlayEpisodeFocus = useCallback(
    (episodeId: string | number) => {
      if (!tokens || !contentId) return;
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = setTimeout(() => {
        prefetchTimerRef.current = null;
        prefetchWatchData(tokens.accessToken, contentId, episodeId);
      }, 4000);
    },
    [tokens, contentId],
  );

  const handlePlayEpisode = useCallback(
    (episodeId: string | number) => {
      navigate(`/watch/${contentId}/${episodeId}`);
    },
    [contentId, navigate],
  );

  const focusSidebarFromLeftEdge = useCallback((direction: string) => {
    if (direction !== 'left') return true;
    setFocus('nav-home');
    return false;
  }, []);

  const focusContentTarget = useCallback((focusKey?: string) => {
    if (!focusKey) return true;
    setFocus(focusKey);
    return false;
  }, []);

  // Debounced prefetch for Play button (4s hold)
  const handlePlayFocus = useCallback(() => {
    if (!content || !tokens) return;
    const episodeId = content.continue_watching?.episode_id
      ?? (content.content_type === 'TVSHOW'
        ? content.seasons?.[0]?.episodes?.[0]?.id
        : undefined);
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = setTimeout(() => {
      prefetchTimerRef.current = null;
      prefetchWatchData(tokens.accessToken, content.id, episodeId);
    }, 4000);
  }, [content, tokens]);

  const handlePlayArrow = useCallback((direction: string) => {
    if (direction === 'left') return focusSidebarFromLeftEdge(direction);
    if (direction === 'up') return false;
    if (direction === 'down') return focusContentTarget(selectedSeasonFocusKey ?? firstEpisodeFocusKey);
    return true;
  }, [firstEpisodeFocusKey, focusContentTarget, focusSidebarFromLeftEdge, selectedSeasonFocusKey]);

  const handleListArrow = useCallback((direction: string) => {
    if (direction === 'up') return false;
    if (direction === 'down') return focusContentTarget(selectedSeasonFocusKey ?? firstEpisodeFocusKey);
    return true;
  }, [firstEpisodeFocusKey, focusContentTarget, selectedSeasonFocusKey]);

  if (loading) {
    return (
      <div className="w-full h-dvh bg-bg flex items-center justify-center">
        <M3eLoadingIndicator style={{ "--m3e-loading-indicator-active-indicator-color": "#ddd" } as any} />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="w-full h-dvh bg-bg flex flex-col items-center justify-center gap-[clamp(0.75rem,2vh,1rem)]">
        <p className="text-text-secondary text-[clamp(1rem,1.6vw,1.25rem)]">Contenido no encontrado</p>
        <FocusableButton onEnterPress={() => navigate('/home')} autoFocus>
          Volver al inicio
        </FocusableButton>
      </div>
    );
  }

  const backdropUrl = resolveImageUrl(content.banner ?? content.cover, clientEndpoint);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={(node) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          (focusRootRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className="w-full h-dvh overflow-y-auto hide-scrollbar bg-bg"
      >
        <div className="relative w-full h-[clamp(320px,50vh,520px)]">
          {backdropUrl ? (
            <img src={backdropUrl} alt={content.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/30 to-bg" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
        </div>

        <div className="px-[clamp(3rem,7.5vw,6rem)] -mt-[clamp(5rem,16vh,8rem)] relative z-10 pb-[clamp(3rem,8vh,4rem)]">
          <h1 className="text-[clamp(2rem,3.2vw,2.5rem)] font-extrabold text-white mb-[clamp(0.75rem,2vh,1rem)]">{content.title}</h1>

          <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] text-text-secondary text-[clamp(1rem,1.45vw,1.125rem)] mb-[clamp(1rem,3vh,1.5rem)]">
            {content.year && <span>{content.year}</span>}
            {content.liked && (
              <span className="text-accent-light">&hearts;</span>
            )}
            {content.content_type && (
              <span className="px-[clamp(0.375rem,0.8vw,0.5rem)] py-0.5 border border-text-secondary rounded text-[clamp(0.75rem,1.1vw,0.875rem)]">
                {content.content_type === 'TVSHOW' ? 'Serie' : 'Película'}
              </span>
            )}
          </div>

          {categories.length > 0 && (
            <div className="flex gap-[clamp(0.375rem,0.8vw,0.5rem)] mb-[clamp(1rem,3vh,1.5rem)]">
              {categories.map((cat) => (
                <span key={cat.id} className="px-[clamp(0.625rem,1.2vw,0.75rem)] py-[clamp(0.1875rem,0.7vh,0.25rem)] bg-surface rounded-full text-[clamp(0.75rem,1.1vw,0.875rem)] text-text-secondary">
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          {content.description && (
            <p className="text-[clamp(1rem,1.45vw,1.125rem)] text-text-secondary max-w-3xl mb-[clamp(1.5rem,4vh,2rem)] leading-relaxed">
              {content.description}
            </p>
          )}

          <div className="flex gap-[clamp(0.75rem,1.5vw,1rem)] mb-[clamp(2rem,6vh,3rem)]">
            {canPlay && (
              <FocusableButton
                focusKey="detail-play"
                onEnterPress={handlePlay}
                onFocus={handlePlayFocus}
                onArrowPress={handlePlayArrow}
                autoFocus
                variant="primary"
                size="lg"
              >
                {content.content_type === 'TVSHOW' && content.continue_watching ? 'Continuar viendo' : 'Reproducir'}
              </FocusableButton>
            )}
            <FocusableButton
              focusKey="detail-list"
              onEnterPress={() => { }}
              onArrowPress={handleListArrow}
              variant="secondary"
              size="lg"
            >
              + Mi Lista
            </FocusableButton>
          </div>

          {seasons.length > 0 && (
            <div className="mt-[clamp(1.5rem,4vh,2rem)]">
              <h2 className="text-[clamp(1.25rem,2vw,1.5rem)] font-bold text-white mb-[clamp(1rem,3vh,1.5rem)] px-0">Temporadas</h2>
              <div className="flex gap-[clamp(0.5rem,1vw,0.75rem)] mb-[clamp(1rem,3vh,1.5rem)]">
                {seasons.map((season: Season, i: number) => (
                  <Focusable
                    key={season.id}
                    focusKey={`detail-season-${season.id}`}
                    onEnterPress={() => setSelectedSeason(i)}
                    onArrowPress={(direction) => {
                      if (direction === 'up') return focusContentTarget('detail-play');
                      if (direction === 'down') return focusContentTarget(firstEpisodeFocusKey);
                      if (direction === 'left' && i === 0) return focusSidebarFromLeftEdge(direction);
                      return true;
                    }}
                    className={`px-[clamp(1rem,2vw,1.25rem)] py-[clamp(0.5rem,1.2vh,0.625rem)] rounded-full text-[clamp(0.9375rem,1.35vw,1.125rem)] font-medium transition-colors ${selectedSeason === i
                      ? 'bg-white text-black'
                      : 'bg-surface text-text-secondary'
                      }`}
                  >
                    {season.title}
                  </Focusable>
                ))}
              </div>

              {currentEpisodes.length > 0 && (
                <FocusableRow
                  key={selectedSeason}
                  title="Episodios"
                  className="-mx-[clamp(3rem,7.5vw,6rem)]"
                  focusKey={`episodes-season-${selectedSeason}`}
                  preferredChildFocusKey={firstEpisodeFocusKey}
                >
                  {currentEpisodes.map((episode, episodeIdx) => {
                    const epThumb = resolveImageUrl(
                      episode.thumbnail ?? episode.thumbnail_resized,
                      clientEndpoint,
                    );
                    const progress = episode.continue_watching
                      ? Math.round(
                        (episode.continue_watching.progress / episode.continue_watching.duration) * 100,
                      )
                      : undefined;

                    return (
                      <FocusableCard
                        key={episode.id}
                        focusKey={`detail-episode-${episode.id}`}
                        title={`${episodeIdx + 1}. ${episode.title}`}
                        image={epThumb}
                        subtitle={episode.description}
                        progress={progress}
                        onArrowPress={(direction) => {
                          if (direction === 'up') return focusContentTarget(selectedSeasonFocusKey ?? 'detail-play');
                          if (direction === 'left' && episodeIdx === 0) return focusSidebarFromLeftEdge(direction);
                          return true;
                        }}
                        onEnterPress={() => handlePlayEpisode(episode.id)}
                        onFocus={() => handlePlayEpisodeFocus(episode.id)}
                      />
                    );
                  })}
                </FocusableRow>
              )}
            </div>
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
}
