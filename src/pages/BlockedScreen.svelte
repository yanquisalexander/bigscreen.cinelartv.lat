<script lang="ts">
  import { MapPinOff } from '@lucide/svelte';
  import { checkGeoBlock, clearGeoCache, getGeoblockConfig } from '@/services/geoblocking';
  import FocusableButton from '@/components/tv/FocusableButton.svelte';
  import CinelarLogo from '@/components/ui/CinelarLogo.svelte';

  type BlockStatus = 'idle' | 'checking' | 'still-blocked' | 'error';

  let status = $state<BlockStatus>('idle');
  let busy = false;

  const cfg = getGeoblockConfig();

  async function handleRetry(clearCache: boolean) {
    if (busy) return;
    busy = true;
    status = 'checking';

    try {
      if (clearCache) await clearGeoCache();
      const geo = await checkGeoBlock();

      if (!geo.blocked) {
        window.location.href = '/';
        return;
      }

      status = 'still-blocked';
    } catch (e) {
      console.warn('Geo-check failed', e);
      status = 'error';
    } finally {
      busy = false;
    }
  }

  const checking = $derived(status === 'checking');
</script>

<main class="relative w-full h-dvh overflow-hidden flex flex-col items-center justify-center bg-bg px-[clamp(2rem,6vw,5rem)] text-center">
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_38%,rgba(0,132,240,0.10),transparent_70%)]"
  ></div>

  <CinelarLogo class="absolute top-[clamp(1.5rem,4vh,2.5rem)] left-[clamp(1.5rem,3vw,3rem)] h-[clamp(1.75rem,3.5vh,2.25rem)] w-auto text-white" />

  <div class="relative flex flex-col items-center max-w-[42rem]">
    <div class="w-[clamp(4.5rem,10vh,6.5rem)] h-[clamp(4.5rem,10vh,6.5rem)] rounded-full bg-live/10 ring-1 ring-live/30 flex items-center justify-center mb-[clamp(2.25rem,6vh,3.5rem)]">
      <MapPinOff
        class="w-[clamp(2rem,4.5vh,2.75rem)] h-[clamp(2rem,4.5vh,2.75rem)] text-live"
        strokeWidth={1.75}
      />
    </div>

    <h1 class="text-white font-bold tracking-tight text-[clamp(2rem,4.5vw,2.75rem)] leading-tight mb-[clamp(1.25rem,3vh,2rem)]">
      Contenido no disponible
    </h1>

    <p class="text-text-secondary text-[clamp(1.125rem,1.8vw,1.375rem)] leading-relaxed mb-[clamp(2.5rem,7vh,4rem)]">
      {cfg.message || 'Esta aplicación no está disponible en tu ubicación actual.'}
    </p>

    {#if status === 'error'}
      <p
        role="alert"
        class="text-live text-[clamp(1rem,1.5vw,1.25rem)] mb-[clamp(1.5rem,4vh,2.5rem)]"
      >
        No pudimos verificar tu ubicación. Inténtalo nuevamente.
      </p>
    {/if}

    {#if status === 'still-blocked'}
      <p
        role="status"
        class="text-text-secondary text-[clamp(1rem,1.5vw,1.25rem)] mb-[clamp(1.5rem,4vh,2.5rem)]"
      >
        Tu ubicación sigue sin estar disponible. Podés intentar de nuevo.
      </p>
    {/if}

    <FocusableButton
      onEnterPress={() => handleRetry(false)}
      variant="primary"
      size="lg"
      autoFocus={true}
      playSound={true}
      focusKey="blocked-retry"
      class="min-h-[clamp(4rem,7vh,4.5rem)] min-w-[clamp(15rem,24vw,22rem)] !text-[clamp(1.125rem,1.6vw,1.375rem)]"
      focusedClass="scale-105 shadow-[0_0_45px_rgba(0,132,240,0.5)]"
    >
      {#snippet children()}
        {#if checking}
          <span class="inline-flex items-center gap-[0.75em]">
            <span
              aria-hidden="true"
              class="w-[1.15em] h-[1.15em] border-2 border-black/25 border-t-black rounded-full animate-spin"
            ></span>
            Verificando ubicación…
          </span>
        {:else}
          Intentar nuevamente
        {/if}
      {/snippet}
    </FocusableButton>

    <FocusableButton
      onEnterPress={() => handleRetry(true)}
      variant="ghost"
      size="md"
      playSound={true}
      focusKey="blocked-recheck"
      class="mt-[clamp(1.25rem,3vh,2rem)]"
      focusedClass="!bg-white/10 !border-white/40 scale-105"
    >
      {#snippet children()}
        ¿Cambiaste de ubicación? Verificar de nuevo
      {/snippet}
    </FocusableButton>

    <code class="mt-[clamp(3rem,8vh,5rem)] text-text-tertiary text-[clamp(0.75rem,1vw,0.875rem)] tracking-wider">
      ERR_GEO_BLOCKED
    </code>
  </div>
</main>
