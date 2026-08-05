import { memo, useRef, useEffect } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { classNames, resolvePoster } from '@/utils/helpers';
import { useConfigStore } from '@/stores/configStore';
import type { ContentItem } from '@/types/content';
import { isTVShow } from '@/types/content';

interface DetailRecommendationsProps {
  items: ContentItem[];
  onSelect: (item: ContentItem) => void;
  focusKey?: string;
  onArrowUp?: (direction: string) => boolean;
}

export const DetailRecommendations = memo(function DetailRecommendations({
  items,
  onSelect,
  focusKey = 'detail-related',
  onArrowUp,
}: DetailRecommendationsProps) {
  const { ref, focusKey: resolvedKey } = useFocusable({
    focusKey,
    // focusable: false, // Probando sin esto
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  if (items.length === 0) return null;

  return (
    <FocusContext.Provider value={resolvedKey}>
      <div ref={ref as React.RefObject<HTMLDivElement>}>
        <RecommendationsScroll>
          {items.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              onSelect={() => onSelect(item)}
              onArrowUp={onArrowUp}
            />
          ))}
        </RecommendationsScroll>
      </div>
    </FocusContext.Provider>
  );
});

function RecommendationsScroll({ children }: { children: React.ReactNode }) {
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

interface RecommendationCardProps {
  item: ContentItem;
  onSelect: () => void;
  onArrowUp?: (direction: string) => boolean;
}

const RecommendationCard = memo(function RecommendationCard({
  item,
  onSelect,
  onArrowUp,
}: RecommendationCardProps) {
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const coverUrl = resolvePoster(item.images, item.cover_resized ?? item.cover, clientEndpoint);

  const { ref, focused } = useFocusable({
    focusKey: `detail-related-${item.id}`,
    onEnterPress: onSelect,
    onArrowPress: (direction) => {
      if (direction === 'up' && onArrowUp) return onArrowUp(direction);
      return true;
    },
  });

  return (
    <div
      ref={ref}
      data-focused={focused}
      className={classNames(
        'tv-no-select shrink-0 cursor-pointer',
        'w-[clamp(10rem,14vw,13rem)]',
        'rounded-xl overflow-hidden',
        'transition-all duration-300 ease-out',
        'will-change-transform',
        focused
          ? 'scale-105 ring-2 ring-white shadow-2xl shadow-black/60 z-10'
          : 'scale-100 opacity-80',
      )}
    >
      <div className="relative aspect-[2/3] bg-surface overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-elevated">
            <span className="text-text-secondary text-xl font-bold">
              {item.title.charAt(0)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-[clamp(0.5rem,1vh,0.75rem)]">
          <p className="text-white text-[clamp(0.75rem,1vw,0.875rem)] font-semibold truncate">
            {item.title}
          </p>
          <div className="flex items-center gap-2 mt-[clamp(0.125rem,0.3vh,0.25rem)]">
            {item.year && (
              <span className="text-text-secondary text-[clamp(0.625rem,0.8vw,0.75rem)]">
                {item.year}
              </span>
            )}
            {(item.content_type || item.contentType) && (
              <span className="text-text-secondary text-[clamp(0.625rem,0.8vw,0.75rem)]">
                {isTVShow(item) ? 'Serie' : 'Película'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
