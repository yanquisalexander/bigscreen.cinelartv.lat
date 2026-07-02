import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { selectProfile, getCurrentSession } from '@/features/auth/session';
import { Focusable } from '@/components/tv/Focusable';
import { classNames } from '@/utils/helpers';
import type { Profile } from '@/types/api';

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
    <div className="w-full h-full flex flex-col items-center justify-center bg-bg">
      <p className="text-white text-2xl font-medium mb-4">CinelarTV</p>

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-2">¿Quién eres? 🍿</h1>
        <p className="text-text-secondary text-lg">Selecciona tu perfil para continuar</p>
      </div>

      <div className="flex gap-10 flex-wrap justify-center max-w-4xl mb-12">
        {profiles.map((profile) => {
          const avatarUrl = `${clientEndpoint}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'}.png`;
          const isSelecting = selecting === profile.id;

          return (
            <Focusable
              key={profile.id}
              onEnterPress={() => handleSelectProfile(profile)}
              autoFocus={profiles.indexOf(profile) === 0}
              focusedClassName="scale-105 [&_div]:bg-accent-light/20 [&_div]:border-accent-light"
              className={classNames(
                'flex flex-col items-center gap-4 transition-transform duration-200',
                isSelecting && 'opacity-50 [&_div]:bg-black/50 [&_div]:cursor-wait',
              )}
            >
              <div className="relative w-32 h-32 rounded-full overflow-hidden bg-surface border-4 border-transparent transition-colors">
                <img
                  src={avatarUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div
                  className="absolute inset-0 bg-gradient-to-br from-accent to-accent-light items-center justify-center text-white text-4xl font-bold"
                  style={{ display: 'none' }}
                >
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                {isSelecting && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <span className="text-white text-lg font-medium">{profile.name}</span>
            </Focusable>
          );
        })}
      </div>

      <Focusable
        onEnterPress={handleLogout}
        focusedClassName="text-white"
        className="text-text-secondary text-lg transition-colors"
      >
        Cerrar sesión
      </Focusable>
    </div>
  );
}
