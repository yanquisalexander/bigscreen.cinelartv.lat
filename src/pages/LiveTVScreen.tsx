import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FocusContext, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Focusable } from '@/components/tv/Focusable';
import { LucideTv, LucideRefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { supportsLiveTV, playLiveChannel, type LiveChannelInfo } from '@/services/NativeBridge';
import { getLiveTvChannels, type LiveTvChannel } from '@/api/live';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export function LiveTVScreen() {
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const nativeSupported = supportsLiveTV();

  const [channels, setChannels] = useState<LiveTvChannel[]>([]);
  const [loading, setLoading] = useState(!!tokens);
  const [error, setError] = useState<string | null>(null);
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
        navigate('/home');
      }
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [navigate]);

  useEffect(() => {
    if (channels.length > 0) {
      setFocus(`channel-${channels[0].id}`);
    }
  }, [channels]);

  const handlePlayChannel = useCallback(
    (channel: LiveTvChannel) => {
      const info: LiveChannelInfo = {
        id: channel.id,
        name: channel.name,
        url: channel.stream_url,
        logo: channel.logo_url,
      };
      playLiveChannel(info);
    },
    [],
  );

  const { ref, focusKey } = useFocusable({
    focusKey: 'livetv-root',
    focusable: false,
    trackChildren: true,
    saveLastFocusedChild: true,
    preferredChildFocusKey: channels.length > 0 ? `channel-${channels[0].id}` : undefined,
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
          <h1 className="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-semibold">
            TV en Vivo
          </h1>
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
        ) : (
          <div className="flex-1 overflow-y-auto hide-scrollbar px-[clamp(3rem,7.5vw,6rem)] pb-[clamp(1.5rem,3vh,3rem)]">
            <div className="space-y-[clamp(0.5rem,1vh,0.75rem)]">
              {channels.map((channel) => (
                <Focusable
                  key={channel.id}
                  focusKey={`channel-${channel.id}`}
                  onEnterPress={() => handlePlayChannel(channel)}
                  onArrowPress={(direction) => {
                    if (direction !== 'left') return true;
                    setFocus('nav-home');
                    return false;
                  }}
                  focusedClassName="!bg-white/10 !ring-2 !ring-white/30 !scale-[1.02]"
                  className="flex items-center gap-[clamp(0.75rem,1.5vw,1.25rem)] px-[clamp(1rem,2vw,1.5rem)] py-[clamp(0.625rem,1.25vh,0.875rem)] rounded-xl bg-surface transition-all duration-200 cursor-pointer"
                >
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
                </Focusable>
              ))}
            </div>
          </div>
        )}
      </div>
    </FocusContext.Provider>
  );
}