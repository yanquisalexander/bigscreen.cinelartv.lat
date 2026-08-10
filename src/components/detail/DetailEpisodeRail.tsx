import { memo, useCallback, useRef, useEffect } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { LucideLock } from 'lucide-react';
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
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[clamp(1.5rem,4vw,3rem)] bg-gradient-to-r from-bg to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[clamp(1.5rem,4vw,3rem)] bg-gradient-to-l from-bg to-transparent z-10" />

      <div
        ref={scrollRef}
        className="flex gap-[clamp(0.75rem,1.2vw,1.125rem)] overflow-x-auto hide-scrollbar py-[clamp(0.5rem,1vh,0.875rem)]"
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

// Prime-style card: thumbnail-only, no title/description on the card itself.
// The episode label + lock sit as a single overlay line, bottom-left.
// Focus is communicated with a clean rectangular ring, not a glow.
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
        'tv-no-select relative shrink-0 cursor-pointer rounded-xl overflow-hidden',
        'w-[clamp(13rem,14vw,18rem)] aspect-video bg-surface',
        'transition-all duration-200 ease-out will-change-transform',
        'ring-2',
        focused ? 'ring-white scale-[1.03]' : 'ring-transparent',
      )}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={episode.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-surface-elevated" />
      )}

      {/* Bottom gradient for label legibility */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      {/* Episode label + lock, single overlay line */}
      <div className="absolute bottom-[clamp(0.5rem,1vh,0.75rem)] left-[clamp(0.625rem,1.2vw,0.875rem)] flex items-center gap-[0.375em]">
        {episode.premium && <LucideLock size={13} className="text-amber-400 shrink-0" />}
        <span className="text-white text-[clamp(0.8125rem,1.05vw,0.9375rem)] font-bold tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
          T{seasonIndex + 1} E{episodeNum}
        </span>
      </div>

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
  );
});