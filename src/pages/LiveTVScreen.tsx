import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { LucideTv, LucideRefreshCw, LucideSearch, LucideStar, LucideX } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useLiveTvFavoritesStore } from '@/stores/liveTvFavoritesStore';
import { getApiConfig } from '@/api/client';
import { supportsLiveTV, playLiveChannel, type LiveChannelInfo } from '@/services/NativeBridge';
import { getLiveTvChannels, type LiveTvChannel } from '@/api/live';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

interface ChannelRowProps {
  channel: LiveTvChannel;
  onPlay: (channel: LiveTvChannel) => void;
  onLeftEdge: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

function ChannelRow({ channel, onPlay, onLeftEdge, isFavorite, onToggleFavorite }: ChannelRowProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  return (
    <Focusable
      focusKey={`channel-${channel.id}`}
      onEnterPress={() => onPlay(channel)}
      onFocus={() => {
        itemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }}
      onArrowPress={(direction) => {
        if (direction === 'left') {
          onLeftEdge();
          return false;
        }
        return true;
      }}
      focusedClassName="!bg-white/10 !ring-2 !ring-white/30 !scale-[1.02]"
      className="flex items-center gap-[clamp(0.75rem,1.5vw,1.25rem)] px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.625rem,1.25vh,0.875rem)] rounded-xl bg-surface transition-all duration-200 cursor-pointer"
    >
      <div ref={itemRef} className="flex items-center gap-[clamp(0.75rem,1.5vw,1.25rem)] w-full">
        {channel.logo_url ? (
          <img
            src={channel.logo_url}
            alt={channel.name}
            className="w-[clamp(2.5rem,4vw,3.5rem)] h-[clamp(2.5rem,4vw,3.5rem)] object-contain shrink-0 rounded-lg"
            loading="lazy"
          />
        ) : (
          <div className="w-[clamp(2.5rem,4vw,3.5rem)] h-[clamp(2.5rem,4vw,3.5rem)] rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
            <LucideTv className="w-[clamp(1.25rem,2vw,1.5rem)] h-[clamp(1.25rem,2vw,1.5rem)] text-text-secondary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-[clamp(0.95rem,1.4vw,1.125rem)] font-medium truncate">
            {channel.name}
          </p>
          {channel.current_program && (
            <p className="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] truncate">
              <span className="text-accent">
                {formatTime(channel.current_program.start_time)} - {formatTime(channel.current_program.end_time)}
              </span>
              {' '}{channel.current_program.title}
            </p>
          )}
        </div>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel.id);
          }}
          className="shrink-0 p-2"
        >
          <LucideStar
            className={`w-[clamp(1.1rem,1.6vw,1.4rem)] h-[clamp(1.1rem,1.6vw,1.4rem)] ${isFavorite ? 'fill-accent text-accent' : 'text-text-secondary'}`}
          />
        </button>
      </div>
    </Focusable>
  );
}

