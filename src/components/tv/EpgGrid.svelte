<script lang="ts">
  import Focusable from '@/components/tv/Focusable.svelte';
  import { getChannelGuide, type LiveTvChannel, type LiveTvProgram } from '@/api/live';
  import { getRuntimeConfig } from '@/runtime';
  import { Tv, Play } from '@lucide/svelte';

  interface Props {
    channels: LiveTvChannel[];
    accessToken?: string;
    onPlay: (channel: LiveTvChannel) => void;
    onArrowUp?: () => boolean;
    onReady?: (firstFocusKey: string | null) => void;
  }

  interface EpgBlock {
    program: LiveTvProgram;
    left: number;
    width: number;
    isLive: boolean;
    isCurrent: boolean;
    isPast: boolean;
    category: string | null;
    startMin: number;
    endMin: number;
  }

  let {
    channels,
    accessToken,
    onPlay,
    onArrowUp,
    onReady,
  }: Props = $props();

  // --- Timeline window (anchored to the current hour so widths stay stable) ---
  const PX_PER_MIN = 4.0; // px of horizontal space per minute => 1h = 240px
  const WINDOW_HOURS = 8;
  const ROW_H = 70; // compact and super clean per-channel row height
  const CHANNEL_COL_W = 110; // YouTube TV style: narrow logo-only column

  let now = $state(Date.now());
  let guides = $state<Record<string, LiveTvProgram[]>>({});
  let guideState = $state<Record<string, 'loading' | 'ready' | 'error'>>({});
  let scrollEl = $state<HTMLDivElement | null>(null);
  let headerOffsetX = $state(0);
  let rafId = 0;

  const { appQuality } = getRuntimeConfig();
  const canAnimate = appQuality !== 'LITE';

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  // Recompute anchor every minute so the window doesn't jump mid-hour
  $effect(() => {
    const tick = () => {
      now = Date.now();
    };
    const id = setInterval(tick, 60_000);
    tick();
    return () => clearInterval(id);
  });

  const anchorMinute = $derived.by(() => {
    const d = new Date(now);
    d.setMinutes(0, 0, 0); // top of the current hour
    return d;
  });

  const windowStartMs = $derived(anchorMinute.getTime());
  const windowEndMs = $derived(windowStartMs + WINDOW_HOURS * 3600_000);
  const totalMin = $derived(WINDOW_HOURS * 60);
  const trackWidth = $derived(totalMin * PX_PER_MIN);

  const nowOffsetPx = $derived(
    clamp(Math.round(((now - windowStartMs) / 60000) * PX_PER_MIN), 0, trackWidth),
  );

  const hourTicks = $derived.by(() => {
    const nowHourStart = new Date(now);
    nowHourStart.setMinutes(0, 0, 0);
    const nowHour = nowHourStart.getTime();
    const ticks: { label: string; left: number; isNow: boolean }[] = [];
    for (let h = 0; h <= WINDOW_HOURS; h++) {
      const d = new Date(windowStartMs + h * 3600_000);
      ticks.push({
        label: d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
        left: h * 60 * PX_PER_MIN,
        isNow: d.getTime() === nowHour,
      });
    }
    return ticks;
  });

  // --- EPG data fetching (per channel, cached) ---
  function loadGuide(channel: LiveTvChannel) {
    if (guides[channel.id] || guideState[channel.id]) return;
    guideState = { ...guideState, [channel.id]: 'loading' };
    getChannelGuide(
      channel.id,
      new Date(windowStartMs).toISOString(),
      new Date(windowEndMs).toISOString(),
      accessToken,
    )
      .then((res) => {
        guides = { ...guides, [channel.id]: res.programs };
        guideState = { ...guideState, [channel.id]: 'ready' };
      })
      .catch(() => {
        guideState = { ...guideState, [channel.id]: 'error' };
      });
  }

  $effect(() => {
    if (channels.length) {
      channels.forEach(loadGuide);
    }
  });

  // Fall back to payload data (current + upcoming) when guide not loaded yet
  const channelBlocks = $derived.by(() => {
    return channels.map((ch) => {
      const list = guides[ch.id]?.length
        ? guides[ch.id]
        : [
            ...(ch.current_program ? [ch.current_program] : []),
            ...(ch.upcoming_programs ?? []),
          ];

      const blocks = list
        .map((p) => {
          const s = Math.max(new Date(p.start_time).getTime(), windowStartMs);
          const e = Math.min(new Date(p.end_time).getTime(), windowEndMs);
          const durMin = (e - s) / 60000;
          if (durMin <= 0 || e <= s) return null;
          const left = Math.round(((s - windowStartMs) / 60000) * PX_PER_MIN);
          const width = Math.max(Math.round(durMin * PX_PER_MIN), 2);
          const isLive = Boolean(p.currently_playing);
          const isCurrent = now >= s && now <= e;
          const isPast = e < now;
          return {
            program: p,
            left,
            width,
            isLive,
            isCurrent,
            isPast,
            category: p.category,
            startMin: new Date(p.start_time).getTime(),
            endMin: new Date(p.end_time).getTime(),
          };
        })
        .filter((b): b is NonNullable<typeof b> => b !== null && b.width >= 20);

      return { channel: ch, blocks, state: guideState[ch.id] };
    });
  });

  const blockKey = (channelId: string, program: LiveTvProgram, left: number) =>
    `epg-${channelId}-${program.id}-${left}`;

  // Prefer the currently-"on air" (NOW/LIVE) block of a channel so vertical entry
  // from the category bar lands on the program that is actually airing (hierarchical),
  // then fall back to the first block, then the no-program placeholder.
  const entryKeyOfChannel = (channel: LiveTvChannel, blocks: EpgBlock[]) => {
    if (blocks.length === 0) return `epg-${channel.id}-noprogram`;
    const current = blocks.find((b) => b.isCurrent || b.isLive) ?? blocks[0];
    return blockKey(channel.id, current.program, current.left);
  };

  const firstFocusKey = $derived.by(() => {
    for (const { channel, blocks, state } of channelBlocks) {
      if (state !== 'loading') {
        return entryKeyOfChannel(channel, blocks);
      }
    }
    return null;
  });

  $effect(() => {
    onReady?.(firstFocusKey);
  });

  let _focusObserver: MutationObserver | null = null;

  function scrollToFocused() {
    const container = scrollEl;
    if (!container) return;
    if (_focusObserver) { _focusObserver.disconnect(); _focusObserver = null; }

    const tryScroll = () => {
      const focused = container.querySelector<HTMLElement>('[data-focused="true"]');
      if (!focused) return false;

      const containerRect = container.getBoundingClientRect();
      const focusedRect = focused.getBoundingClientRect();

      const offsetY = focusedRect.top - containerRect.top;
      const targetY = container.scrollTop + offsetY - (containerRect.height / 2) + (focusedRect.height / 2);

      let targetX = container.scrollLeft;
      if (focusedRect.width < containerRect.width) {
        const offsetX = focusedRect.left - containerRect.left;
        targetX = container.scrollLeft + offsetX - (containerRect.width / 2) + (focusedRect.width / 2);
      }

      container.scrollTo({ top: targetY, left: targetX, behavior: canAnimate ? 'smooth' : 'auto' });
      return true;
    };

    if (tryScroll()) return;

    const observer = new MutationObserver(() => {
      if (tryScroll()) { observer.disconnect(); _focusObserver = null; }
    });
    _focusObserver = observer;
    observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });
    setTimeout(() => { observer.disconnect(); _focusObserver = null; }, 1000);
  }

  function handleFocusScroll() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(scrollToFocused);
  }

  function onBodyScroll() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      headerOffsetX = scrollEl?.scrollLeft ?? 0;
    });
  }

  function formatTime(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div
  class="h-full w-full overflow-hidden flex flex-col bg-[#0e0e10]"
  style="--row-h: {ROW_H}px; --col-w: {CHANNEL_COL_W}px;"
>
  <!-- Fixed header: owns its own space, never overlaps the rows below -->
  <div
    class="flex shrink-0 bg-bg border-b border-white/10"
    style="height: var(--row-h);"
  >
    <div
      class="w-[var(--col-w)] shrink-0 flex items-center justify-center bg-bg border-r border-white/10 text-text-secondary"
    >
      <span class="text-[10px] font-black uppercase tracking-widest text-white/50">
        Canales
      </span>
    </div>
    <div class="relative flex-1 overflow-hidden">
      <div
        class="relative h-full"
        style="width: {trackWidth}px; transform: translateX({-headerOffsetX}px);"
      >
        {#each hourTicks as tick (tick.left)}
          <div
            class="absolute top-0 h-full border-l border-white/10 flex items-start justify-center px-2 tabular-nums {tick.isNow
              ? 'text-white font-bold'
              : 'text-text-secondary'} text-[clamp(0.6rem,0.75vw,0.7rem)]"
            style="left: {tick.left}px; margin-left: -0.5px;"
          >
            <span class="mt-6">{tick.label}</span>
          </div>
        {/each}
        <!-- NOW line -->
        {#if nowOffsetPx > 0 && nowOffsetPx < trackWidth}
          <div class="absolute top-0 bottom-0 z-10 pointer-events-none" style="left: {nowOffsetPx}px;">
            <div class="h-full w-[2px] bg-live/80"></div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Scrollable body -->
  <div
    bind:this={scrollEl}
    onscroll={onBodyScroll}
    class="flex-1 overflow-auto hide-scrollbar bg-bg"
  >
    <div class="relative" style="width: {CHANNEL_COL_W + trackWidth}px;">
      <!-- Full-height NOW line in body -->
      {#if nowOffsetPx > 0 && nowOffsetPx < trackWidth}
        <div class="absolute top-0 bottom-0 z-10 pointer-events-none" style="left: {CHANNEL_COL_W + nowOffsetPx}px;">
          <div class="h-full w-[2px] bg-live/80"></div>
        </div>
      {/if}
      <!-- Channel rows -->
      {#each channelBlocks as { channel, blocks, state }, rowIdx (channel.id)}
        <div class="flex border-b border-white/5">
          <!-- Channel label (sticky left) -->
          <div
            class="sticky left-0 !z-30 shrink-0 flex items-center justify-center bg-bg border-r border-white/10"
            style="width: var(--col-w); height: var(--row-h);"
          >
            <div class="w-12 h-12 rounded-xl bg-surface/50 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
              {#if channel.logo_url}
                <img
                  src={channel.logo_url}
                  alt={channel.name}
                  class="w-10 h-10 object-contain"
                  loading="lazy"
                />
              {:else}
                <Tv class="w-5 h-5 text-text-secondary" />
              {/if}
            </div>
          </div>

          <!-- Program track -->
          <div class="relative" style="width: {trackWidth}px; height: var(--row-h);">
            {#if blocks.length === 0 && state !== 'loading'}
              <!-- No schedule: full-track focusable placeholder so the channel stays reachable -->
              <Focusable
                focusKey="epg-{channel.id}-noprogram"
                onEnterPress={() => onPlay(channel)}
                onArrowPress={(direction) => {
                  if (direction === 'up' && rowIdx === 0 && onArrowUp) {
                    return onArrowUp();
                  }
                  return true;
                }}
                onFocus={handleFocusScroll}
                focusedClass={!canAnimate ? '!z-20' : '!z-20 scale-[1.01]'}
                class="absolute inset-y-1.5 left-2 right-2 rounded-lg cursor-pointer transition-transform"
                style="transition-duration: var(--animation-duration);"
                playSound={true}
              >
                {#snippet children({ focused })}
                  <div
                    class="w-full h-full rounded-lg border flex items-center px-4 transition-all {focused
                      ? 'border-white bg-white text-black shadow-lg shadow-black/30'
                      : 'border-white/5 bg-[#1d1d1f]/40 text-white/30 border-dashed'}"
                    style="transition-duration: var(--animation-duration);"
                  >
                    <p class="truncate font-semibold text-[clamp(0.75rem,0.9vw,0.85rem)] leading-none">
                      Sin programación disponible
                    </p>
                  </div>
                {/snippet}
              </Focusable>
            {:else}
              {#each blocks as block (block.program.id + block.left)}
                <Focusable
                  focusKey="epg-{channel.id}-{block.program.id}-{block.left}"
                  onEnterPress={() => onPlay(channel)}
                  onArrowPress={(direction) => {
                    if (direction === 'up' && rowIdx === 0 && onArrowUp) {
                      return onArrowUp();
                    }
                    return true;
                  }}
                  onFocus={handleFocusScroll}
                  focusedClass={!canAnimate ? '!z-20' : '!z-20 scale-[1.01]'}
                  class="absolute top-1.5 bottom-1.5 px-1 cursor-pointer transition-transform"
                  style="left: {block.left}px; width: {block.width}px; transition-duration: var(--animation-duration);"
                  playSound={true}
                >
                  {#snippet children({ focused })}
                    <div
                      class="w-full h-full rounded-lg border flex items-center px-4 transition-all {focused
                        ? 'border-white bg-white text-black shadow-lg shadow-black/30'
                        : 'border-white/5 bg-[#1d1d1f] text-white/90 hover:bg-[#232326]'}"
                      style="transition-duration: var(--animation-duration);"
                    >
                      <p class="truncate font-semibold text-[clamp(0.75rem,0.9vw,0.85rem)] leading-none">
                        {block.program.title}
                      </p>
                    </div>
                  {/snippet}
                </Focusable>
              {/each}
            {/if}

            <!-- Placeholder while loading -->
            {#if state === 'loading' && blocks.length === 0}
              <div class="absolute inset-y-1.5 left-2 right-2 flex items-center gap-3 px-4 rounded-lg border border-white/5 bg-[#1d1d1f]">
                <div class="flex-1 h-3 rounded bg-white/5 {canAnimate ? 'animate-pulse' : ''}"></div>
                <div class="w-1/4 h-3 rounded bg-white/[0.03] {canAnimate ? 'animate-pulse' : ''}"></div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
