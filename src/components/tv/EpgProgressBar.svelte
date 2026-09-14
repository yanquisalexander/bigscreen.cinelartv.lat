<script lang="ts">
  import type { LiveTvProgram } from '@/api/live';

  interface Props {
    program: LiveTvProgram;
    class?: string;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }

  let { program, class: className = '', showLabel = true, size = 'md' }: Props = $props();

  let barEl = $state<HTMLDivElement | null>(null);
  let labelEl = $state<HTMLSpanElement | null>(null);

  const heightClass = $derived(
    size === 'sm' ? 'h-[3px]' : size === 'lg' ? 'h-[5px]' : 'h-[4px]',
  );

  $effect(() => {
    let rafId = 0;
    const tick = () => {
      const now = Date.now();
      const start = new Date(program.start_time).getTime();
      const end = new Date(program.end_time).getTime();
      const progress = end <= start ? 100 : Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
      if (barEl) barEl.style.width = `${progress}%`;
      if (labelEl && showLabel) {
        const diff = Math.max(0, end - now);
        const mins = Math.round(diff / 60000);
        labelEl.textContent = mins <= 0 ? 'Terminando' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });
</script>

<div class="flex items-center gap-2 {className}">
  <div class="flex-1 {heightClass} rounded-full bg-white/10 overflow-hidden">
    <div
      bind:this={barEl}
      class="h-full rounded-full bg-accent-light"
      style="width: 0%; transition: width 1s linear;"
    ></div>
  </div>
  {#if showLabel}
    <span
      bind:this={labelEl}
      class="text-accent-light text-[clamp(0.55rem,0.7vw,0.65rem)] font-medium shrink-0 tabular-nums"
    ></span>
  {/if}
</div>
