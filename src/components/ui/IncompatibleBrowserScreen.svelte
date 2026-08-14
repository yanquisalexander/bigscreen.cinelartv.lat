<script lang="ts">
  import type { CompatResult } from '@/services/compat';
  import { openUrl, PLAY_STORE_WEBVIEW_URL } from '@/services/NativeBridge';

  interface Props {
    result: CompatResult;
  }

  let { result }: Props = $props();
  let buttonEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    buttonEl?.focus();
  });

  function handleAction() {
    openUrl(PLAY_STORE_WEBVIEW_URL);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAction();
    }
  }
</script>

<div
  style="width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #0f0f0f; color: #ffffff; font-family: Arial, Helvetica, sans-serif; text-align: center; padding: 40px; box-sizing: border-box;"
>
  <div style="font-size: 64px; margin-bottom: 32px;">&#9888;</div>
  <h1 style="font-size: 36px; font-weight: bold; margin: 0 0 24px 0;">
    Navegador no compatible
  </h1>
  <p style="font-size: 20px; line-height: 1.6; color: #cccccc; max-width: 600px; margin: 0 0 32px 0;">
    Tu dispositivo necesita una versión más reciente de Android WebView para
    ejecutar CinelarTV.
  </p>
  <div style="font-size: 18px; color: #999999; line-height: 1.8;">
    {#if result.detectedVersion != null}
      <p style="margin: 0;">
        Versión detectada: Chrome {result.detectedVersion}
      </p>
    {/if}
    <p style="margin: 0;">
      Versión mínima requerida: Chrome {result.minimumVersion}
    </p>
  </div>
  <div
    bind:this={buttonEl}
    tabindex="0"
    role="button"
    aria-label="Abrir Google Play para actualizar WebView"
    onclick={handleAction}
    onkeydown={handleKeyDown}
    class="hover:bg-[#e0e0e0] focus:border-white focus:shadow-[0_0_0_4px_rgba(255,255,255,0.3)]"
    style="margin-top: 48px; padding: 16px 48px; font-size: 22px; font-weight: bold; color: #000000; background-color: #ffffff; border-radius: 999px; cursor: pointer; outline: none; border: 3px solid transparent; transition: none;"
  >
    Actualizar WebView
  </div>
</div>
