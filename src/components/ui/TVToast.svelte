<script lang="ts">
  import { svelteToastStore } from '@/stores/toastStore';

  let animState = $state<'in' | 'out' | 'hidden'>('hidden');

  $effect(() => {
    const isVis = $svelteToastStore.visible;
    if (isVis) {
      animState = 'in';
    } else if (animState === 'in') {
      animState = 'out';
      const timer = setTimeout(() => {
        animState = 'hidden';
      }, 250);
      return () => clearTimeout(timer);
    }
  });

  const hasTitle = $derived(Boolean($svelteToastStore.title));
</script>

{#if animState !== 'hidden'}
  <div
    class="fixed top-0 right-0 z-[9999] {animState === 'in' ? 'animate-toast-in' : 'animate-toast-out'}"
    style="margin-top: clamp(1.5rem, 3.5vh, 3rem); margin-right: clamp(1.5rem, 3.5vw, 3rem);"
  >
    <div
      class="shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      style="background-color: #181818; border-radius: 0.75rem; max-width: 23rem; width: auto; padding: clamp(0.875rem, 1.8vh, 1.125rem) clamp(1rem, 1.8vw, 1.25rem);"
    >
      {#if hasTitle}
        <p
          class="text-white font-semibold leading-snug"
          style="font-size: clamp(0.9375rem, 1.2vw, 1rem); white-space: normal; overflow-wrap: anywhere;"
        >
          {$svelteToastStore.title}
        </p>
        <p
          class="text-white/70 leading-snug"
          style="font-size: clamp(0.8125rem, 1vw, 0.875rem); margin-top: clamp(0.25rem, 0.6vh, 0.375rem); white-space: normal; overflow-wrap: anywhere;"
        >
          {$svelteToastStore.message}
        </p>
      {:else}
        <p
          class="text-white/80 leading-snug"
          style="font-size: clamp(0.875rem, 1.1vw, 0.9375rem); white-space: normal; overflow-wrap: anywhere;"
        >
          {$svelteToastStore.message}
        </p>
      {/if}
    </div>
  </div>
{/if}
