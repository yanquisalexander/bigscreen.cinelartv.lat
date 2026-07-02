import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpatialNavInit } from '@/hooks/useSpatialNavInit';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import {
  requestDeviceCode,
  pollDeviceToken,
  getPollInterval,
  classifyTokenResponse,
} from '@/features/auth/deviceCode';
import { getCurrentSession } from '@/features/auth/session';
import { FocusableButton } from '@/components/tv/FocusableButton';
import { formatUserCode } from '@/utils/helpers';

export function AuthScreen() {
  useSpatialNavInit();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const setSession = useAuthStore((s) => s.setSession);
  const config = useConfigStore((s) => s.config);

  const [userCode, setUserCode] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef(false);

  const startDeviceCodeFlow = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const clientId = config.CLIENT_ID ?? 'xvk9JnMaS5f0y0aiiLZ6kx8-boITuK8zoQcPRHbkX6Y';
      const response = await requestDeviceCode(clientId);

      setUserCode(response.user_code);
      setVerificationUri(response.verification_uri);
      setQrUrl(
        `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(
          response.verification_uri_complete ?? response.verification_uri,
        )}`,
      );
      setLoading(false);

      pollingRef.current = true;
      const interval = getPollInterval(response.interval);

      const poll = async () => {
        if (!pollingRef.current) return;
        try {
          const tokenResponse = await pollDeviceToken(clientId, response.device_code);
          const status = classifyTokenResponse(tokenResponse);

          switch (status) {
            case 'success':
              pollingRef.current = false;
              login({
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token,
              });
              try {
                const session = await getCurrentSession(tokenResponse.access_token);
                setSession(session);
              } catch { /* session fetch failed, continue */ }
              navigate('/select-profile', { replace: true });
              break;
            case 'pending':
              setTimeout(poll, interval);
              break;
            case 'slow_down':
              setTimeout(poll, interval + 5000);
              break;
            case 'expired':
              pollingRef.current = false;
              setError('El código expiró. Solicita uno nuevo.');
              break;
            case 'error':
              pollingRef.current = false;
              setError(tokenResponse.error_description ?? 'Error de autenticación');
              break;
          }
        } catch {
          if (pollingRef.current) {
            setTimeout(poll, interval);
          }
        }
      };

      setTimeout(poll, interval);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Error al conectar con el servidor');
    }
  }, [config, login, setSession, navigate]);

  useEffect(() => {
    startDeviceCodeFlow();
    return () => {
      pollingRef.current = false;
    };
  }, [startDeviceCodeFlow]);

  const handleRetry = () => {
    pollingRef.current = false;
    startDeviceCodeFlow();
  };

  return (
    <div className="w-full h-full flex bg-bg">
      {/* Left column: brand + steps */}
      <div className="w-[42%] h-full flex flex-col justify-center pl-[clamp(3rem,6.5vw,5rem)] pr-[clamp(2rem,4vw,3rem)]">
        <h1 className="text-[clamp(1.5rem,2.4vw,1.875rem)] font-medium mb-[clamp(2.5rem,7vh,3.5rem)]">
          <span className="text-white">CinelarTV</span>
        </h1>

        <p className="text-[clamp(0.75rem,1.1vw,0.875rem)] font-semibold tracking-[0.2em] text-text-tertiary uppercase mb-[clamp(0.5rem,1.4vh,0.75rem)]">
          Activar dispositivo
        </p>
        <h2 className="text-[clamp(2rem,3.2vw,2.5rem)] font-bold text-white mb-[clamp(2rem,5vh,2.5rem)] leading-tight">
          Vinculá tu cuenta
          <br />
          para empezar a mirar
        </h2>

        <ol className="flex flex-col gap-[clamp(1.25rem,4vh,1.75rem)]">
          <li className="flex gap-[clamp(1rem,2vw,1.25rem)]">
            <span className="shrink-0 w-[clamp(2rem,3vw,2.25rem)] h-[clamp(2rem,3vw,2.25rem)] rounded-full border border-white/20 flex items-center justify-center text-[clamp(0.75rem,1.1vw,0.875rem)] font-semibold text-white">
              1
            </span>
            <p className="text-[clamp(1rem,1.45vw,1.125rem)] text-text-secondary pt-[clamp(0.125rem,0.7vh,0.25rem)]">
              Desde tu celular o computadora, entrá a{' '}
              <span className="text-accent-light font-medium">
                {verificationUri || '—'}
              </span>
            </p>
          </li>
          <li className="flex gap-[clamp(1rem,2vw,1.25rem)]">
            <span className="shrink-0 w-[clamp(2rem,3vw,2.25rem)] h-[clamp(2rem,3vw,2.25rem)] rounded-full border border-white/20 flex items-center justify-center text-[clamp(0.75rem,1.1vw,0.875rem)] font-semibold text-white">
              2
            </span>
            <p className="text-[clamp(1rem,1.45vw,1.125rem)] text-text-secondary pt-[clamp(0.125rem,0.7vh,0.25rem)]">
              Ingresá el código que ves a la derecha, o escaneá el QR directamente
            </p>
          </li>
        </ol>
      </div>

      {/* Divider */}
      <div className="w-px h-[70%] self-center bg-white/10" />

      {/* Right column: QR + code / loading / error */}
      <div className="flex-1 h-full flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-[clamp(1rem,3vh,1.5rem)]">
            <div className="w-[clamp(10rem,17vw,14rem)] h-[clamp(10rem,17vw,14rem)] rounded-2xl bg-surface animate-pulse-slow" />
            <div className="h-[clamp(1.5rem,3.5vh,2rem)] w-[clamp(8rem,12.5vw,10rem)] rounded bg-surface-elevated animate-pulse-slow" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-[clamp(1rem,3vh,1.5rem)] max-w-sm text-center">
            <div className="w-[clamp(4rem,6.5vw,5rem)] h-[clamp(4rem,6.5vw,5rem)] rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-red-400 text-[clamp(1.5rem,2.4vw,1.875rem)]">!</span>
            </div>
            <p className="text-red-400 text-[clamp(1rem,1.45vw,1.125rem)]">{error}</p>
            <FocusableButton onEnterPress={handleRetry} autoFocus>
              Reintentar
            </FocusableButton>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-[clamp(1rem,3vh,1.5rem)]">
            <div className="w-[clamp(10rem,17vw,14rem)] h-[clamp(10rem,17vw,14rem)] rounded-2xl overflow-hidden bg-white p-[clamp(0.5rem,1.2vw,0.75rem)]">
              <img
                src={qrUrl}
                alt="Código QR para autenticación"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[clamp(2.25rem,4vw,3rem)] font-bold tracking-[0.3em] text-white">
              {formatUserCode(userCode)}
            </p>

            <p className="text-text-tertiary text-[clamp(0.75rem,1.1vw,0.875rem)]">Código de activación</p>
          </div>
        )}
      </div>
    </div>
  );
}
