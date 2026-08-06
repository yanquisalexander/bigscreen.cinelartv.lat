import { memo, useMemo } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { formatTime, classNames, resolveBackdrop, resolveLogo } from '@/utils/helpers';
import { DetailActionButton } from './DetailActionButton';
import { DetailMetadataBadge } from './DetailMetadataBadge';
import type { ContentDetail } from '@/types/content';
import { isTVShow } from '@/types/content';

interface DetailHeroProps {
  content: ContentDetail;
  clientEndpoint?: string;
  canPlay: boolean;
  onPlay: () => void;
  onToggleList: () => void;
  onNavigateDown: (direction: string) => boolean;
  onNavigateLeft: (direction: string) => boolean;
  onNavigateUp: (direction: string) => boolean;
  onPlayFocus: () => void;
  onHeroFocus: () => void; // Nueva prop
  firstEpisodeFocusKey?: string;
  firstSeasonFocusKey?: string;
}

function formatDuration(content: ContentDetail): string | null {
  if (content.duration) return formatTime(content.duration);
  if (content.seasons_count && content.episodes_count) {
    const s = content.seasons_count === 1 ? 'temporada' : 'temporadas';
    const e = content.episodes_count === 1 ? 'episodio' : 'episodios';
    return `${content.seasons_count} ${s} · ${content.episodes_count} ${e}`;
  }
  return null;
}

export const DetailHero = memo(function DetailHero({
  content,
  clientEndpoint,
  canPlay,
  onPlay,
  onToggleList,
  onNavigateDown,
  onNavigateLeft,
  onNavigateUp,
  onPlayFocus,
  firstEpisodeFocusKey,
  firstSeasonFocusKey,
  onHeroFocus,
}: DetailHeroProps) {
  const backdropUrl = resolveBackdrop(content.images, content.banner_resized ?? content.banner ?? content.cover_resized ?? content.cover, clientEndpoint);
  const logoUrl = resolveLogo(content.images, clientEndpoint);

  const { ref: heroRef, focusKey: heroFocusKey } = useFocusable({
    focusKey: 'detail-hero',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'detail-hero-play',
  });

  const duration = useMemo(() => formatDuration(content), [content]);

  const continuePercent = useMemo(() => {
    if (!content.continue_watching) return null;
    const { progress, duration: d } = content.continue_watching;
    if (!d) return null;
    return Math.min(100, Math.round((progress / d) * 100));
  }, [content.continue_watching]);

  return (
    <div className="relative w-full h-[85vh] min-h-[600px]">
      {/* Backdrop */}
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt={content.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/40 to-bg" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/60 via-transparent to-transparent" />

      {/* Content */}
      <div
        ref={heroRef as React.RefObject<HTMLDivElement>}
        className="absolute inset-0 flex flex-col justify-end
          px-[clamp(3rem,7.5vw,6rem)]
          pb-[clamp(4rem,10vh,6rem)]"
      >
        <FocusContext.Provider value={heroFocusKey}>
          {/* Title */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={content.title}
              className="h-[clamp(3rem,7vh,5rem)] max-w-[70%] object-contain mb-[clamp(0.5rem,1.5vh,1rem)] drop-shadow-lg"
            />
          ) : (
            <h1
              className={classNames(
                'font-extrabold text-white leading-tight',
                'text-[clamp(2.5rem,5vw,4rem)]',
                'mb-[clamp(0.5rem,1.5vh,1rem)]',
                'max-w-[70%]',
              )}
            >
              {content.title}
            </h1>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-[clamp(0.5rem,1vw,0.75rem)] mb-[clamp(0.75rem,2vh,1.25rem)] flex-wrap">
            {content.year && (
              <DetailMetadataBadge>{content.year}</DetailMetadataBadge>
            )}
            {duration && (
              <DetailMetadataBadge>{duration}</DetailMetadataBadge>
            )}
            {(content.content_type || content.contentType) && (
              <DetailMetadataBadge accent>
                {isTVShow(content) ? 'Serie' : 'Película'}
              </DetailMetadataBadge>
            )}
            {content.premium && (
              <DetailMetadataBadge accent>Premium</DetailMetadataBadge>
            )}
            {content.liked && (
              <DetailMetadataBadge>❤</DetailMetadataBadge>
            )}
          </div>

          {/* Categories */}
          {content.categories && content.categories.length > 0 && (
            <div className="flex gap-[clamp(0.375rem,0.8vw,0.5rem)] mb-[clamp(0.75rem,2vh,1.25rem)]">
              {content.categories.map((cat) => (
                <span
                  key={cat.id}
                  className="px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.125rem,0.4vh,0.25rem)] bg-white/8 rounded-full text-[clamp(0.75rem,1.1vw,0.875rem)] text-text-secondary"
                >
                  {cat.name}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {content.description && (
            <p
              className={classNames(
                'text-[clamp(0.9375rem,1.35vw,1.125rem)] text-text-secondary',
                'max-w-[clamp(40rem,50vw,60rem)] leading-relaxed',
                'mb-[clamp(1.5rem,4vh,2.5rem)]',
                'line-clamp-3',
              )}
            >
              {content.description}
            </p>
          )}

          {/* Continue watching progress */}
          {continuePercent != null && (
            <div className="mb-[clamp(1rem,2.5vh,1.5rem)] max-w-[clamp(20rem,30vw,30rem)]">
              <div className="flex items-center justify-between mb-[clamp(0.25rem,0.5vh,0.375rem)]">
                <span className="text-[clamp(0.75rem,1vw,0.875rem)] text-text-secondary">
                  Continuar viendo
                </span>
                <span className="text-[clamp(0.75rem,1vw,0.875rem)] text-text-secondary">
                  {continuePercent}%
                </span>
              </div>
              <div className="h-[3px] bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${continuePercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1.25rem)]">
            {canPlay && (
              <DetailActionButton
                focusKey="detail-hero-play"
                autoFocus
                variant="primary"
                label={
                  content.continue_watching
                    ? 'Reanudar'
                    : isTVShow(content)
                      ? 'Episodio 1'
                      : 'Reproducir'
                }
                icon="▶"
                onEnterPress={onPlay}
                onFocus={() => {
                  onPlayFocus();
                  onHeroFocus();
                }}
                onArrowPress={(dir) => {
                  if (dir === 'left') return onNavigateLeft(dir);
                  if (dir === 'up') return onNavigateUp(dir);
                  if (dir === 'down') return onNavigateDown(dir);
                  return true;
                }}
              />
            )}
            <DetailActionButton
              focusKey="detail-hero-list"
              variant="ghost"
              label="+ Mi Lista"
              onEnterPress={onToggleList}
              onFocus={onHeroFocus}
              onArrowPress={(dir) => {
                if (dir === 'left') return true; // NAVEGACIÓN NORMAL A LA IZQUIERDA
                if (dir === 'up') return onNavigateUp(dir);
                if (dir === 'down') return onNavigateDown(dir);
                return true;
              }}
            />
          </div>
        </FocusContext.Provider>
      </div>
    </div>
  );
});
