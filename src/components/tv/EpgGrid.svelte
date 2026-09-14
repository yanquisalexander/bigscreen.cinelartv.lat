
<script lang="ts">
  import Focusable from '@/components/tv/Focusable.svelte';
  import { getChannelGuide, type LiveTvChannel, type LiveTvProgram } from '@/api/live';
  import { getRuntimeConfig } from '@/runtime';
  import { Tv } from '@lucide/svelte';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import { tick } from 'svelte';

  interface Props {
    channels: LiveTvChannel[];
    accessToken?: string;
    onPlay: (channel: LiveTvChannel) => void;
    onArrowUp?: () => boolean;
    onReady?: (firstFocusKey: string | null) => void;
  }

  interface PrecomputedProgram {
    program: LiveTvProgram;
    startMs: number;
    endMs: number;
  }

  interface EpgBlock {
    program: LiveTvProgram;
    left: number;
    width: number;
    isLive: boolean;
    isCurrent: boolean;
    isPast: boolean;
    category: string | null;
  }

  let {
    channels,
    accessToken,
    onPlay,
    onArrowUp,
    onReady,
  }: Props = $props();

  const PX_PER_MIN = 4.0;
  const WINDOW_HOURS = 6;
  const ROW_H = 70;
  const CHANNEL_COL_W = 110;
  const ROW_OVERSCAN = 3;
  const BLOCK_OVERSCAN_PX = 200;

  let guides = $state<Record<string, PrecomputedProgram[]>>({});
  let guideState = $state<Record<string, 'loading' | 'ready' | 'error'>>({});
  let scrollEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let scrollLeft = $state(0);
  let viewportH = $state(0);
  let focusedProgram = $state<LiveTvProgram | null>(null);
  let focusedChannel = $state<LiveTvChannel | null>(null);

  let focusRafId = 0;
  let scrollRafId = 0;
  let _scrollQueued = false;
  let _scrollSource: 'user' | 'programmatic' = 'user';

  const { appQuality } = getRuntimeConfig();

  function clamp(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  let nowMinute = $state(Date.now());

  $effect(() => {
    const id = setInterval(() => { nowMinute = Date.now(); }, 60_000);
    nowMinute = Date.now();
    return () => clearInterval(id);
  });

  // ── RAF loop: direct DOM updates for now-line and header scroll sync ──
  // No Svelte $state reads inside the callback — pure DOM manipulation.
  $effect(() => {
    let rafId = 0;
    const tick = () => {
      const wStart = windowStartMs;
      const tW = trackWidth;
      if (tW > 0) {
        const px = clamp(Math.round(((Date.now() - wStart) / 60000) * PX_PER_MIN), 0, tW);
        const headerNow = document.querySelector<HTMLElement>('[data-now-line-header]');
        const gridNow = document.querySelector<HTMLElement>('[data-now-line-grid]');
        if (headerNow) headerNow.style.transform = `translateX(${px}px)`;
        if (gridNow) gridNow.style.transform = `translateX(${CHANNEL_COL_W + px}px)`;
      }
      // Sync header scroll offset (avoids reactive scrollLeft re-renders)
      const scrollContent = document.querySelector<HTMLElement>('[data-scroll-content]');
      const scroll = document.querySelector<HTMLElement>('[data-scroll-container]');
      if (scrollContent && scroll) {
        scrollContent.style.transform = `translateX(${-scroll.scrollLeft}px)`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  const anchorMinute = $derived.by(() => {
    const d = new Date(nowMinute);
    d.setMinutes(0, 0, 0);
    return d;
  });

  const windowStartMs = $derived(anchorMinute.getTime());
  const windowEndMs = $derived(windowStartMs + WINDOW_HOURS * 3600_000);
  const totalMin = WINDOW_HOURS * 60;
  const trackWidth = totalMin * PX_PER_MIN;

  const hourTicks = $derived.by(() => {
    const nowHourStart = new Date(nowMinute);
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

  let _loaded = new Set<string>();
  let _pendingGuides = new Map<string, PrecomputedProgram[]>();
  let _pendingStates = new Map<string, 'loading' | 'ready' | 'error'>();
  let _guideFlushQueued = false;

  function flushGuideUpdates() {
    _guideFlushQueued = false;
    if (_pendingGuides.size > 0) {
      const newGuides = { ...guides };
      for (const [id, progs] of _pendingGuides) newGuides[id] = progs;
      guides = newGuides;
      _pendingGuides.clear();
    }
    if (_pendingStates.size > 0) {
      const newStates = { ...guideState };
      for (const [id, st] of _pendingStates) newStates[id] = st;
      guideState = newStates;
      _pendingStates.clear();
    }
  }

  function queueGuideUpdate(channelId: string, progs: PrecomputedProgram[], state: 'loading' | 'ready' | 'error') {
    _pendingGuides.set(channelId, progs);
    _pendingStates.set(channelId, state);
    if (!_guideFlushQueued) {
      _guideFlushQueued = true;
      queueMicrotask(flushGuideUpdates);
    }
  }

  function loadGuides(list: LiveTvChannel[]) {
    const toLoad = list.filter((ch) => !_loaded.has(ch.id));
    if (!toLoad.length) return;
    toLoad.forEach((ch) => _loaded.add(ch.id));

    const startIso = new Date(windowStartMs).toISOString();
    const endIso = new Date(windowEndMs).toISOString();

    for (const ch of toLoad) {
      queueGuideUpdate(ch.id, [], 'loading');

      getChannelGuide(ch.id, startIso, endIso, accessToken)
        .then((res) => {
          const precomputed: PrecomputedProgram[] = res.programs.map((p) => ({
            program: p,
            startMs: new Date(p.start_time).getTime(),
            endMs: new Date(p.end_time).getTime(),
          }));
          queueGuideUpdate(ch.id, precomputed, 'ready');
        })
        .catch(() => {
          queueGuideUpdate(ch.id, [], 'error');
        });
    }
  }

  $effect(() => {
    if (channels.length) loadGuides(channels);
  });

  function computeBlocks(ch: LiveTvChannel, now: number): EpgBlock[] {
    const precomputed = guides[ch.id];
    const list: PrecomputedProgram[] = precomputed?.length
      ? precomputed
      : [
          ...(ch.current_program ? [{
            program: ch.current_program,
            startMs: new Date(ch.current_program.start_time).getTime(),
            endMs: new Date(ch.current_program.end_time).getTime(),
          }] : []),
          ...(ch.upcoming_programs ?? []).map((p) => ({
            program: p,
            startMs: new Date(p.start_time).getTime(),
            endMs: new Date(p.end_time).getTime(),
          })),
        ];

    const blocks: EpgBlock[] = [];
    for (const pp of list) {
      const s = Math.max(pp.startMs, windowStartMs);
      const e = Math.min(pp.endMs, windowEndMs);
      const durMin = (e - s) / 60000;
      if (durMin <= 0 || e <= s) continue;
      const left = Math.round(((s - windowStartMs) / 60000) * PX_PER_MIN);
      const width = Math.max(Math.round(durMin * PX_PER_MIN), 2);
      if (width < 20) continue;
      blocks.push({
        program: pp.program,
        left,
        width,
        isLive: Boolean(pp.program.currently_playing),
        isCurrent: now >= s && now <= e,
        isPast: e < now,
        category: pp.category,
      });
    }
    return blocks;
  }

  const channelRows = $derived(
    channels.map((ch) => ({
      channel: ch,
      state: guideState[ch.id] as 'loading' | 'ready' | 'error' | undefined,
    })),
  );

  let _blocksCache = new Map<string, EpgBlock[]>();
  let _blocksCacheTime = 0;

  function getBlocksForRow(ch: LiveTvChannel): EpgBlock[] {
    const minuteKey = Math.floor(nowMinute / 60000);
    const cacheKey = ch.id;
    if (minuteKey === _blocksCacheTime && _blocksCache.has(cacheKey)) {
      return _blocksCache.get(cacheKey)!;
    }
    if (minuteKey !== _blocksCacheTime) {
      _blocksCache.clear();
      _blocksCacheTime = minuteKey;
    }
    const blocks = computeBlocks(ch, nowMinute);
    _blocksCache.set(cacheKey, blocks);
    return blocks;
  }

  const blockKey = (channelId: string, program: LiveTvProgram, left: number) =>
    `epg-${channelId}-${program.id}-${left}`;

  const entryKeyOfChannel = (channel: LiveTvChannel, blocks: EpgBlock[]) => {
    if (blocks.length === 0) return `epg-${channel.id}-noprogram`;
    const current = blocks.find((b) => b.isCurrent || b.isLive) ?? blocks[0];
    return blockKey(channel.id, current.program, current.left);
  };

  const firstFocusKey = $derived.by(() => {
    for (const { channel, state } of channelRows) {
      if (state !== 'loading') {
        const blocks = getBlocksForRow(channel);
        return entryKeyOfChannel(channel, blocks);
      }
    }
    return null;
  });

  $effect(() => { onReady?.(firstFocusKey); });

  const totalContentH = $derived(channelRows.length * ROW_H);
  const maxScroll = $derived(Math.max(0, totalContentH - viewportH));

  const visibleRowRange = $derived.by(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / ROW_H) - ROW_OVERSCAN);
    const visibleCount = Math.ceil(viewportH / ROW_H) + 2;
    const endRow = Math.min(channelRows.length, startRow + visibleCount + ROW_OVERSCAN * 2);
    return { startRow, endRow };
  });

  function computeVisibleBlockRange(blocks: EpgBlock[], sl: number, vpW: number): { start: number; end: number } {
    if (blocks.length === 0) return { start: 0, end: 0 };
    const vpStart = sl - BLOCK_OVERSCAN_PX;
    const vpEnd = sl + vpW + BLOCK_OVERSCAN_PX;
    let lo = 0;
    let hi = blocks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (blocks[mid].left + blocks[mid].width < vpStart) lo = mid + 1;
      else hi = mid;
    }
    const start = lo;
    let end = start;
    while (end < blocks.length && blocks[end].left <= vpEnd) end++;
    return { start, end };
  }

  function scrollToFocused() {
    const container = scrollEl;
    if (!container) return;
    const focused = container.querySelector<HTMLElement>('[data-focused="true"]');
    if (!focused) return;
    const rowEl = focused.closest<HTMLElement>('[data-row-idx]');
    if (!rowEl) return;
    const rowIdx = Number(rowEl.dataset.rowIdx);
    if (isNaN(rowIdx)) return;
    const focusedCenter = focused.offsetTop + focused.clientHeight / 2;
    const rowContentY = rowIdx * ROW_H + focusedCenter;
    const target = clamp(rowContentY - viewportH / 2, 0, maxScroll);
    _scrollSource = 'programmatic';
    container.scrollTop = target;
  }

  function handleFocusScroll() {
    if (_scrollQueued) return;
    _scrollQueued = true;
    cancelAnimationFrame(focusRafId);
    focusRafId = requestAnimationFrame(() => {
      _scrollQueued = false;
      scrollToFocused();
    });
  }

  function updateFocusedProgram(ch: LiveTvChannel, blocks: EpgBlock[], focusKey: string) {
    const match = blocks.find((b) => {
      const key = `epg-${ch.id}-${b.program.id}-${b.left}`;
      return key === focusKey;
    });
    focusedProgram = match ? match.program : (blocks[0]?.program ?? null);
    focusedChannel = ch;
  }

  function focusNextChannel(rowIdx: number): boolean {
    const next = channelRows[rowIdx + 1];
    if (!next) return true;
    const blocks = getBlocksForRow(next.channel);
    const key = entryKeyOfChannel(next.channel, blocks);
    if (!key) return true;

    const targetRowTop = (rowIdx + 1) * ROW_H;
    const targetRowBottom = targetRowTop + ROW_H;
    const currentTop = scrollTop;
    const currentBottom = scrollTop + viewportH;

    if (targetRowTop < currentTop || targetRowBottom > currentBottom) {
      const target = clamp(targetRowBottom - viewportH / 2, 0, maxScroll);
      _scrollSource = 'programmatic';
      if (scrollEl) scrollEl.scrollTop = target;
    }

    requestAnimationFrame(() => {
      tick().then(() => setFocus(key));
    });
    return false;
  }

  function onScroll() {
    if (_scrollSource === 'programmatic') {
      _scrollSource = 'user';
      return;
    }
    cancelAnimationFrame(scrollRafId);
    scrollRafId = requestAnimationFrame(() => {
      if (!scrollEl) return;
      scrollTop = scrollEl.scrollTop;
      scrollLeft = scrollEl.scrollLeft;
    });
  }

  function preventUserScroll(e: WheelEvent) {
    e.preventDefault();
  }

  function handleRowEnter(ch: LiveTvChannel) {
    onPlay(ch);
  }

  function handleRowArrow(direction: string, rowIdx: number): boolean {
    if (direction === 'up' && rowIdx === 0 && onArrowUp) return onArrowUp();
    if (direction === 'down') return focusNextChannel(rowIdx);
    return true;
  }

  function formatTime(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  function getProgramProgress(program: LiveTvProgram): number {
    const start = new Date(program.start_time).getTime();
    const end = new Date(program.end_time).getTime();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((nowMinute - start) / (end - start)) * 100));
  }

  function getRemainingText(program: LiveTvProgram): string {
    const end = new Date(program.end_time).getTime();
    const diff = Math.max(0, end - nowMinute);
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return 'Terminando';
    if (mins < 60) return `Queda: ${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `Queda: ${hrs}h ${rem}min` : `Queda: ${hrs}h`;
  }
</script>

<div
  class="h-full w-full overflow-hidden flex flex-col bg-[#0e0e10]"
  style="--row-h: {ROW_H}px; --col-w: {CHANNEL_COL_W}px;"
>
  <!-- ── Info Panel (YouTube TV style) ── -->
  {#if focusedProgram}
    {@const progress = getProgramProgress(focusedProgram)}
    <div class="shrink-0 px-6 py-3 bg-[#121214] border-b border-white/5 flex gap-5 min-h-[5rem]">
      <div class="flex-1 min-w-0">
        <div class="text-white font-semibold text-[clamp(1rem,1.5vw,1.25rem)] truncate">
          {focusedProgram.title}
        </div>
        <div class="text-white/50 text-[clamp(0.7rem,0.9vw,0.8rem)] mt-0.5 tabular-nums">
          {formatTime(focusedProgram.start_time)} — {formatTime(focusedProgram.end_time)}
          {#if focusedProgram.category}
            <span class="text-white/30 ml-2">• {focusedProgram.category}</span>
          {/if}
          <span class="text-white/30 ml-2">• {getRemainingText(focusedProgram)}</span>
        </div>
        {#if focusedProgram.description}
          <p class="text-white/40 text-[clamp(0.65rem,0.8vw,0.75rem)] mt-1.5 line-clamp-2 leading-relaxed">
            {focusedProgram.description}
          </p>
        {/if}
        <div class="flex items-center gap-2 mt-2">
          <div class="flex-1 h-[3px] rounded-full bg-white/10 overflow-hidden max-w-[20rem]">
            <div
              class="h-full rounded-full bg-[#f03]"
              style="width: {progress}%; transition: width 1s linear;"
            ></div>
          </div>
        </div>
      </div>
      {#if focusedProgram.icon_url}
        <div class="w-[clamp(8rem,15vw,14rem)] h-[clamp(4rem,8vh,7rem)] rounded-lg overflow-hidden bg-white/5 shrink-0">
          <img
            src={focusedProgram.icon_url}
            alt={focusedProgram.title}
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── Sticky Time Header ── -->
  <div
    class="flex shrink-0 bg-bg border-b border-white/10 relative z-20"
    style="height: var(--row-h); position: sticky; top: 0;"
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
        data-scroll-content
        class="relative h-full"
        style="width: {trackWidth}px;"
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
        <div
          data-now-line-header
          class="absolute top-0 bottom-0 z-10 pointer-events-none"
          style="left: 0; will-change: transform;"
        >
          <div class="h-full w-[2px] bg-[#f03]/80"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Virtual Scroll Grid ── -->
  <div
    bind:this={scrollEl}
    bind:clientHeight={viewportH}
    onscroll={onScroll}
    onwheel={preventUserScroll}
    data-scroll-container
    class="flex-1 overflow-y-auto overflow-x-auto hide-scrollbar bg-bg"
  >
    <div
      class="relative"
      style="width: {CHANNEL_COL_W + trackWidth}px; height: {totalContentH}px;"
    >
      <div
        data-now-line-grid
        class="absolute top-0 bottom-0 z-10 pointer-events-none"
        style="left: 0; will-change: transform;"
      >
        <div class="h-full w-[2px] bg-[#f03]/80"></div>
      </div>

      {#if visibleRowRange.startRow > 0}
        <div style="height: {visibleRowRange.startRow * ROW_H}px;"></div>
      {/if}

      {#each channelRows.slice(visibleRowRange.startRow, visibleRowRange.endRow) as row, virtualIdx (row.channel.id)}
        {@const rowIdx = visibleRowRange.startRow + virtualIdx}
        {@const blocks = getBlocksForRow(row.channel)}
        <div
          class="flex border-b border-white/5"
          style="height: {ROW_H}px;"
          data-row-idx={rowIdx}
        >
          <div
            class="sticky left-0 !z-30 shrink-0 flex items-center justify-center bg-bg border-r border-white/10"
            style="width: var(--col-w); height: var(--row-h);"
          >
            <div class="w-12 h-12 rounded-xl bg-surface/50 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden">
              {#if row.channel.logo_url}
                <img
                  src={row.channel.logo_url}
                  alt={row.channel.name}
                  class="w-10 h-10 object-contain"
                  loading="lazy"
                />
              {:else}
                <Tv class="w-5 h-5 text-text-secondary" />
              {/if}
            </div>
          </div>

          <div class="relative" style="width: {trackWidth}px; height: var(--row-h);">
            {#if blocks.length === 0 && row.state !== 'loading'}
              <Focusable
                focusKey="epg-{row.channel.id}-noprogram"
                onEnterPress={() => handleRowEnter(row.channel)}
                onArrowPress={(direction) => handleRowArrow(direction, rowIdx)}
                onFocus={() => { focusedProgram = null; focusedChannel = row.channel; }}
                focusedClass="!z-20"
                class="absolute inset-y-1.5 left-2 right-2 rounded-lg cursor-pointer"
                playSound={true}
              >
                {#snippet children({ focused })}
                  <div
                    class="w-full h-full rounded-lg border flex items-center px-4 {focused
                      ? 'border-white bg-white text-black shadow-lg shadow-black/30'
                      : 'border-white/5 bg-[#1d1d1f]/40 text-white/30 border-dashed'}"
                  >
                    <p class="truncate font-semibold text-[clamp(0.75rem,0.9vw,0.85rem)] leading-none">
                      Sin programación disponible
                    </p>
                  </div>
                {/snippet}
              </Focusable>
            {:else}
              {@const { start, end } = computeVisibleBlockRange(blocks, scrollLeft, scrollEl?.clientWidth ?? 1920)}
              {#each blocks.slice(start, end) as block (block.program.id + block.left)}
                <Focusable
                  focusKey="epg-{row.channel.id}-{block.program.id}-{block.left}"
                  onEnterPress={() => handleRowEnter(row.channel)}
                  onArrowPress={(direction) => handleRowArrow(direction, rowIdx)}
                  onFocus={() => { handleFocusScroll(); updateFocusedProgram(row.channel, blocks, `epg-${row.channel.id}-${block.program.id}-${block.left}`); }}
                  focusedClass="!z-20"
                  class="absolute top-1.5 bottom-1.5 px-1 cursor-pointer"
                  style="left: {block.left}px; width: {block.width}px;"
                  playSound={true}
                >
                  {#snippet children({ focused })}
                    <div
                      class="w-full h-full rounded-lg border flex items-center px-4 {focused
                        ? 'border-white bg-white text-black shadow-lg shadow-black/30'
                        : block.isLive
                          ? 'border-[#f03]/30 bg-[#1d1d1f] text-white/90'
                          : 'border-white/5 bg-[#1d1d1f] text-white/90 hover:bg-[#232326]'}"
                    >
                      <p class="truncate font-semibold text-[clamp(0.75rem,0.9vw,0.85rem)] leading-none">
                        {block.program.title}
                      </p>
                    </div>
                  {/snippet}
                </Focusable>
              {/each}
            {/if}
          </div>
        </div>
      {/each}

      {#if visibleRowRange.endRow < channelRows.length}
        <div style="height: {(channelRows.length - visibleRowRange.endRow) * ROW_H}px;"></div>
      {/if}
    </div>
  </div>
</div>
