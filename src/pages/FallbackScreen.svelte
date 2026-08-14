<script lang="ts">
  import { replace } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { toastStore } from '@/stores/toastStore';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';

  $effect(() => {
    toastStore.getState().show('Error inesperado. Intenta de nuevo.', 'error', 5000);
    setTimeout(() => {
      setFocus('fallback-retry');
    }, 50);
  });
</script>

<FocusContainer
  focusKey="fallback-root"
  preferredChildFocusKey="fallback-retry"
  trackChildren={true}
  class="w-full h-dvh flex flex-col items-center justify-center gap-8 px-8 bg-bg"
>
  <p class="text-text-secondary text-[clamp(1rem,1.4vw,1.25rem)] text-center max-w-md">
    Algo salió mal. Por favor, intenta de nuevo.
  </p>
  <Focusable
    focusKey="fallback-retry"
    onEnterPress={() => replace('/home')}
    focusedClass="!bg-white !text-black scale-105"
    class="h-[clamp(2.5rem,4vh,3rem)] px-[clamp(2rem,3vw,3rem)] rounded-full bg-surface text-white text-[clamp(0.875rem,1.25vw,1rem)] font-medium transition-all duration-200 cursor-pointer inline-flex items-center"
    playSound={true}
  >
    {#snippet children()}
      Reintentar
    {/snippet}
  </Focusable>
</FocusContainer>
