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
        `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
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
      <div className="w-[42%] h-full flex flex-col justify-center pl-20 pr-12">
        <h1 className="text-3xl font-medium mb-14">
          <span className="text-white">CinelarTV</span>
        </h1>

        <p className="text-sm font-semibold tracking-[0.2em] text-text-tertiary uppercase mb-3">
          Activar dispositivo
        </p>
        <h2 className="text-4xl font-bold text-white mb-10 leading-tight">
          Vinculá tu cuenta
          <br />
          para empezar a mirar
        </h2>

        <ol className="flex flex-col gap-7">
          <li className="flex gap-5">
            <span className="shrink-0 w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-sm font-semibold text-white">
              1
            </span>
            <p className="text-lg text-text-secondary pt-1">
              Desde tu celular o computadora, entrá a{' '}
              <span className="text-accent-light font-medium">
                {verificationUri || '—'}
              </span>
            </p>
          </li>
          <li className="flex gap-5">
            <span className="shrink-0 w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-sm font-semibold text-white">
              2
            </span>
            <p className="text-lg text-text-secondary pt-1">
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
          <div className="flex flex-col items-center gap-6">
            <div className="w-56 h-56 rounded-2xl bg-surface animate-pulse-slow" />
            <div className="h-8 w-40 rounded bg-surface-elevated animate-pulse-slow" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-6 max-w-sm text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <span className="text-red-400 text-3xl">!</span>
            </div>
            <p className="text-red-400 text-lg">{error}</p>
            <FocusableButton onEnterPress={handleRetry} autoFocus>
              Reintentar
            </FocusableButton>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div className="w-56 h-56 rounded-2xl overflow-hidden bg-white p-3">
              <img
                src={qrUrl}
                alt="Código QR para autenticación"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-5xl font-bold tracking-[0.3em] text-white">
              {formatUserCode(userCode)}
            </p>

            <p className="text-text-tertiary text-sm">Código de activación</p>
          </div>
        )}
      </div>
    </div>
  );
}