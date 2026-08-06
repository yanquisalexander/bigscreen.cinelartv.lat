import { memo, useCallback, useRef, useEffect } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { classNames, resolveEpisodeThumbnail } from '@/utils/helpers';
import { useConfigStore } from '@/stores/configStore';
import type { Episode } from '@/types/content';

interface DetailEpisodeRailProps {
  episodes: Episode[];
  seasonIndex: number;
  focusKey?: string;
  preferredChildFocusKey?: string;
  onPlayEpisode: (episodeId: string | number) => void;
  onFocusEpisode?: (episodeId: string | number) => void;
  onArrowUp?: (direction: string) => boolean;
  onArrowLeft?: (direction: string) => boolean;
}

export const DetailEpisodeRail = memo(function DetailEpisodeRail({
  episodes,
  seasonIndex,
  focusKey = 'detail-episodes',
  preferredChildFocusKey,
  onPlayEpisode,
  onFocusEpisode,
  onArrowUp,
  onArrowLeft,
}: DetailEpisodeRailProps) {
  const { ref, focusKey: resolvedKey } = useFocusable({
    focusKey: `${focusKey}-${seasonIndex}`,
    // focusable: false, // Probando sin esto
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey,
  });

  return (
    <FocusContext.Provider value={resolvedKey}>
      <div ref={ref as React.RefObject<HTMLDivElement>}>
        <EpisodeScrollContainer>
          {episodes.map((episode, idx) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              index={idx}
              onPlay={() => onPlayEpisode(episode.id)}
              onFocus={() => onFocusEpisode?.(episode.id)}
              onArrowUp={onArrowUp}
              onArrowLeft={onArrowLeft}
            />
          ))}
        </EpisodeScrollContainer>
      </div>
    </FocusContext.Provider>
  );
});

function EpisodeScrollContainer({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const focused = el.querySelector<HTMLElement>('[data-focused="true"]');
        if (!focused) return;

        const containerWidth = el.clientWidth;
        const cardWidth = focused.clientWidth;
        const cardLeft = focused.offsetLeft;
        const scrollLeft = cardLeft - (containerWidth / 2) + (cardWidth / 2);

        el.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      });
    };

    const observer = new MutationObserver(handleScroll);
    observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex gap-[clamp(0.75rem,1.5vw,1.25rem)] overflow-x-auto hide-scrollbar py-[clamp(0.5rem,1vh,0.75rem)]"
    >
      {children}
    </div>
  );
}

interface EpisodeCardProps {
  episode: Episode;
  index: number;
  onPlay: () => void;
  onFocus: () => void;
  onArrowUp?: (direction: string) => boolean;
  onArrowLeft?: (direction: string) => boolean;
}

const EpisodeCard = memo(function EpisodeCard({
  episode,
  index,
  onPlay,
  onFocus,
  onArrowUp,
  onArrowLeft,
}: EpisodeCardProps) {
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const thumbUrl = resolveEpisodeThumbnail(episode.images, episode.thumbnail_resized ?? episode.thumbnail, clientEndpoint);

  const progress = episode.continue_watching
    ? Math.round(
        (episode.continue_watching.progress / episode.continue_watching.duration) * 100,
      )
    : undefined;

  const handleArrow = useCallback(
    (direction: string) => {
      if (direction === 'up' && onArrowUp) return onArrowUp(direction);
      // Solo llamar a onArrowLeft si es el primer elemento (índice 0)
      if (direction === 'left' && index === 0 && onArrowLeft) return onArrowLeft(direction);
      return true;
    },
    [onArrowUp, onArrowLeft, index],
  );

  const { ref, focused } = useFocusable({
    focusKey: `detail-episode-${episode.id}`,
    onEnterPress: onPlay,
    onFocus,
    onArrowPress: handleArrow,
  });

  return (
    <div
      ref={ref}
      data-focused={focused}
      className={classNames(
        'tv-no-select shrink-0 cursor-pointer',
        'w-[clamp(14rem,20vw,18rem)]',
        'rounded-xl overflow-hidden',
        'transition-all duration-300 ease-out',
        'will-change-transform',
        focused
          ? 'scale-105 ring-2 ring-white shadow-2xl shadow-black/60 z-10'
          : 'scale-100 opacity-80',
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={episode.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
            <span className="text-text-tertiary text-3xl font-bold">{index + 1}</span>
          </div>
        )}

        {/* Episode number overlay */}
        <div className="absolute top-[clamp(0.375rem,0.8vh,0.5rem)] left-[clamp(0.375rem,0.8vw,0.5rem)] bg-black/70 rounded px-[clamp(0.375rem,0.6vw,0.5rem)] py-[clamp(0.125rem,0.3vh,0.1875rem)]">
          <span className="text-[clamp(0.6875rem,0.9vw,0.8125rem)] font-semibold text-white">
            {index + 1}
          </span>
        </div>

        {/* Play icon on focus */}
        {focused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-[clamp(2.5rem,5vh,3.5rem)] h-[clamp(2.5rem,5vh,3.5rem)] rounded-full bg-white/90 flex items-center justify-center">
              <span className="text-black text-[clamp(1rem,2vh,1.5rem)] ml-0.5">▶</span>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {progress != null && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
            <div
              className="h-full bg-white"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-[clamp(0.5rem,1vh,0.75rem)] bg-surface">
        <p
          className={classNames(
            'font-semibold truncate',
            'text-[clamp(0.8125rem,1.1vw,0.9375rem)]',
            focused ? 'text-white' : 'text-text-primary',
          )}
        >
          {episode.title}
        </p>
        {episode.description && (
          <p className="text-[clamp(0.6875rem,0.9vw,0.8125rem)] text-text-secondary mt-[clamp(0.125rem,0.3vh,0.25rem)] line-clamp-2">
            {episode.description}
          </p>
        )}
      </div>
    </div>
  );
});
