import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { selectProfile, getCurrentSession } from '@/features/auth/session';
import { getExplore } from '@/features/content/explore';
import { Focusable } from '@/components/tv/Focusable';
import { classNames, resolveBackdrop, resolveLogo } from '@/utils/helpers';
import { Plus, LogOut } from 'lucide-react';
import type { Profile } from '@/types/api';
import type { ContentItem } from '@/types/content';

const ROTATION_INTERVAL = 8000;
const CROSSFADE_MS = 900;

export function ProfileSelectScreen() {
  useSpatialNavInit();
  const navigate = useNavigate();
  const tokens = useAuthStore((s) => s.tokens);
  const session = useAuthStore((s) => s.session);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);
  const clientEndpoint = useConfigStore((s) => s.config.CLIENT_ENDPOINT);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [banners, setBanners] = useState<ContentItem[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [prevBannerUrl, setPrevBannerUrl] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPrevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch featured content for cinematic backdrop
  useEffect(() => {
    if (!tokens?.accessToken) return;
    getExplore(tokens.accessToken, { img_variants: ['xlarge', 'large'] })
      .then((res) => {
        const items = res.banner_content;
        if (items?.length) setBanners(items);
      })
      .catch(() => {});
  }, [tokens?.accessToken]);

  const featuredItem = banners[bannerIndex] ?? null;

  const backdropUrl = useMemo(() => {
    if (!featuredItem) return null;
    return resolveBackdrop(
      featuredItem.images,
      featuredItem.banner_resized ?? featuredItem.banner ?? featuredItem.cover_resized ?? featuredItem.cover,
      clientEndpoint,
      'xlarge'
    );
  }, [featuredItem, clientEndpoint]);

  // Auto-rotate banners with crossfade
  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setTimeout(() => {
      // Keep the current backdrop underneath while the next one fades in
      setPrevBannerUrl(backdropUrl);
      setBannerIndex((prev) => (prev + 1) % banners.length);
      if (clearPrevTimerRef.current) clearTimeout(clearPrevTimerRef.current);
      clearPrevTimerRef.current = setTimeout(() => setPrevBannerUrl(null), CROSSFADE_MS);
    }, ROTATION_INTERVAL);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (clearPrevTimerRef.current) clearTimeout(clearPrevTimerRef.current);
    };
  }, [banners.length, bannerIndex, backdropUrl]);

  const logoUrl = useMemo(() => {
    if (!featuredItem) return null;
    return resolveLogo(featuredItem.images, clientEndpoint);
  }, [featuredItem, clientEndpoint]);

  const genreTags = useMemo(() => {
    if (!featuredItem) return [];
    const cats = (featuredItem as Record<string, unknown>).categories;
    if (Array.isArray(cats)) {
      return cats.slice(0, 3).map((c: { name?: string }) => c.name ?? '').filter(Boolean);
    }
    return [];
  }, [featuredItem]);

  useEffect(() => {
    if (!tokens) {
      navigate('/auth', { replace: true });
      return;
    }
    if (!session) {
      getCurrentSession(tokens.accessToken)
        .then(setSession)
        .catch(() => navigate('/auth', { replace: true }));
    }
  }, [tokens, session, navigate, setSession]);

  const handleSelectProfile = useCallback(
    async (profile: Profile) => {
      if (!tokens || selecting) return;
      setSelecting(profile.id);
      try {
        await selectProfile(tokens.accessToken, profile.id);
        setProfile(profile);
        navigate('/home', { replace: true });
      } catch {
        setSelecting(null);
      }
    },
    [tokens, selecting, setProfile, navigate],
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate('/auth', { replace: true });
  }, [logout, navigate]);

  const profiles = session?.current_user?.profiles ?? [];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black flex items-center">
      {/* CAPA 1: FONDO CINEMÁTICO INMERSIVO */}
      <div className="absolute inset-0 z-0">
        {/* Imagen anterior: se desvanece (0.5 -> 0) mientras la nueva aparece */}
        {prevBannerUrl && (
          <img
            src={prevBannerUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover animate-backdrop-out"
          />
        )}
        {/* Imagen actual: se funde (0 -> 0.5) al montar (key fuerza remount) */}
        {backdropUrl && (
          <img
            key={backdropUrl}
            src={backdropUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-50 animate-backdrop"
          />
        )}
        {/* Degradados para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 z-10" />
      </div>

      {/* CAPA 2: COLUMNA IZQUIERDA DE SELECCIÓN DE PERFILES */}
      <div className="relative z-20 pl-[clamp(3rem,6vw,6rem)] flex flex-col justify-center gap-5 max-h-screen py-10">
        <div className="flex flex-col gap-4">
          {profiles.map((profile, index) => {
            const avatarUrl = `${clientEndpoint}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'
              }.png`;
            const isSelecting = selecting === profile.id;

            return (
              <Focusable
                key={profile.id}
                onEnterPress={() => handleSelectProfile(profile)}
                autoFocus={index === 0}
                focusKey={`profile-${profile.id}`}
                focusedClassName="[&_img]:ring-4 [&_img]:ring-white [&_img]:opacity-100 [&_span]:text-white [&_span]:font-bold"
                className={classNames(
                  'flex items-center gap-5 transition-colors cursor-pointer group',
                  isSelecting && 'opacity-50'
                )}
                playSound
              >
                {/* AVATAR CIRCULAR CON RING DE FOCO */}
                <div className="relative w-16 h-16 rounded-full shrink-0">
                  <img
                    src={avatarUrl}
                    alt={profile.name}
                    className="w-full h-full rounded-full object-cover opacity-60 transition-all ring-2 ring-transparent"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div
                    className="w-full h-full rounded-full bg-accent items-center justify-center text-black font-black text-xl"
                    style={{ display: 'none' }}
                  >
                    {profile.name.charAt(0).toUpperCase()}
                  </div>

                  {/* LOADER AL SELECCIONAR */}
                  {isSelecting && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* NOMBRE DEL PERFIL */}
                <span className="text-white/60 text-lg font-medium tracking-wide transition-colors group-hover:text-white">
                  {profile.name}
                </span>
              </Focusable>
            );
          })}
          {/* 
          <Focusable
            onEnterPress={() => navigate('/profiles/new')}
            focusKey="profile-add"
            focusedClassName="[&_div]:ring-4 [&_div]:ring-white [&_div]:bg-white/30 [&_span]:text-white [&_span]:font-bold"
            className="flex items-center gap-5 transition-colors cursor-pointer group mt-1"
            playSound
          >
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shrink-0 transition-all ring-2 ring-transparent">
              <Plus className="w-7 h-7 text-white/70" />
            </div>
            <span className="text-white/60 text-lg font-medium tracking-wide">
              Nuevo
            </span>
          </Focusable>
          */}
        </div>

        {/* SEPARADOR / BOTÓN CERRAR SESIÓN */}
        <div className="pt-4 border-t border-white/10">
          <Focusable
            onEnterPress={handleLogout}
            focusKey="logout-btn"
            focusedClassName="[&_div]:ring-4 [&_div]:ring-white [&_div]:bg-white/30 [&_span]:text-white [&_span]:font-bold"
            className="flex items-center gap-5 transition-colors cursor-pointer group"
            playSound
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center shrink-0 transition-all ring-2 ring-transparent">
              <LogOut className="w-6 h-6 text-white/40" />
            </div>
            <span className="text-white/40 text-sm font-medium tracking-wide">
              Cerrar sesión
            </span>
          </Focusable>
        </div>
      </div>

      {/* CAPA 3: METADATOS CINEMÁTICOS (Derecha) */}
      {featuredItem && (
        <div className="absolute right-[clamp(3rem,6vw,6rem)] bottom-[clamp(4rem,10vh,8rem)] z-20 max-w-[clamp(20rem,30vw,32rem)] text-right">
          {/* Logo o Título */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={featuredItem.title}
              className="h-[clamp(2.5rem,5vh,4rem)] max-w-[100%] object-contain object-right ml-auto mb-3 drop-shadow-2xl"
            />
          ) : (
            <h2 className="text-[clamp(1.5rem,2.5vw,2.2rem)] font-black text-white leading-tight mb-3 drop-shadow-lg tracking-tight">
              {featuredItem.title}
            </h2>
          )}

          {/* Metadatos */}
          <div className="flex items-center justify-end gap-2 mb-2 text-xs">
            {featuredItem.year && (
              <span className="px-2 py-0.5 rounded bg-white/10 text-white/90 backdrop-blur-sm font-semibold">
                {featuredItem.year}
              </span>
            )}
            {featuredItem.duration && (
              <span className="text-white/60">{featuredItem.duration} min</span>
            )}
          </div>

          {/* Géneros */}
          {genreTags.length > 0 && (
            <p className="text-[clamp(0.75rem,1vw,0.875rem)] text-white/50 font-medium tracking-wide">
              {genreTags.join(' · ')}
            </p>
          )}

          {/* Descripción (breve) */}
          {featuredItem.description && (
            <p className="text-[clamp(0.8rem,1vw,0.9rem)] text-white/40 mt-2 line-clamp-2 leading-relaxed">
              {featuredItem.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
