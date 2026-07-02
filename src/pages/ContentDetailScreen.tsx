import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { getContentById } from '@/features/content/api';
import { resolveImageUrl } from '@/utils/helpers';
import { FocusableButton } from '@/components/tv/FocusableButton';
import { Focusable } from '@/components/tv/Focusable';
import { FocusableCard } from '@/components/tv/FocusableCard';
import { FocusableRow } from '@/components/tv/FocusableRow';
import type { ContentDetail, Season } from '@/types/content';
import "@m3e/web/loading-indicator";
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
        const topSafeArea = 96;
        const bottomSafeArea = 48;

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

  const handlePlay = useCallback(() => {
    if (!content) return;
    const episodeId = content.continue_watching?.episode_id;
    if (episodeId) {
      navigate(`/watch/${content.id}/${episodeId}`);
    } else {
      navigate(`/watch/${content.id}`);
    }
  }, [content, navigate]);

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
        <M3eLoadingIndicator style={{"--m3e-loading-indicator-active-indicator-color": "#ddd"} as any} />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="w-full h-dvh bg-bg flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary text-xl">Contenido no encontrado</p>
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
      <div className="relative w-full h-[50vh] min-h-[400px]">
        {backdropUrl ? (
          <img src={backdropUrl} alt={content.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/30 to-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
      </div>

      <div className="px-24 -mt-32 relative z-10 pb-16">
        <h1 className="text-4xl font-extrabold text-white mb-4">{content.title}</h1>

        <div className="flex items-center gap-4 text-text-secondary text-lg mb-6">
          {content.year && <span>{content.year}</span>}
          {content.liked && (
            <span className="text-accent-light">&hearts;</span>
          )}
          {content.content_type && (
            <span className="px-2 py-0.5 border border-text-secondary rounded text-sm">
              {content.content_type === 'TVSHOW' ? 'Serie' : 'Película'}
            </span>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 mb-6">
            {categories.map((cat) => (
              <span key={cat.id} className="px-3 py-1 bg-surface rounded-full text-sm text-text-secondary">
                {cat.name}
              </span>
            ))}
          </div>
        )}

        {content.description && (
          <p className="text-lg text-text-secondary max-w-3xl mb-8 leading-relaxed">
            {content.description}
          </p>
        )}

        <div className="flex gap-4 mb-12">
          <FocusableButton
            focusKey="detail-play"
            onEnterPress={handlePlay}
            onArrowPress={handlePlayArrow}
            autoFocus
            variant="primary"
            size="lg"
          >
            Reproducir
          </FocusableButton>
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
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-white mb-6 px-0">Temporadas</h2>
            <div className="flex gap-3 mb-6">
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
                  className={`px-5 py-2.5 rounded-full text-lg font-medium transition-colors ${selectedSeason === i
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
                className="-mx-24"
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
                      title={episode.position ? `${episode.position}. ${episode.title}` : episode.title}
                      image={epThumb}
                      subtitle={episode.description}
                      progress={progress}
                      onArrowPress={(direction) => {
                        if (direction === 'up') return focusContentTarget(selectedSeasonFocusKey ?? 'detail-play');
                        if (direction === 'left' && episodeIdx === 0) return focusSidebarFromLeftEdge(direction);
                        return true;
                      }}
                      onEnterPress={() => handlePlayEpisode(episode.id)}
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
