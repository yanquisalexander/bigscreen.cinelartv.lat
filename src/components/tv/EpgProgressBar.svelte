<script lang="ts">
  import type { LiveTvProgram } from '@/api/live';

  interface Props {
    program: LiveTvProgram;
    class?: string;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }

  let { program, class: className = '', showLabel = true, size = 'md' }: Props = $props();

  let now = $state(Date.now());
  let rafId = 0;

  $effect(() => {
    const tick = () => {
      now = Date.now();
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  const progress = $derived.by(() => {
    const start = new Date(program.start_time).getTime();
    const end = new Date(program.end_time).getTime();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  });

  const remaining = $derived.by(() => {
    const end = new Date(program.end_time).getTime();
    const diff = Math.max(0, end - now);
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return 'Terminando';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`;
  });

  const heightClass = $derived(
    size === 'sm' ? 'h-[3px]' : size === 'lg' ? 'h-[5px]' : 'h-[4px]',
  );
</script>

<div class="flex items-center gap-2 {className}">
  <div class="flex-1 {heightClass} rounded-full bg-white/10 overflow-hidden">
    <div
      class="h-full rounded-full bg-accent-light transition-[width] duration-1000 linear"
      style="width: {progress}%"
    ></div>
  </div>
  {#if showLabel}
    <span class="text-accent-light text-[clamp(0.55rem,0.7vw,0.65rem)] font-medium shrink-0 tabular-nums">
      {remaining}
    </span>
  {/if}
</div>
