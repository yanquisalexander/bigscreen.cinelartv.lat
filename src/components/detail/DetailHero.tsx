import { memo, useMemo } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { LucidePlay, LucideClapperboard, LucidePlus, LucideRotateCcw } from 'lucide-react';
import { formatTime, classNames, resolveBackdrop, resolvePoster, resolveLogo } from '@/utils/helpers';
import { DetailActionButton } from './DetailActionButton';
import type { ContentDetail } from '@/types/content';
import { isTVShow } from '@/types/content';

interface DetailHeroProps {
  content: ContentDetail;
  clientEndpoint?: string;
  canPlay: boolean;
  onPlay: () => void;
  onPlayTrailer?: () => void;
  onToggleList: () => void;
  onNavigateDown: (direction: string) => boolean;
  onNavigateLeft: (direction: string) => boolean;
  onNavigateUp: (direction: string) => boolean;
  onPlayFocus: () => void;
  onHeroFocus: () => void;
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
  onPlayTrailer,
  onToggleList,
  onNavigateDown,
  onNavigateLeft,
  onNavigateUp,
  onPlayFocus,
  onHeroFocus,
}: DetailHeroProps) {
  const backdropUrl = resolveBackdrop(content.images, content.banner_resized ?? content.banner ?? content.cover_resized ?? content.cover, clientEndpoint);
  const posterUrl = resolvePoster(content.images, content.cover_resized ?? content.cover, clientEndpoint);
  const logoUrl = resolveLogo(content.images, clientEndpoint);

  const { ref: heroRef, focusKey: heroFocusKey } = useFocusable({
    focusKey: 'detail-hero',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'detail-hero-play',
  });

  const duration = useMemo(() => formatDuration(content), [content]);

  const hasTrailer = !!(content.trailer_sources?.length || content.trailer_video_sources?.length);

  const continuePercent = useMemo(() => {
    if (!content.continue_watching) return null;
    const { progress, duration: d } = content.continue_watching;
    if (!d) return null;
    return Math.min(100, Math.round((progress / d) * 100));
  }, [content.continue_watching]);

  const contentType = useMemo(() => {
    if (isTVShow(content)) return 'Serie';
    if (content.content_type || content.contentType) return 'Película';
    return null;
  }, [content]);

  const metadataParts = useMemo(() => {
    const parts: string[] = [];
    if (content.year) parts.push(String(content.year));
    if (duration) parts.push(duration);
    if (content.seasons_count && content.episodes_count) {
      const s = content.seasons_count === 1 ? '1 temporada' : `${content.seasons_count} temporadas`;
      const e = content.episodes_count === 1 ? '1 episodio' : `${content.episodes_count} episodios`;
      parts.push(`${s} · ${e}`);
    }
    return parts;
  }, [content.year, duration, content.seasons_count, content.episodes_count]);

  const genreTags = useMemo(
    () => (content.categories ?? []).slice(0, 4).map((c) => c.name),
    [content.categories],
  );

  return (
    <div className="relative w-full overflow-hidden min-h-[clamp(36rem,86vh,60rem)]">
      {/* Scoped entrance animation — purely presentational, no logic impact */}
      <style>{`
        @keyframes detailHeroIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .detail-hero-stagger > * { opacity: 0; animation: detailHeroIn .6s cubic-bezier(.16,1,.3,1) forwards; }
        .detail-hero-stagger > *:nth-child(1) { animation-delay: .02s; }
        .detail-hero-stagger > *:nth-child(2) { animation-delay: .08s; }
        .detail-hero-stagger > *:nth-child(3) { animation-delay: .14s; }
        .detail-hero-stagger > *:nth-child(4) { animation-delay: .2s; }
        .detail-hero-stagger > *:nth-child(5) { animation-delay: .26s; }
        .detail-hero-stagger > *:nth-child(6) { animation-delay: .32s; }
        .detail-hero-stagger > *:nth-child(7) { animation-delay: .38s; }
      `}</style>

      {/* Ambient layered backdrop */}
      <div className="absolute inset-0">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-45 hero-fade-in"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-accent/25 via-bg to-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/50" />
      </div>

      {/* Content grid */}
      <div
        className="relative h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_clamp(18rem,30vw,32rem)] items-center
          gap-[clamp(2rem,5vw,4.5rem)]
          px-[clamp(3rem,7.5vw,6rem)]
          pt-[clamp(6.5rem,15vh,8.5rem)]
          pb-[clamp(3rem,7vh,4.5rem)]
          min-h-[clamp(36rem,86vh,60rem)]"
      >
        <FocusContext.Provider value={heroFocusKey}>
          <div
            ref={heroRef as React.RefObject<HTMLDivElement>}
            className="detail-hero-stagger flex flex-col items-start max-w-[46rem]"
          >
            {/* Eyebrow */}
            {contentType && (
              <span className="inline-flex items-center gap-[0.45em] text-accent text-[clamp(0.6875rem,0.85vw,0.75rem)] font-bold uppercase tracking-[0.22em] mb-[clamp(0.75rem,1.6vh,1.125rem)]">
                <span className="w-[6px] h-[6px] rounded-full bg-accent" />
                {contentType}
              </span>
            )}

            {/* Logo / Title */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={content.title}
                className="h-[clamp(3rem,7vh,5rem)] max-w-[80%] object-contain object-left mb-[clamp(0.875rem,1.8vh,1.25rem)] drop-shadow-[0_10px_28px_rgba(0,0,0,0.65)]"
              />
            ) : (
              <h1
                className={classNames(
                  'font-black text-white leading-[0.98] tracking-[-0.03em]',
                  'text-[clamp(2.5rem,5.2vw,4.25rem)]',
                  'mb-[clamp(0.875rem,1.8vh,1.25rem)]',
                  'max-w-[85%]',
                  'drop-shadow-[0_10px_28px_rgba(0,0,0,0.65)]',
                )}
              >
                {content.title}
              </h1>
            )}

            {/* Metadata chips */}
            {metadataParts.length > 0 && (
              <div className="flex items-center gap-[clamp(0.5rem,1vw,0.625rem)] mb-[clamp(0.75rem,1.6vh,1rem)] flex-wrap">
                {metadataParts.map((part, i) => (
                  <span
                    key={i}
                    className="px-[clamp(0.625rem,1vw,0.75rem)] py-[clamp(0.25rem,0.5vh,0.3125rem)] rounded-full bg-white/[0.08] ring-1 ring-white/10 text-white/80 text-[clamp(0.75rem,1vw,0.8125rem)] font-semibold"
                  >
                    {part}
                  </span>
                ))}
              </div>
            )}

            {/* Genres */}
            {genreTags.length > 0 && (
              <p className="text-[clamp(0.8125rem,1.05vw,0.9375rem)] text-white/40 mb-[clamp(1rem,2.2vh,1.5rem)] max-w-[clamp(28rem,40vw,44rem)] truncate tracking-wide">
                {genreTags.join('   ·   ')}
              </p>
            )}

            {/* Description */}
            {content.description && (
              <p
                className={classNames(
                  'text-[clamp(1rem,1.4vw,1.1875rem)] text-white/70 font-light',
                  'max-w-[clamp(36rem,48vw,54rem)] leading-[1.55]',
                  'mb-[clamp(1.5rem,3.4vh,2.25rem)]',
                  'line-clamp-3',
                )}
              >
                {content.description}
              </p>
            )}

            {/* Continue watching */}
            {continuePercent != null && (
              <div className="flex items-center gap-[clamp(0.75rem,1.4vw,1rem)] mb-[clamp(1.5rem,3.4vh,2.25rem)] pl-[clamp(0.75rem,1.4vw,1rem)] pr-[clamp(1.25rem,2vw,1.5rem)] py-[clamp(0.625rem,1.2vh,0.8125rem)] rounded-2xl bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-sm max-w-[clamp(22rem,32vw,28rem)]">
                <div className="shrink-0 w-[clamp(2rem,4vh,2.5rem)] h-[clamp(2rem,4vh,2.5rem)] rounded-full bg-accent/15 flex items-center justify-center">
                  <LucideRotateCcw size={16} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-[0.3125rem]">
                    <span className="text-[clamp(0.6875rem,0.85vw,0.75rem)] text-white/55 font-semibold uppercase tracking-wide">
                      Continuar viendo
                    </span>
                    <span className="text-[clamp(0.6875rem,0.85vw,0.75rem)] text-white/55 font-semibold">
                      {continuePercent}%
                    </span>
                  </div>
                  <div className="h-[4px] bg-white/12 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${continuePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1.125rem)]">
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
                  icon={<LucidePlay size={20} fill="currentColor" />}
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
              {hasTrailer && onPlayTrailer && (
                <DetailActionButton
                  focusKey="detail-hero-trailer"
                  variant="secondary"
                  label="Tráiler"
                  icon={<LucideClapperboard size={16} />}
                  onEnterPress={onPlayTrailer}
                  onFocus={onHeroFocus}
                  onArrowPress={(dir) => {
                    if (dir === 'left') return true;
                    if (dir === 'up') return onNavigateUp(dir);
                    if (dir === 'down') return onNavigateDown(dir);
                    return true;
                  }}
                />
              )}
              <DetailActionButton
                focusKey="detail-hero-list"
                variant="ghost"
                label="Mi Lista"
                icon={<LucidePlus size={16} />}
                onEnterPress={onToggleList}
                onFocus={onHeroFocus}
                onArrowPress={(dir) => {
                  if (dir === 'left') return true;
                  if (dir === 'up') return onNavigateUp(dir);
                  if (dir === 'down') return onNavigateDown(dir);
                  return true;
                }}
              />
            </div>
          </div>
        </FocusContext.Provider>

        {/* Floating artwork panel — decorative depth layer */}
        <div className="hidden md:flex justify-end relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent/10 blur-3xl" />
          <div
            className="relative rounded-[2rem] overflow-hidden ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)] w-[clamp(14rem,22vw,22rem)] aspect-[3/4]"
          >
            {(posterUrl ?? backdropUrl) ? (
              <img src={posterUrl ?? backdropUrl} alt="" aria-hidden className="w-full h-full object-cover hero-fade-in" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/30 to-surface" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[2rem]" />
          </div>
        </div>
      </div>

      {/* Seam into page background */}
      <div className="absolute inset-x-0 bottom-0 h-[14%] bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
});