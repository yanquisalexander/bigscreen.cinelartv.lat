import { memo, useCallback } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';
import type { Season } from '@/types/content';

interface DetailSeasonSelectorProps {
  seasons: Season[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  focusKey?: string;
  onArrowUp?: (direction: string) => boolean;
  onArrowDown?: (direction: string) => boolean;
  firstEpisodeFocusKey?: string;
}

export const DetailSeasonSelector = memo(function DetailSeasonSelector({
  seasons,
  selectedIndex,
  onSelect,
  focusKey = 'detail-seasons',
  onArrowUp,
  onArrowDown,
}: DetailSeasonSelectorProps) {
  const { ref, focusKey: resolvedKey } = useFocusable({
    focusKey,
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: seasons[selectedIndex]?.id
      ? `detail-season-${seasons[selectedIndex].id}`
      : undefined,
  });

  const handleDown = useCallback(
    (direction: string) => {
      if (direction !== 'down') return true;
      if (onArrowDown) return onArrowDown(direction);
      return true;
    },
    [onArrowDown],
  );

  return (
    <FocusContext.Provider value={resolvedKey}>
      <div ref={ref as React.RefObject<HTMLDivElement>}>
        <div className="flex items-center gap-[clamp(0.5rem,1vw,0.75rem)]">
          {seasons.map((season, i) => (
            <SeasonTab
              key={season.id}
              season={season}
              index={i}
              isSelected={selectedIndex === i}
              onSelect={() => onSelect(i)}
              onArrowUp={onArrowUp}
              onArrowDown={handleDown}
            />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  );
});

interface SeasonTabProps {
  season: Season;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onArrowUp?: (direction: string) => boolean;
  onArrowDown?: (direction: string) => boolean;
}

const SeasonTab = memo(function SeasonTab({
  season,
  isSelected,
  onSelect,
  onArrowUp,
  onArrowDown,
}: SeasonTabProps) {
  const handleArrow = useCallback(
    (direction: string) => {
      if (direction === 'up' && onArrowUp) return onArrowUp(direction);
      if (direction === 'down' && onArrowDown) return onArrowDown(direction);
      return true;
    },
    [onArrowUp, onArrowDown],
  );

  const { ref, focused } = useFocusable({
    focusKey: `detail-season-${season.id}`,
    onEnterPress: onSelect,
    onArrowPress: handleArrow,
  });

  return (
    <div
      ref={ref}
      data-focused={focused}
        className={classNames(
        'tv-no-select cursor-pointer border-2 border-transparent',
        'px-[clamp(1.25rem,2.5vw,1.75rem)] py-[clamp(0.5rem,1.2vh,0.75rem)]',
        'rounded-full font-medium',
        'transition-all duration-200 ease-out',
        'text-[clamp(0.875rem,1.3vw,1.0625rem)]',
        isSelected
          ? 'bg-white text-black font-semibold'
          : 'bg-white/10 text-text-secondary',
        focused && '!border-white scale-110 shadow-lg shadow-white/10',
      )}
    >
      {season.title}
    </div>
  );
});