export function LiveTVScreen() {
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const nativeSupported = supportsLiveTV();
  const { favorites, toggleFavorite, isFavorite } = useLiveTvFavoritesStore();

  const [channels, setChannels] = useState<LiveTvChannel[]>([]);
  const [loading, setLoading] = useState(!!tokens);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const loaded = useRef(false);

  const fetchChannels = useCallback(async () => {
    if (!tokens?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getLiveTvChannels(tokens.accessToken);
      setChannels(data);
      loaded.current = true;
    } catch {
      setError('No se pudieron cargar los canales.');
    } finally {
      setLoading(false);
    }
  }, [tokens]);

  useEffect(() => {
    if (nativeSupported) {
      fetchChannels();
    }
  }, [nativeSupported, fetchChannels]);

  useEffect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (['Escape', 'Backspace', 'XF86Back', 'GoBack', 'BrowserBack'].includes(e.key)) {
        e.preventDefault();
        if (searchOpen) {
          setSearchOpen(false);
          setSearchQuery('');
        } else {
          navigate('/home');
        }
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [navigate, searchOpen]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.trim().toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, searchQuery]);

  const favoriteChannels = useMemo(
    () => filteredChannels.filter((c) => favorites.has(c.id)),
    [filteredChannels, favorites],
  );

  const otherChannels = useMemo(
    () => filteredChannels.filter((c) => !favorites.has(c.id)),
    [filteredChannels, favorites],
  );

  useEffect(() => {
    if (channels.length > 0 && !searchOpen) {
      const firstId = favoriteChannels[0]?.id ?? otherChannels[0]?.id;
      if (firstId) setFocus(`channel-${firstId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels]);

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

  const { ref, focusKey } = useFocusable({
    focusKey: 'livetv-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey:
      favoriteChannels.length > 0
        ? `channel-${favoriteChannels[0].id}`
        : otherChannels.length > 0
          ? `channel-${otherChannels[0].id}`
          : undefined,
  });

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
              La funcionalidad de TV en vivo no está disponible para este dispositivo.
            </p>
            <Focusable
              focusKey="livetv-back"
              onEnterPress={() => navigate('/home')}
              onArrowPress={(direction) => {
                if (direction !== 'left') return true;
                setFocus('nav-home');
                return false;
              }}
              focusedClassName="!bg-white !text-black scale-105"
              className="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(1.5rem,3vw,2.5rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium flex items-center justify-center transition-all duration-200 cursor-pointer"
            >
              Volver al inicio
            </Focusable>
          </div>
        </div>
      </FocusContext.Provider>
    );
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="w-full h-dvh flex flex-col bg-bg"
      >
        <div className="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(3rem,7.5vw,6rem)] pt-[clamp(1.5rem,3vh,3rem)] pb-[clamp(1rem,2vh,1.5rem)] shrink-0">
          <div className="w-[clamp(2.5rem,4vw,3.5rem)] h-[clamp(2.5rem,4vw,3.5rem)] rounded-full bg-surface flex items-center justify-center shrink-0">
            <LucideTv className="w-[clamp(1.25rem,2vw,1.75rem)] h-[clamp(1.25rem,2vw,1.75rem)] text-text-secondary" />
          </div>
          <h1 className="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-semibold flex-1">
            TV en Vivo
          </h1>

          {!loading && !error && channels.length > 0 && (
            searchOpen ? (
              <div className="flex items-center gap-2 bg-surface rounded-full px-[clamp(1rem,2vw,1.5rem)] h-[clamp(2.5rem,4vh,3rem)]">
                <LucideSearch className="w-[clamp(1rem,1.5vw,1.25rem)] h-[clamp(1rem,1.5vw,1.25rem)] text-text-secondary shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar canal..."
                  className="bg-transparent text-white text-[clamp(0.9rem,1.3vw,1.125rem)] outline-none w-[clamp(150px,20vw,260px)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <LucideX className="w-[clamp(1rem,1.5vw,1.25rem)] h-[clamp(1rem,1.5vw,1.25rem)] text-text-secondary" />
                </button>
              </div>
            ) : (
              <Focusable
                focusKey="livetv-search-toggle"
                onEnterPress={() => setSearchOpen(true)}
                onArrowPress={(direction) => direction !== 'up'}
                focusedClassName="!bg-white !text-black"
                className="w-[clamp(2.5rem,4vh,3rem)] h-[clamp(2.5rem,4vh,3rem)] rounded-full bg-surface flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0"
              >
                <LucideSearch className="w-[clamp(1.1rem,1.6vw,1.35rem)] h-[clamp(1.1rem,1.6vw,1.35rem)] text-text-secondary" />
              </Focusable>
            )
          )}
        </div>

        {loading ? (
          <div className="flex-1 px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(1.5rem,3vh,3rem)] space-y-[clamp(0.5rem,1vh,0.75rem)]">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[clamp(4rem,8vh,5rem)] bg-surface rounded-xl animate-pulse-slow"
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(1.5rem,3vh,3rem)]">
            <p className="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)] mb-[clamp(1.5rem,3vh,2rem)]">
              {error}
            </p>
            <Focusable
              focusKey="livetv-retry"
              onEnterPress={fetchChannels}
              onArrowPress={(direction) => {
                if (direction !== 'left') return true;
                setFocus('nav-home');
                return false;
              }}
              focusedClassName="!bg-white !text-black scale-105"
              className="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(1.5rem,3vw,2.5rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            >
              <LucideRefreshCw className="w-[clamp(1rem,1.5vw,1.25rem)] h-[clamp(1rem,1.5vw,1.25rem)]" />
              Reintentar
            </Focusable>
          </div>
        ) : channels.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(1.5rem,3vh,3rem)]">
            <p className="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)]">
              No hay canales disponibles en este momento.
            </p>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(1.5rem,3vh,3rem)]">
            <p className="text-text-secondary text-[clamp(0.9rem,1.3vw,1.125rem)]">
              Ningún canal coincide con "{searchQuery}".
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto hide-scrollbar px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(1.5rem,3vh,3rem)]">
            {favoriteChannels.length > 0 && (
              <div className="mb-[clamp(1rem,2vh,1.5rem)]">
                <p className="text-text-secondary text-[clamp(0.75rem,1vw,0.875rem)] uppercase tracking-wide mb-[clamp(0.5rem,1vh,0.75rem)]">
                  Favoritos
                </p>
                <div className="space-y-[clamp(0.5rem,1vh,0.75rem)]">
                  {favoriteChannels.map((channel) => (
                    <ChannelRow
                      key={channel.id}
                      channel={channel}
                      onPlay={handlePlayChannel}
                      onLeftEdge={() => setFocus('nav-home')}
                      isFavorite
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )}

            {otherChannels.length > 0 && (
              <div>
                {favoriteChannels.length > 0 && (
                  <p className="text-text-secondary text-[clamp(0.75rem,1vw,0.875rem)] uppercase tracking-wide mb-[clamp(0.5rem,1vh,0.75rem)]">
                    Todos los canales
                  </p>
                )}
                <div className="space-y-[clamp(0.5rem,1vh,0.75rem)]">
                  {otherChannels.map((channel) => (
                    <ChannelRow
                      key={channel.id}
                      channel={channel}
                      onPlay={handlePlayChannel}
                      onLeftEdge={() => setFocus('nav-home')}
                      isFavorite={isFavorite(channel.id)}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}