<script lang="ts">
  import { formatTime } from '@/utils/helpers';

  const ACCENT = '#FFFFFF';

  interface Props {
    videoEl: HTMLVideoElement | null;
    duration: number;
    chapterMarks?: number[];
  }

  let { videoEl, duration, chapterMarks = [] }: Props = $props();

  let fillEl = $state<HTMLDivElement | null>(null);
  let bufferedEl = $state<HTMLDivElement | null>(null);
  let thumbEl = $state<HTMLDivElement | null>(null);
  let currentTimeLabelEl = $state<HTMLSpanElement | null>(null);

  $effect(() => {
    const video = videoEl;
    if (!video) return;

    let rafId: number | null = null;
    let lastPct = -1;
    const THRESHOLD = 0.5;

    const update = () => {
      if (video.paused) {
        rafId = requestAnimationFrame(update);
        return;
      }
      const dur = video.duration || 0;
      const ct = video.currentTime;
      const pct = dur > 0 ? (ct / dur) * 100 : 0;

      if (Math.abs(pct - lastPct) > THRESHOLD) {
        lastPct = pct;
        let bufferedEnd = 0;
        if (video.buffered.length > 0) {
          bufferedEnd = video.buffered.end(video.buffered.length - 1);
        }
        const bufferedPct = dur > 0 ? (bufferedEnd / dur) * 100 : 0;

        if (fillEl) fillEl.style.width = `${pct}%`;
        if (bufferedEl) bufferedEl.style.width = `${bufferedPct}%`;
        if (thumbEl) thumbEl.style.left = `${pct}%`;
        if (currentTimeLabelEl) currentTimeLabelEl.textContent = formatTime(ct);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  });
</script>

<div class="seekbar-group flex items-center gap-4 h-full">
  <span bind:this={currentTimeLabelEl} class="text-white/90 text-sm font-medium w-14 text-right tabular-nums">
    0:00
  </span>

  <div class="seekbar-track relative flex-1 h-10 flex items-center cursor-pointer group">
    <div class="relative z-0 h-[4px] w-full rounded-full bg-white/[0.16] transition-all duration-200 ease-out group-hover:h-[6px]">
      <div bind:this={bufferedEl} class="absolute inset-y-0 left-0 bg-white/[0.12] rounded-full" style="width: 0%;"></div>
      <div
        bind:this={fillEl}
        class="absolute inset-y-0 left-0 rounded-full"
        style="width: 0%; background-color: {ACCENT}; box-shadow: 0 0 10px {ACCENT}55;"
      ></div>

      {#each chapterMarks as pct, i (i)}
        <div
          class="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-black/50 rounded-full"
          style="left: {pct}%;"
        ></div>
      {/each}
    </div>

    <div
      bind:this={thumbEl}
      class="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full border-2 border-white bg-white opacity-0 transition-all duration-200 ease-out group-hover:opacity-100"
      style="left: -7px;"
    ></div>
  </div>

  <span class="text-white/40 text-sm font-medium w-14 tabular-nums">
    {formatTime(duration)}
  </span>
</div>
