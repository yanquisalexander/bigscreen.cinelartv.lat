<script lang="ts">
  import { replace } from 'svelte-spa-router';
  import { authStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import {
    requestDeviceCode,
    pollDeviceToken,
    getPollInterval,
    classifyTokenResponse,
  } from '@/features/auth/deviceCode';
  import { getCurrentSession } from '@/features/auth/session';
  import FocusableButton from '@/components/tv/FocusableButton.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { formatUserCode } from '@/utils/helpers';
  import { trackAuthStarted, trackAuthCompleted } from '@/lib/analytics';

  let userCode = $state('');
  let qrUrl = $state('');
  let verificationUri = $state('');
  let error = $state('');
  let loading = $state(true);
  let polling = false;

  async function startDeviceCodeFlow() {
    try {
      loading = true;
      error = '';
      trackAuthStarted();
      const clientId = $svelteConfigStore.config.CLIENT_ID ?? 'xvk9JnMaS5f0y0aiiLZ6kx8-boITuK8zoQcPRHbkX6Y';
      const response = await requestDeviceCode(clientId);

      userCode = response.user_code;
      verificationUri = response.verification_uri;
      qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(
        response.verification_uri_complete ?? response.verification_uri,
      )}`;
      loading = false;

      polling = true;
      const interval = getPollInterval(response.interval);

      const poll = async () => {
        if (!polling) return;
        try {
          const tokenResponse = await pollDeviceToken(clientId, response.device_code);
          const status = classifyTokenResponse(tokenResponse);

          switch (status) {
            case 'success':
              polling = false;
              trackAuthCompleted('device_code');
              authStore.getState().login({
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token,
              });
              try {
                const session = await getCurrentSession(tokenResponse.access_token);
                authStore.getState().setSession(session);
              } catch {
                /* session fetch failed, continue */
              }
              replace('/select-profile');
              break;
            case 'pending':
              setTimeout(poll, interval);
              break;
            case 'slow_down':
              setTimeout(poll, interval + 5000);
              break;
            case 'expired':
              polling = false;
              error = 'El código expiró. Solicita uno nuevo.';
              break;
            case 'error':
              polling = false;
              error = tokenResponse.error_description ?? 'Error de autenticación';
              break;
          }
        } catch {
          if (polling) {
            setTimeout(poll, interval);
          }
        }
      };

      setTimeout(poll, interval);
    } catch (err) {
      loading = false;
      error = err instanceof Error ? err.message : 'Error al conectar con el servidor';
    }
  }

  $effect(() => {
    startDeviceCodeFlow();
    return () => {
      polling = false;
    };
  });

  function handleRetry() {
    polling = false;
    startDeviceCodeFlow();
  }

  function handleGuestMode() {
    polling = false;
    trackAuthCompleted('guest');
    authStore.getState().enterGuestMode();
    replace('/home');
  }
</script>

<div class="w-full h-full flex bg-bg">
  <!-- Left column: brand + steps -->
  <div class="w-[42%] h-full flex flex-col justify-center pl-[clamp(3rem,6.5vw,5rem)] pr-[clamp(2rem,4vw,3rem)]">
    <h1 class="text-[clamp(1.5rem,2.4vw,1.875rem)] font-medium mb-[clamp(2.5rem,7vh,3.5rem)]">
      <span class="text-white">CinelarTV</span>
    </h1>

    <p class="text-[clamp(0.75rem,1.1vw,0.875rem)] font-semibold tracking-[0.2em] text-text-tertiary uppercase mb-[clamp(0.5rem,1.4vh,0.75rem)]">
      Activar dispositivo
    </p>
    <h2 class="text-[clamp(2rem,3.2vw,2.5rem)] font-bold text-white mb-[clamp(2rem,5vh,2.5rem)] leading-tight">
      Vinculá tu cuenta
      <br />
      para empezar a mirar
    </h2>

    <ol class="flex flex-col gap-[clamp(1.25rem,4vh,1.75rem)]">
      <li class="flex gap-[clamp(1rem,2vw,1.25rem)]">
        <span class="shrink-0 w-[clamp(2rem,3vw,2.25rem)] h-[clamp(2rem,3vw,2.25rem)] rounded-full border border-white/20 flex items-center justify-center text-[clamp(0.75rem,1.1vw,0.875rem)] font-semibold text-white">
          1
        </span>
        <p class="text-[clamp(1rem,1.45vw,1.125rem)] text-text-secondary pt-[clamp(0.125rem,0.7vh,0.25rem)]">
          Desde tu celular o computadora, entrá a{' '}
          <span class="text-accent-light font-medium">
            {verificationUri || '—'}
          </span>
        </p>
      </li>
      <li class="flex gap-[clamp(1rem,2vw,1.25rem)]">
        <span class="shrink-0 w-[clamp(2rem,3vw,2.25rem)] h-[clamp(2rem,3vw,2.25rem)] rounded-full border border-white/20 flex items-center justify-center text-[clamp(0.75rem,1.1vw,0.875rem)] font-semibold text-white">
          2
        </span>
        <p class="text-[clamp(1rem,1.45vw,1.125rem)] text-text-secondary pt-[clamp(0.125rem,0.7vh,0.25rem)]">
          Ingresá el código que ves a la derecha, o escaneá el QR directamente
        </p>
      </li>
    </ol>
  </div>

  <!-- Divider -->
  <div class="w-px h-[70%] self-center bg-white/10"></div>

  <!-- Right column: QR + code / loading / error -->
  <div class="flex-1 h-full flex flex-col items-center justify-center">
    <Focusable focusKey="auth-qr" autoFocus={!error} class="flex flex-col items-center gap-[clamp(1rem,3vh,1.5rem)]">
      {#snippet children()}
        {#if loading}
          <div class="w-[clamp(10rem,17vw,14rem)] h-[clamp(10rem,17vw,14rem)] rounded-2xl bg-surface animate-pulse-slow"></div>
          <div class="h-[clamp(1.5rem,3.5vh,2rem)] w-[clamp(8rem,12.5vw,10rem)] rounded bg-surface-elevated animate-pulse-slow"></div>
        {:else if error}
          <div class="w-[clamp(4rem,6.5vw,5rem)] h-[clamp(4rem,6.5vw,5rem)] rounded-full bg-red-500/10 flex items-center justify-center">
            <span class="text-red-400 text-[clamp(1.5rem,2.4vw,1.875rem)]">!</span>
          </div>
          <p class="text-red-400 text-[clamp(1rem,1.45vw,1.125rem)]">{error}</p>
          <FocusableButton onEnterPress={handleRetry} autoFocus={true} playSound={true}>
            {#snippet children()}
              Reintentar
            {/snippet}
          </FocusableButton>
        {:else}
          <div class="w-[clamp(10rem,17vw,14rem)] h-[clamp(10rem,17vw,14rem)] rounded-2xl overflow-hidden bg-white p-[clamp(0.5rem,1.2vw,0.75rem)]">
            <img
              src={qrUrl}
              alt="Código QR para autenticación"
              class="w-full h-full object-contain"
            />
          </div>

          <p class="text-[clamp(2.25rem,4vw,3rem)] font-bold tracking-[0.3em] text-white">
            {formatUserCode(userCode)}
          </p>

          <p class="text-text-tertiary text-[clamp(0.75rem,1.1vw,0.875rem)]">Código de activación</p>
        {/if}
      {/snippet}
    </Focusable>

    <FocusableButton
      onEnterPress={handleGuestMode}
      variant="ghost"
      size="lg"
      focusKey="guest-mode"
      focusedClass="!bg-white !text-black !scale-105 !transition-none"
      class="mt-[clamp(1.5rem,4vh,2.5rem)]"
      playSound={true}
    >
      {#snippet children()}
        Echaré un vistazo primero
      {/snippet}
    </FocusableButton>
  </div>
</div>
