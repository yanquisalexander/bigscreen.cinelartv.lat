import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { FocusableRow } from '@/components/tv/FocusableRow';
import {
  LucideTv,
  LucideRefreshCw,
  LucideSearch,
  LucideStar,
  LucidePlay,
  LucideX,
  LucideClock,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLiveTvFavoritesStore } from '@/stores/liveTvFavoritesStore';
import { getApiConfig } from '@/api/client';
import {
  supportsLiveTV,
  playLiveChannel,
  type LiveChannelInfo,
} from '@/services/NativeBridge';
import { getLiveTvChannels, type LiveTvChannel } from '@/api/live';
import { classNames, isBackKey } from '@/utils/helpers';
import { useGeoblockedMode } from '@/components/layout/geoblockedModeContext';

/* ─── helpers ──────────────────────────────────────────────────── */

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function channelCategory(c: LiveTvChannel): string {
  return c.current_program?.category || 'Otros';
}

/* ─── LiveChannelCard ──────────────────────────────────────────── */

interface LiveChannelCardProps {
  channel: LiveTvChannel;
  isFavorite: boolean;
  onPlay: (ch: LiveTvChannel) => void;
  onToggleFavorite: (id: string) => void;
  onLeftEdge?: () => void;
  onArrowUp?: () => void;
  itemIndex: number;
  focusKey?: string;
}

