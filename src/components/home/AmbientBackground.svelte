<script lang="ts">
  import { getRuntimeConfig } from '@/runtime';
  import { svelteAmbientStore } from '@/stores/ambientStore';

  const { appQuality } = getRuntimeConfig();
  const enabled = appQuality !== 'LITE';

  let urlA = $state<string | null>(null);
  let urlB = $state<string | null>(null);
  let activeSlot = $state<'a' | 'b'>('a');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasContent = $state(false);

  $effect(() => {
    if (!enabled) return;
    const url = $svelteAmbientStore.backdropUrl;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!url) {
        urlA = null;
        urlB = null;
        hasContent = false;
        return;
      }
      if (activeSlot === 'a') {
        urlB = url;
        activeSlot = 'b';
      } else {
        urlA = url;
        activeSlot = 'a';
      }
      requestAnimationFrame(() => { hasContent = true; });
    }, 700);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });
</script>

{#if enabled}
  <div
    class="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-1000 ease-in-out"
    style="opacity: {hasContent ? 1 : 0};"
  >
    {#if urlA}
      <img
        src={urlA}
        alt=""
        class="ambient-blur absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out brightness-[0.06] saturate-[0.35]"
        class:opacity-100={activeSlot === 'a'}
        class:opacity-0={activeSlot !== 'a'}
      />
    {/if}
    {#if urlB}
      <img
        src={urlB}
        alt=""
        class="ambient-blur absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out brightness-[0.06] saturate-[0.35]"
        class:opacity-100={activeSlot === 'b'}
        class:opacity-0={activeSlot !== 'b'}
      />
    {/if}
    {#if hasContent}
      <div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/75"></div>
    {/if}
  </div>
{/if}
