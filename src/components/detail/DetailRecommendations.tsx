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

  const isPremium = !!(item as any).premium;

  return (
    <div
      ref={ref}
      data-focused={focused}
      className={classNames(
        'tv-no-select shrink-0 cursor-pointer',
        'w-[clamp(10rem,14vw,13rem)]',
        'rounded-xl overflow-hidden',
        'transition-all duration-200 ease-out',
        focused
          ? 'ring-2 ring-white/90 z-10'
          : '',
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
            <span className="text-white/15 text-2xl font-bold">
              {item.title.charAt(0)}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />

        {/* Premium badge */}
        {isPremium && (
          <div className="absolute top-[clamp(0.375rem,0.8vh,0.5rem)] right-[clamp(0.375rem,0.8vw,0.5rem)]">
            <span className="bg-amber-500/90 text-black text-[clamp(0.5rem,0.7vw,0.625rem)] font-bold px-[clamp(0.25rem,0.5vw,0.375rem)] py-[clamp(0.0625rem,0.15vh,0.125rem)] rounded">
              PREMIUM
            </span>
          </div>
        )}

        {/* Info */}
        <div className="absolute bottom-0 left-0 right-0 p-[clamp(0.625rem,1.2vh,0.875rem)]">
          <p className="text-white text-[clamp(0.8125rem,1.1vw,0.9375rem)] font-semibold truncate leading-tight">
            {item.title}
          </p>
          <div className="flex items-center gap-[clamp(0.25rem,0.5vw,0.375rem)] mt-[clamp(0.1875rem,0.4vh,0.3125rem)]">
            {item.year && (
              <span className="text-white/50 text-[clamp(0.625rem,0.85vw,0.75rem)]">
                {item.year}
              </span>
            )}
            {(item.content_type || item.contentType) && (
              <>
                {item.year && <span className="text-white/25 text-[clamp(0.5rem,0.7vw,0.625rem)]">·</span>}
                <span className="text-white/50 text-[clamp(0.625rem,0.85vw,0.75rem)]">
                  {isTVShow(item) ? 'Serie' : 'Película'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
