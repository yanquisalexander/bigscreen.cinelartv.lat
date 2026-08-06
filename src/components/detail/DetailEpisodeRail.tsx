import { memo, useCallback, useRef, useEffect } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { LucideLock, LucidePlay } from 'lucide-react';
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
              seasonIndex={seasonIndex}
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
    <div className="relative">
      {/* Edge fade hints — signals more content off-screen */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[clamp(1.5rem,4vw,3rem)] bg-gradient-to-r from-bg to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[clamp(1.5rem,4vw,3rem)] bg-gradient-to-l from-bg to-transparent z-10" />

      <div
        ref={scrollRef}
        className="flex gap-[clamp(1rem,1.8vw,1.5rem)] overflow-x-auto hide-scrollbar py-[clamp(0.875rem,1.6vh,1.25rem)]"
      >
        {children}
      </div>
    </div>
  );
}

interface EpisodeCardProps {
  episode: Episode;
  index: number;
  seasonIndex: number;
  onPlay: () => void;
  onFocus: () => void;
  onArrowUp?: (direction: string) => boolean;
  onArrowLeft?: (direction: string) => boolean;
}

const EpisodeCard = memo(function EpisodeCard({
  episode,
  index,
  seasonIndex,
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

  const episodeNum = episode.position ?? index + 1;

  return (
    <div
      ref={ref}
      data-focused={focused}
      className={classNames(
        'tv-no-select relative shrink-0 cursor-pointer rounded-2xl',
        'w-[clamp(17rem,23vw,21rem)]',
        'transition-all duration-300 ease-out will-change-transform',
        focused ? 'scale-[1.045] z-10' : '',
      )}
    >
      {/* Focus glow border */}
      <div
        className={classNames(
          'pointer-events-none absolute -inset-[2px] rounded-2xl transition-opacity duration-300',
          focused ? 'opacity-100 bg-gradient-to-br from-accent to-accent/25' : 'opacity-0',
        )}
      />

      <div
        className={classNames(
          'relative rounded-2xl overflow-hidden bg-surface ring-1',
          focused ? 'ring-transparent shadow-[0_20px_45px_-10px_rgba(0,0,0,0.65)]' : 'ring-white/[0.07]',
        )}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video overflow-hidden">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={episode.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-surface-elevated" />
          )}

          {/* Ghost episode numeral */}
          <span className="absolute -bottom-[0.3em] -left-[0.04em] text-white/10 font-black leading-none text-[clamp(3.25rem,5.5vw,4.75rem)] select-none pointer-events-none">
            {String(episodeNum).padStart(2, '0')}
          </span>

          {/* Bottom gradient for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />

          {/* Premium lock badge */}
          {episode.premium && (
            <div className="absolute top-[clamp(0.5rem,1vh,0.75rem)] right-[clamp(0.5rem,1vw,0.75rem)] w-[clamp(1.5rem,2.5vh,1.875rem)] h-[clamp(1.5rem,2.5vh,1.875rem)] rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <LucideLock size={12} className="text-amber-400" />
            </div>
          )}

          {/* Episode label bottom-left */}
          <span className="absolute bottom-[clamp(0.625rem,1.2vh,0.875rem)] left-[clamp(0.625rem,1.2vw,0.875rem)] text-white text-[clamp(0.8125rem,1.05vw,0.9375rem)] font-bold tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
            T{seasonIndex + 1} · E{episodeNum}
          </span>

          {/* Play icon on focus */}
          {focused && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[clamp(2.75rem,5.5vh,3.75rem)] h-[clamp(2.75rem,5.5vh,3.75rem)] rounded-full bg-white flex items-center justify-center shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
                <LucidePlay size={20} className="text-black ml-0.5" fill="currentColor" />
              </div>
            </div>
          )}

          {/* Progress bar */}
          {progress != null && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-[clamp(0.75rem,1.3vh,1rem)] pt-[clamp(0.75rem,1.3vh,1rem)] pb-[clamp(0.875rem,1.5vh,1.125rem)]">
          <p
            className={classNames(
              'font-semibold truncate',
              'text-[clamp(0.9375rem,1.25vw,1.0625rem)]',
              focused ? 'text-white' : 'text-white/85',
            )}
          >
            {episode.title}
          </p>
          {episode.description && (
            <p className="text-[clamp(0.75rem,1vw,0.875rem)] text-white/40 mt-[clamp(0.25rem,0.4vh,0.375rem)] line-clamp-2 leading-relaxed">
              {episode.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});