function LiveChannelCard({
  channel,
  isFavorite,
  onPlay,
  onToggleFavorite,
  onLeftEdge,
  onArrowUp,
  itemIndex,
  focusKey,
}: LiveChannelCardProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onPlay(channel),
    onArrowPress: (direction) => {
      if (direction === 'left' && itemIndex === 0 && onLeftEdge) {
        onLeftEdge();
        return false;
      }
      if (direction === 'up' && onArrowUp) {
        onArrowUp();
        return false;
      }
      return true;
    },
  });

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-focused={focused}
      className={classNames(
        'shrink-0 w-[clamp(160px,14vw,200px)] h-[clamp(200px,22vh,260px)] rounded-2xl overflow-hidden snap-start',
        'flex flex-col items-center justify-center gap-3 p-4 relative',
        'bg-surface border-2 cursor-pointer',
        focused
          ? 'border-white/40'
          : 'border-transparent',
      )}
    >
      {/* favorite button */}
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(channel.id);
        }}
        className="absolute top-3 right-3 p-1 z-10"
      >
        <LucideStar
          className={classNames(
            'w-5 h-5',
            isFavorite
              ? 'fill-accent text-accent'
              : 'text-white/40',
          )}
        />
      </button>

      {/* logo */}
      {channel.logo_url ? (
        <img
          src={channel.logo_url}
          alt={channel.name}
          className="w-[clamp(3.5rem,5vw,4.5rem)] h-[clamp(3.5rem,5vw,4.5rem)] object-contain shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-[clamp(3.5rem,5vw,4.5rem)] h-[clamp(3.5rem,5vw,4.5rem)] rounded-xl bg-surface-elevated flex items-center justify-center shrink-0">
          <LucideTv className="w-6 h-6 text-text-secondary" />
        </div>
      )}

      {/* channel name */}
      <p className="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-semibold text-center leading-tight line-clamp-2">
        {channel.name}
      </p>

      {/* current program */}
      {channel.current_program && (
        <div className="text-center">
          <p className="text-accent-light text-[clamp(0.65rem,0.8vw,0.75rem)] font-medium">
            {formatTime(channel.current_program.start_time)} –{' '}
            {formatTime(channel.current_program.end_time)}
          </p>
          <p className="text-text-secondary text-[clamp(0.65rem,0.8vw,0.75rem)] mt-0.5 line-clamp-2 max-w-[140px]">
            {channel.current_program.title}
          </p>
        </div>
      )}

      {/* live indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-live/90 rounded-full px-2 py-0.5">
        <span className="text-white text-[9px] font-bold uppercase tracking-wider">
          Live
        </span>
      </div>
    </div>
  );
}

/* ─── LiveFeaturedHero ─────────────────────────────────────────── */

interface LiveFeaturedHeroProps {
  channel: LiveTvChannel;
  isFavorite: boolean;
  onPlay: (ch: LiveTvChannel) => void;
  onToggleFavorite: (id: string) => void;
}

function LiveFeaturedHero({
  channel,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: LiveFeaturedHeroProps) {

  return (
    <div className="relative w-full h-[clamp(300px,45vh,500px)] shrink-0 overflow-hidden rounded-3xl mx-auto max-w-[calc(100%-6rem)]">
      {/* background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/30 via-surface to-bg" />

      {/* content */}
      <div className="absolute inset-0 flex items-center gap-[clamp(2rem,5vw,5rem)] px-[clamp(2rem,5vw,4rem)]">
        {/* channel logo */}
        <div className="shrink-0">
          {channel.logo_url ? (
            <img
              src={channel.logo_url}
              alt={channel.name}
              className="w-[clamp(5rem,10vw,9rem)] h-[clamp(5rem,10vw,9rem)] object-contain"
            />
          ) : (
            <div className="w-[clamp(5rem,10vw,9rem)] h-[clamp(5rem,10vw,9rem)] rounded-2xl bg-surface-elevated flex items-center justify-center">
              <LucideTv className="w-12 h-12 text-text-secondary" />
            </div>
          )}
        </div>

        {/* info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 bg-live/90 rounded-full px-2.5 py-1">
              <span className="text-white text-[10px] font-bold uppercase tracking-wider">
                En vivo
              </span>
            </div>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(channel.id);
              }}
              className="p-1"
            >
              <LucideStar
                className={classNames(
                  'w-5 h-5',
                  isFavorite
                    ? 'fill-accent text-accent'
                    : 'text-white/40',
                )}
              />
            </button>
          </div>

          <h2 className="text-white text-[clamp(1.5rem,3vw,2.5rem)] font-bold leading-tight mb-1">
            {channel.name}
          </h2>

          {channel.current_program && (
            <div className="mb-4">
              <p className="text-white text-[clamp(1rem,1.8vw,1.35rem)] font-medium">
                {channel.current_program.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <LucideClock className="w-3.5 h-3.5 text-accent-light" />
                <p className="text-accent-light text-[clamp(0.75rem,1vw,0.9rem)]">
                  {formatTime(channel.current_program.start_time)} –{' '}
                  {formatTime(channel.current_program.end_time)}
                </p>
              </div>
              {channel.current_program.description && (
                <p className="text-text-secondary text-[clamp(0.75rem,1vw,0.9rem)] mt-2 line-clamp-2 max-w-[500px]">
                  {channel.current_program.description}
                </p>
              )}
            </div>
          )}

          {/* play button */}
          <Focusable
            focusKey="live-hero-play"
            onEnterPress={() => onPlay(channel)}
            focusedClassName="!bg-white !text-black"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 text-white text-[clamp(0.875rem,1.2vw,1rem)] font-semibold border border-white/20 cursor-pointer"
            playSound
          >
            <LucidePlay className="w-5 h-5" />
            Ver ahora
          </Focusable>
        </div>
      </div>

      {/* upcoming programs mini-timeline */}
      {channel.upcoming_programs && channel.upcoming_programs.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-[clamp(2rem,5vw,4rem)] pb-4">
          <p className="text-text-secondary text-[10px] uppercase tracking-widest mb-2 font-semibold">
            Siguiente
          </p>
          <div className="flex gap-3">
            {channel.upcoming_programs.slice(0, 3).map((prog) => (
              <div key={prog.id} className="flex items-center gap-2 min-w-0">
                <span className="text-accent-light text-[clamp(0.65rem,0.8vw,0.75rem)] shrink-0">
                  {formatTime(prog.start_time)}
                </span>
                <span className="text-text-secondary text-[clamp(0.65rem,0.8vw,0.75rem)] truncate">
                  {prog.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── LiveTVScreen ─────────────────────────────────────────────── */

export function LiveTVScreen() {
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const nativeSupported = supportsLiveTV();
  const { favorites, toggleFavorite, isFavorite } = useLiveTvFavoritesStore();
  const geoblockedSidebarKey = useGeoblockedMode();

  const [channels, setChannels] = useState<LiveTvChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const loaded = useRef(false);

  /* ── data ── */

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLiveTvChannels(tokens?.accessToken);
      setChannels(data);
      loaded.current = true;
    } catch {
      setError('No se pudieron cargar los canales.');
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    if (nativeSupported) fetchChannels();
  }, [nativeSupported, fetchChannels]);

  /* ── back key ── */

  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (isBackKey(e)) {
        e.preventDefault();
        if (searchOpen) {
          setSearchOpen(false);
          setSearchQuery('');
        } else if (geoblockedSidebarKey) {
          // In geoblocked mode there is no /home route; delegate to the shell,
          // which moves focus to the sidebar (and from there opens the exit dialog).
          setFocus(geoblockedSidebarKey);
        } else {
          navigate('/home');
        }
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [navigate, searchOpen, geoblockedSidebarKey]);

  /* ── derived data ── */

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.trim().toLowerCase();
    return channels.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.current_program?.title.toLowerCase().includes(q),
    );
  }, [channels, searchQuery]);

  const favoriteChannels = useMemo(
    () => filteredChannels.filter((c) => favorites.has(c.id)),
    [filteredChannels, favorites],
  );

  const featuredChannel = useMemo(() => {
    if (favoriteChannels.length > 0) return favoriteChannels[0];
    return filteredChannels[0] ?? null;
  }, [favoriteChannels, filteredChannels]);

  const channelsByCategory = useMemo(() => {
    const map = new Map<string, LiveTvChannel[]>();
    for (const ch of filteredChannels) {
      if (ch.id === featuredChannel?.id) continue;
      const cat = channelCategory(ch);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ch);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredChannels, featuredChannel]);

  /* ── auto-focus first channel ── */

  useEffect(() => {
    if (channels.length > 0 && !searchOpen) {
      setFocus('live-hero-play');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

  /* ── play handler ── */

  const handlePlayChannel = useCallback(
    (channel: LiveTvChannel) => {
      const { CLIENT_ENDPOINT } = getApiConfig();
      const info: LiveChannelInfo = {
        id: channel.id,
        name: channel.name,
        url: channel.stream_url,
        logo: channel.logo_url,
        accessToken: tokens?.accessToken,
        clientEndpoint: CLIENT_ENDPOINT,
      };
      playLiveChannel(info);
    },
    [tokens],
  );

  /* ── focus ── */

  const { ref, focusKey } = useFocusable({
    focusKey: 'livetv-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: 'live-hero-play',
  });

  const focusSidebar = useCallback(() => {
    setFocus(geoblockedSidebarKey ?? 'sidebar');
  }, [geoblockedSidebarKey]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleHeroFocus = useCallback(() => {
    setFocus('live-hero-play');
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  /* ── not supported ── */

  if (!nativeSupported) {
    return (
      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="w-full h-dvh flex flex-col items-center justify-center bg-bg px-[clamp(3rem,7.5vw,6rem)]"
        >
          <div className="flex flex-col items-center text-center max-w-[clamp(280px,40vw,500px)]">
            <div className="w-[clamp(4rem,8vw,6rem)] h-[clamp(4rem,8vw,6rem)] rounded-full bg-surface flex items-center justify-center mb-[clamp(1.5rem,3vh,2.5rem)]">
              <LucideTv className="w-[clamp(1.75rem,3.5vw,2.5rem)] h-[clamp(1.75rem,3.5vw,2.5rem)] text-text-secondary" />
            </div>
            <h1 className="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-semibold mb-[clamp(0.75rem,1.5vh,1rem)]">
              TV en Vivo
            </h1>
            <p className="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)] leading-relaxed mb-[clamp(2rem,4vh,3rem)]">
              La funcionalidad de TV en vivo no está disponible para este
              dispositivo.
            </p>
            <Focusable
              focusKey="livetv-back"
              onEnterPress={() => {
                if (geoblockedSidebarKey) {
                  setFocus(geoblockedSidebarKey);
                } else {
                  navigate('/home');
                }
              }}
              onArrowPress={(direction) => {
                if (direction !== 'left') return true;
                focusSidebar();
                return false;
              }}
              focusedClassName="!bg-white !text-black"
              className="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(1.5rem,3vw,2.5rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium flex items-center justify-center cursor-pointer"
              playSound
            >
              Volver al inicio
            </Focusable>
          </div>
        </div>
      </FocusContext.Provider>
    );
  }

  /* ── loading skeleton ── */

  if (loading) {
    return (
      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="w-full h-dvh flex flex-col bg-bg"
        >
          {/* hero skeleton */}
          <div className="px-[clamp(3rem,7.5vw,6rem)] pt-[clamp(1.5rem,3vh,3rem)] pb-4 shrink-0">
            <div className="w-full h-[clamp(300px,45vh,500px)] rounded-3xl bg-surface" />
          </div>
          {/* rail skeleton */}
          <div className="flex-1 px-[clamp(3rem,7.5vw,6rem)] space-y-6 overflow-hidden">
            {[1, 2].map((i) => (
              <div key={i}>
                <div className="w-32 h-4 bg-surface rounded mb-3" />
                <div className="flex gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div
                      key={j}
                      className="shrink-0 w-[clamp(160px,14vw,200px)] h-[clamp(200px,22vh,260px)] rounded-2xl bg-surface"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </FocusContext.Provider>
    );
  }

  /* ── error ── */

  if (error) {
    return (
      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="w-full h-dvh flex flex-col items-center justify-center bg-bg px-[clamp(3rem,7.5vw,6rem)]"
        >
          <p className="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)] mb-[clamp(1.5rem,3vh,2rem)]">
            {error}
          </p>
          <Focusable
            focusKey="livetv-retry"
            onEnterPress={fetchChannels}
            onArrowPress={(direction) => {
              if (direction !== 'left') return true;
              focusSidebar();
              return false;
            }}
            focusedClassName="!bg-white !text-black"
            className="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(1.5rem,3vw,2.5rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium flex items-center gap-2 cursor-pointer"
            playSound
          >
            <LucideRefreshCw className="w-4 h-4" />
            Reintentar
          </Focusable>
        </div>
      </FocusContext.Provider>
    );
  }

  /* ── empty ── */

  if (channels.length === 0) {
    return (
      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="w-full h-dvh flex flex-col items-center justify-center bg-bg"
        >
          <LucideTv className="w-16 h-16 text-text-tertiary mb-4" />
          <p className="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)]">
            No hay canales disponibles en este momento.
          </p>
        </div>
      </FocusContext.Provider>
    );
  }

  /* ── no results ── */

  if (filteredChannels.length === 0) {
    return (
      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="w-full h-dvh flex flex-col bg-bg"
        >
          {/* header with search */}
          <LiveHeader
            searchOpen={searchOpen}
            searchQuery={searchQuery}
            onSearchOpen={() => setSearchOpen(true)}
            onSearchClose={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
            onSearchChange={setSearchQuery}
            channelCount={channels.length}
          />
          <div className="flex-1 flex flex-col items-center justify-center">
            <LucideSearch className="w-12 h-12 text-text-tertiary mb-4" />
            <p className="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)]">
              Ningún canal coincide con "{searchQuery}"
            </p>
          </div>
        </div>
      </FocusContext.Provider>
    );
  }

  /* ── main layout ── */

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh flex flex-col bg-bg"
      >
        {/* header */}
        <LiveHeader
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          onSearchOpen={() => setSearchOpen(true)}
          onSearchClose={() => {
            setSearchOpen(false);
            setSearchQuery('');
          }}
          onSearchChange={setSearchQuery}
          channelCount={filteredChannels.length}
        />

        {/* scrollable content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto hide-scrollbar pb-8">
          {/* hero */}
          {featuredChannel && (
            <div className="px-0 pt-2 pb-6">
              <LiveFeaturedHero
                channel={featuredChannel}
                isFavorite={isFavorite(featuredChannel.id)}
                onPlay={handlePlayChannel}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          )}

          {/* favorites rail */}
          {favoriteChannels.length > 1 && (
            <FocusableRow
              title="Favoritos"
              focusKey="live-favorites"
              preferredChildFocusKey={
                favoriteChannels[1]
                  ? `live-ch-${favoriteChannels[1].id}`
                  : undefined
              }
            >
              {favoriteChannels.slice(1).map((ch, idx) => (
                <LiveChannelCard
                  key={ch.id}
                  channel={ch}
                  isFavorite
                  onPlay={handlePlayChannel}
                  onToggleFavorite={toggleFavorite}
                  onLeftEdge={focusSidebar}
                  onArrowUp={handleHeroFocus}
                  itemIndex={idx}
                  focusKey={`live-ch-${ch.id}`}
                />
              ))}
            </FocusableRow>
          )}

          {/* category rails */}
          {channelsByCategory.map(([category, cats]) => (
            <FocusableRow
              key={category}
              title={category}
              focusKey={`live-cat-${category}`}
              preferredChildFocusKey={`live-ch-${cats[0].id}`}
            >
              {cats.map((ch, idx) => (
                <LiveChannelCard
                  key={ch.id}
                  channel={ch}
                  isFavorite={isFavorite(ch.id)}
                  onPlay={handlePlayChannel}
                  onToggleFavorite={toggleFavorite}
                  onLeftEdge={focusSidebar}
                  onArrowUp={handleHeroFocus}
                  itemIndex={idx}
                  focusKey={`live-ch-${ch.id}`}
                />
              ))}
            </FocusableRow>
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

/* ─── LiveHeader ───────────────────────────────────────────────── */

interface LiveHeaderProps {
  searchOpen: boolean;
  searchQuery: string;
  onSearchOpen: () => void;
  onSearchClose: () => void;
  onSearchChange: (q: string) => void;
  channelCount: number;
}

function LiveHeader({
  searchOpen,
  searchQuery,
  onSearchOpen,
  onSearchClose,
  onSearchChange,
  channelCount,
}: LiveHeaderProps) {
  return (
    <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(3rem,7.5vw,6rem)] pt-[clamp(1.5rem,3vh,3rem)] pb-[clamp(0.75rem,1.5vh,1rem)] shrink-0">
      <div className="w-[clamp(2rem,3.5vw,3rem)] h-[clamp(2rem,3.5vw,3rem)] rounded-full bg-surface flex items-center justify-center shrink-0">
        <LucideTv className="w-[clamp(1rem,1.5vw,1.25rem)] h-[clamp(1rem,1.5vw,1.25rem)] text-accent-light" />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-white text-[clamp(1.25rem,2.5vw,1.75rem)] font-bold">
          TV en Vivo
        </h1>
        <p className="text-text-secondary text-[clamp(0.7rem,0.9vw,0.8rem)]">
          {channelCount} {channelCount === 1 ? 'canal' : 'canales'} disponibles
        </p>
      </div>

      {!searchOpen ? (
        <Focusable
          focusKey="live-search-toggle"
          onEnterPress={onSearchOpen}
          onArrowPress={(direction) => {
            if (direction === 'down') {
              setFocus('live-hero-play');
              return false;
            }
            return direction !== 'up';
          }}
          focusedClassName="!bg-white !text-black"
          className="w-[clamp(2rem,3.5vh,2.5rem)] h-[clamp(2rem,3.5vh,2.5rem)] rounded-full bg-surface flex items-center justify-center cursor-pointer shrink-0"
          playSound
        >
          <LucideSearch className="w-4 h-4 text-text-secondary" />
        </Focusable>
      ) : (
        <div className="flex items-center gap-2 bg-surface rounded-full px-4 h-[clamp(2rem,3.5vh,2.5rem)] border border-white/10">
          <LucideSearch className="w-4 h-4 text-text-secondary shrink-0" />
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar canal..."
            className="bg-transparent text-white text-[clamp(0.8rem,1.1vw,0.9rem)] outline-none w-[clamp(120px,18vw,220px)]"
          />
          <button type="button" onClick={onSearchClose}>
            <LucideX className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      )}
    </div>
  );
}
