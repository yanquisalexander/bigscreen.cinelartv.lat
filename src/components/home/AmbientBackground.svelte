<script lang="ts">
  import { getRuntimeConfig } from '@/runtime';
  import { svelteAmbientStore } from '@/stores/ambientStore';

  const { appQuality } = getRuntimeConfig();
  const enabled = appQuality !== 'LITE';

  const canvasSize = appQuality === 'FULL_ANIMATION'
    ? { w: 64, h: 36 }
    : { w: 32, h: 18 };

  let canvasA: HTMLCanvasElement;
  let canvasB: HTMLCanvasElement;
  let activeSlot = $state<'a' | 'b'>('a');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasContent = $state(false);

  function drawToCanvas(canvas: HTMLCanvasElement, url: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = url;
  }

  $effect(() => {
    if (!enabled) return;
    const url = $svelteAmbientStore.backdropUrl;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!url) {
        hasContent = false;
        return;
      }
      const target = activeSlot === 'a' ? canvasB : canvasA;
      drawToCanvas(target, url);
      activeSlot = activeSlot === 'a' ? 'b' : 'a';
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
    <canvas
      width={canvasSize.w}
      height={canvasSize.h}
      bind:this={canvasA}
      aria-hidden="true"
      class="ambient-canvas absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out"
      class:opacity-100={activeSlot === 'a'}
      class:opacity-0={activeSlot !== 'a'}
    ></canvas>
    <canvas
      width={canvasSize.w}
      height={canvasSize.h}
      bind:this={canvasB}
      aria-hidden="true"
      class="ambient-canvas absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out"
      class:opacity-100={activeSlot === 'b'}
      class:opacity-0={activeSlot !== 'b'}
    ></canvas>
    {#if hasContent}
      <div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/75"></div>
    {/if}
  </div>
{/if}
