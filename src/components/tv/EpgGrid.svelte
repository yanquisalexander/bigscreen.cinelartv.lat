<script lang="ts">
  import Focusable from '@/components/tv/Focusable.svelte';
  import { getChannelGuide, type LiveTvChannel, type LiveTvProgram } from '@/api/live';
  import { Tv, SlidersHorizontal } from '@lucide/svelte';
  import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
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
    leftPx: number;
    widthPx: number;
    isLive: boolean;
    isCurrent: boolean;
    isPast: boolean;
  }

  let {
    channels,
    accessToken,
    onPlay,
    onArrowUp,
    onReady,
  }: Props = $props();

  // ── Metrics optimized for 1280x720 / 1920x1080 Smart TV ──
  const ROW_H = 48; // px
  const ROW_GAP = 6; // px
  const ROW_STEP = 54; // 48px + 6px
  const STATION_W = 80; // px
  const SLOT_MINUTES = 30;
  const SLOT_W = 180; // px per 30 minutes
  const PX_PER_MIN = SLOT_W / SLOT_MINUTES; // 6px / min
  const WINDOW_HOURS = 6;
  const VISIBLE_ROW_COUNT = 6;

  let nowMinute = $state(Date.now());
  let guides = $state<Record<string, PrecomputedProgram[]>>({});
  let guideState = $state<Record<string, 'loading' | 'ready' | 'error'>>({});

  let focusedProgram = $state<LiveTvProgram | null>(null);
  let focusedChannel = $state<LiveTvChannel | null>(null);

  // Top-anchored scroll state
  let selectedRowIdx = $state(0);
  let topRowIdx = $state(0);
  let horizontalOffsetPx = $state(0);

  // Update time every 30 seconds for clock & progress bar (lightweight, zero 60fps RAF loop)
  $effect(() => {
    const id = setInterval(() => { nowMinute = Date.now(); }, 30_000);
    return () => clearInterval(id);
  });

  // Calculate anchor: start at the nearest 30-minute interval before current time
  const anchorTime = $derived.by(() => {
    const d = new Date(nowMinute);
    const mins = d.getMinutes();
    d.setMinutes(mins < 30 ? 0 : 30, 0, 0);
    return d;
  });

  const windowStartMs = $derived(anchorTime.getTime());
  const windowEndMs = $derived(windowStartMs + WINDOW_HOURS * 3600_000);
  const totalSlots = WINDOW_HOURS * 2; // 12 slots for 6 hours
  const totalTrackWidthPx = $derived(totalSlots * SLOT_W);

  // "Now" red marker offset in px
  const nowOffsetPx = $derived.by(() => {
    const diffMin = Math.max(0, (nowMinute - windowStartMs) / 60000);
    return Math.min(totalTrackWidthPx, Math.round(diffMin * PX_PER_MIN));
  });

  // 30-minute timeslot markers
  const timeSlots = $derived.by(() => {
    const slots: { label: string; leftPx: number }[] = [];
    for (let i = 0; i < totalSlots; i++) {
      const slotTime = new Date(windowStartMs + i * 30 * 60000);
      slots.push({
        label: slotTime.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true }),
        leftPx: i * SLOT_W,
      });
    }
    return slots;
  });

  // Formatted clock for top-right (e.g. "10:14 a. m.")
  const currentClockText = $derived.by(() => {
    return new Date(nowMinute).toLocaleTimeString('es', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  });

  // ── Guide Batch Fetching & Caching ──
  let _loaded = new Set<string>();
  let _pendingGuides = new Map<string, PrecomputedProgram[]>();
  let _pendingStates = new Map<string, 'loading' | 'ready' | 'error'>();
  let _guideFlushQueued = false;

  function flushGuideUpdates() {
    _guideFlushQueued = false;
    if (_pendingGuides.size > 0) {
      guides = { ...guides, ...Object.fromEntries(_pendingGuides) };
      _pendingGuides.clear();
    }
    if (_pendingStates.size > 0) {
      guideState = { ...guideState, ...Object.fromEntries(_pendingStates) };
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

  // ── Compute Program Blocks per Channel ──
  let _blocksCache = new Map<string, EpgBlock[]>();
  let _blocksCacheTime = 0;

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

      const leftPx = Math.round(((s - windowStartMs) / 60000) * PX_PER_MIN);
      const widthPx = Math.max(Math.round(durMin * PX_PER_MIN) - 4, 36);

      blocks.push({
        program: pp.program,
        leftPx,
        widthPx,
        isLive: Boolean(pp.program.currently_playing) || (now >= pp.startMs && now <= pp.endMs),
        isCurrent: now >= pp.startMs && now <= pp.endMs,
        isPast: pp.endMs < now,
      });
    }
    return blocks;
  }

  function getBlocksForRow(ch: LiveTvChannel): EpgBlock[] {
    const minuteKey = Math.floor(nowMinute / 60000);
    if (minuteKey !== _blocksCacheTime) {
      _blocksCache.clear();
      _blocksCacheTime = minuteKey;
    }
    if (_blocksCache.has(ch.id)) {
      return _blocksCache.get(ch.id)!;
    }
    const blocks = computeBlocks(ch, nowMinute);
    _blocksCache.set(ch.id, blocks);
    return blocks;
  }

  // Focus key generator
  const getBlockFocusKey = (channelId: string, programId: string, leftPx: number) =>
    `epg-${channelId}-${programId}-${leftPx}`;

  // Find the primary focusable key for a channel (matching time slot of currently focused program if possible)
  function getTargetFocusKeyForRow(targetChannel: LiveTvChannel, currentProg: LiveTvProgram | null): string {
    const blocks = getBlocksForRow(targetChannel);
    if (blocks.length === 0) return `epg-${targetChannel.id}-noprogram`;

    if (currentProg) {
      const curStart = new Date(currentProg.start_time).getTime();
      const curEnd = new Date(currentProg.end_time).getTime();
      const curMid = curStart + (curEnd - curStart) / 2;

      // Find block in target channel that covers the midpoint time
      const match = blocks.find((b) => {
        const bStart = new Date(b.program.start_time).getTime();
        const bEnd = new Date(b.program.end_time).getTime();
        return curMid >= bStart && curMid < bEnd;
      });

      if (match) {
        return getBlockFocusKey(targetChannel.id, match.program.id, match.leftPx);
      }
    }

    // Default to current live program or first available
    const cur = blocks.find((b) => b.isCurrent || b.isLive) ?? blocks[0];
    return getBlockFocusKey(targetChannel.id, cur.program.id, cur.leftPx);
  }

  // Initial focus key
  const firstFocusKey = $derived.by(() => {
    if (channels.length > 0) {
      return getTargetFocusKeyForRow(channels[0], null);
    }
    return null;
  });

  $effect(() => {
    if (firstFocusKey) {
      onReady?.(firstFocusKey);
    }
  });

  // Default initial focused program / channel if none selected yet
  $effect(() => {
    if (!focusedChannel && channels.length > 0) {
      focusedChannel = channels[0];
      const blocks = getBlocksForRow(channels[0]);
      if (blocks.length > 0) {
        const cur = blocks.find((b) => b.isCurrent || b.isLive) ?? blocks[0];
        focusedProgram = cur.program;
      } else {
        focusedProgram = channels[0].current_program ?? null;
      }
    }
  });

  // ── Top-Anchored Virtualization ──
  const maxTopRowIdx = $derived(Math.max(0, channels.length - VISIBLE_ROW_COUNT));

  function updateTopAnchoredScroll(targetRowIdx: number) {
    selectedRowIdx = targetRowIdx;
    topRowIdx = Math.min(targetRowIdx, maxTopRowIdx);
  }

  // Visible window of rows in DOM: topRowIdx - 1 (overscan) up to topRowIdx + VISIBLE_ROW_COUNT + 1
  const visibleRows = $derived.by(() => {
    const start = Math.max(0, topRowIdx - 1);
    const end = Math.min(channels.length, topRowIdx + VISIBLE_ROW_COUNT + 2);
    const rows = [];
    for (let idx = start; idx < end; idx++) {
      rows.push({
        channel: channels[idx],
        rowIdx: idx,
        translateYPx: idx * ROW_STEP,
      });
    }
    return rows;
  });

  // Ensure active block is visible horizontally
  function ensureHorizontalInView(leftPx: number, widthPx: number) {
    const viewportWidthPx = 960;
    const rightPx = leftPx + widthPx;

    if (leftPx < horizontalOffsetPx) {
      horizontalOffsetPx = Math.max(0, leftPx - 20);
    } else if (rightPx > horizontalOffsetPx + viewportWidthPx) {
      horizontalOffsetPx = Math.max(0, rightPx - viewportWidthPx + 40);
    }
  }

  // ── Navigation Handlers ──
  function handleArrowPress(direction: string, rowIdx: number, blockIdx: number, blocks: EpgBlock[]): boolean {
    if (direction === 'up') {
      if (rowIdx === 0) {
        if (onArrowUp) return onArrowUp();
        return true;
      }
      const prevRowIdx = rowIdx - 1;
      updateTopAnchoredScroll(prevRowIdx);
      const prevChannel = channels[prevRowIdx];
      const targetKey = getTargetFocusKeyForRow(prevChannel, focusedProgram);
      requestAnimationFrame(() => {
        tick().then(() => {
          if (doesFocusableExist(targetKey)) setFocus(targetKey);
        });
      });
      return false;
    }

    if (direction === 'down') {
      if (rowIdx < channels.length - 1) {
        const nextRowIdx = rowIdx + 1;
        updateTopAnchoredScroll(nextRowIdx);
        const nextChannel = channels[nextRowIdx];
        const targetKey = getTargetFocusKeyForRow(nextChannel, focusedProgram);
        requestAnimationFrame(() => {
          tick().then(() => {
            if (doesFocusableExist(targetKey)) setFocus(targetKey);
          });
        });
        return false;
      }
      return false;
    }

    if (direction === 'left') {
      if (blockIdx > 0) {
        const prevBlock = blocks[blockIdx - 1];
        const prevKey = getBlockFocusKey(channels[rowIdx].id, prevBlock.program.id, prevBlock.leftPx);
        setFocus(prevKey);
        return false;
      }
      return false;
    }

    if (direction === 'right') {
      if (blockIdx < blocks.length - 1) {
        const nextBlock = blocks[blockIdx + 1];
        const nextKey = getBlockFocusKey(channels[rowIdx].id, nextBlock.program.id, nextBlock.leftPx);
        setFocus(nextKey);
        return false;
      }
      return false;
    }

    return true;
  }

  function handleProgramFocus(ch: LiveTvChannel, program: LiveTvProgram, leftPx: number, widthPx: number, rowIdx: number) {
    focusedChannel = ch;
    focusedProgram = program;
    selectedRowIdx = rowIdx;
    ensureHorizontalInView(leftPx, widthPx);
  }

  // ── Formatters & Helpers ──
  function formatProgramTime(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function formatProgramDate(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
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

<!-- ── YouTube TV EPG Container (ytvlr-epg-page) ── -->
<div class="h-full w-full flex flex-col bg-[#0f0f0f] overflow-hidden select-none">
  
  <!-- ── Top Header / Clock (ytvlr-clock) ── -->
  <div class="shrink-0 flex items-center justify-between px-8 pt-2 pb-1">
    <div class="flex items-center gap-2">
      <span class="text-white/40 text-[11px] font-semibold tracking-wider uppercase">Guía en vivo</span>
    </div>
    <div class="flex items-center gap-2 text-white/70 font-medium text-xs tabular-nums">
      <span>{currentClockText}</span>
    </div>
  </div>

  <!-- ── YouTube TV Info Panel (ytvlr-epg-info-panel-renderer) ── -->
  <div class="shrink-0 px-8 pb-3 flex items-start justify-between gap-6 h-[8.5rem] relative">
    {#if focusedChannel}
      {@const progress = focusedProgram ? getProgramProgress(focusedProgram) : null}
      <div class="flex-1 min-w-0 max-w-[48rem] flex flex-col justify-start">
        
        <!-- Title: compact TV size (approx 20px - 24px) -->
        <h1 class="text-[#f1f1f1] font-bold text-[clamp(1.15rem,1.7vw,1.45rem)] leading-snug truncate">
          {focusedProgram?.title || focusedChannel.name}
        </h1>

        <!-- Details / Progress Container -->
        {#if focusedProgram && progress !== null}
          <div class="flex items-center gap-3 mt-1.5">
            <div class="w-36 h-1 rounded-full bg-white/20 overflow-hidden shrink-0">
              <div
                class="h-full rounded-full bg-[#ff0033]"
                style="width: {progress}%; transition: width 1s linear;"
              ></div>
            </div>
            <span class="text-[#f1f1f1]/80 text-xs font-medium tabular-nums">
              {getRemainingText(focusedProgram)}
            </span>
            <span class="text-white/40 text-xs tabular-nums">
              • {formatProgramTime(focusedProgram.start_time)} – {formatProgramTime(focusedProgram.end_time)}
            </span>
          </div>
        {:else}
          <div class="flex items-center gap-2.5 mt-1.5">
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#ff0033] uppercase tracking-wider bg-[#ff0033]/15 px-2 py-0.5 rounded">
              <span class="w-1.5 h-1.5 rounded-full bg-[#ff0033] animate-pulse"></span>
              En vivo
            </span>
            <span class="text-white/40 text-xs">
              • Transmisión en directo
            </span>
          </div>
        {/if}

        <!-- Badged Text (ytvlr-badged-text-renderer) -->
        <div class="flex items-center gap-2 mt-1.5 text-xs text-white/60 font-medium truncate">
          <span class="text-[#f1f1f1] font-semibold">{focusedChannel.name}</span>
          <span>•</span>
          <span class="text-[#ff0033] font-bold uppercase tracking-wider text-[10px] bg-[#ff0033]/15 px-1.5 py-0.5 rounded">
            {focusedProgram?.currently_playing ? 'EN VIVO' : focusedProgram ? 'PROGRAMADO' : 'EN VIVO'}
          </span>
          {#if focusedProgram?.start_time}
            <span>•</span>
            <span>{formatProgramDate(focusedProgram.start_time)}</span>
          {/if}
          {#if focusedProgram?.category || (focusedChannel as any)?.category}
            <span>•</span>
            <span class="text-white/70">
              {focusedProgram?.category || (focusedChannel as any)?.category}
            </span>
          {/if}
        </div>

        <!-- Description: 2 lines clamp -->
        <p class="text-white/70 text-xs mt-1.5 line-clamp-2 leading-relaxed">
          {focusedProgram?.description || focusedChannel.description || 'Disfruta de la mejor programación en directo con CinelarTV.'}
        </p>
      </div>

      <!-- Thumbnail Preview: 16:9 proportioned for 720p/1080p (~160px × 90px) -->
      <div class="w-[clamp(140px,14vw,176px)] aspect-video rounded-lg overflow-hidden shadow-xl relative bg-[#18181b] border border-white/10 shrink-0">
        {#if focusedProgram?.icon_url || focusedChannel.logo_url}
          <img
            src={focusedProgram?.icon_url || focusedChannel.logo_url}
            alt={focusedProgram?.title || focusedChannel.name}
            class="w-full h-full object-cover"
            loading="lazy"
          />
        {:else}
          <div class="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-[#1c1c1e]">
            <Tv class="w-7 h-7 text-white/30" />
            <span class="text-white/40 text-[10px] font-medium">{focusedChannel.name}</span>
          </div>
        {/if}

        <!-- Mini Progress Bar at bottom of thumbnail -->
        {#if progress !== null}
          <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
            <div
              class="h-full bg-[#ff0033]"
              style="width: {progress}%; transition: width 1s linear;"
            ></div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center text-white/30 text-xs">
        No hay canales disponibles
      </div>
    {/if}
  </div>

  <!-- ── YouTube TV Compact Grid (ytvlr-epg-compact-grid) ── -->
  <div class="flex-1 min-h-0 flex flex-col px-8 overflow-hidden relative">
    
    <!-- ── Header Row (ytvlr-epg-compact-grid-header-row) ── -->
    <div class="shrink-0 flex items-center mb-1.5 z-20">
      
      <!-- Sort / Filter Button (YtvlrEpgSortButton) -->
      <div
        class="shrink-0 flex items-center justify-center rounded-lg bg-white/10 text-white/80 border border-white/10"
        style="width: {STATION_W}px; height: 30px;"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
      </div>

      <!-- Timeslots track (shifted in sync with airings) -->
      <div class="flex-1 overflow-hidden relative" style="margin-left: {ROW_GAP}px; height: 30px;">
        <div
          class="absolute top-0 bottom-0 flex items-center"
          style="width: {totalTrackWidthPx}px; transform: translateX(-{horizontalOffsetPx}px); transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1); will-change: transform;"
        >
          {#each timeSlots as slot (slot.leftPx)}
            <div
              class="absolute top-0 bottom-0 flex items-center pl-3 text-[11px] font-semibold tracking-wider text-white/60 border-l border-white/10 uppercase tabular-nums"
              style="left: {slot.leftPx}px; width: {SLOT_W}px;"
            >
              {slot.label}
            </div>
          {/each}

          <!-- Header "Now" indicator line -->
          <div
            class="absolute top-0 bottom-0 z-30 pointer-events-none"
            style="left: {nowOffsetPx}px; width: 2px;"
          >
            <div class="h-full w-[2px] bg-[#ff0033]"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Virtualized Grid Rows (yt-virtual-list) ── -->
    <div class="flex-1 relative overflow-hidden">
      
      <!-- List Container: smoothly shifts via translateY to keep focused row top-anchored -->
      <div
        class="absolute inset-0"
        style="transform: translateY(-{topRowIdx * ROW_STEP}px); transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1); will-change: transform;"
      >
        {#each visibleRows as { channel, rowIdx, translateYPx } (channel.id)}
          {@const blocks = getBlocksForRow(channel)}
          {@const isCurrentRow = selectedRowIdx === rowIdx}

          <!-- Virtual Row (ytvlr-epg-row-compact-renderer) -->
          <div
            class="absolute left-0 right-0 flex items-center"
            style="height: {ROW_H}px; transform: translateY({translateYPx}px);"
          >
            
            <!-- Station Card (ytvlr-epg-station-renderer) -->
            <div
              class="shrink-0 flex items-center justify-center rounded-lg {isCurrentRow
                ? 'bg-white/30 border border-white/40 shadow-sm'
                : 'bg-white/10 border border-white/5'}"
              style="width: {STATION_W}px; height: {ROW_H}px;"
            >
              {#if channel.logo_url}
                <img
                  src={channel.logo_url}
                  alt={channel.name}
                  class="max-w-[50px] max-h-[28px] object-contain"
                  loading="lazy"
                />
              {:else}
                <div class="flex flex-col items-center gap-0.5">
                  <Tv class="w-4 h-4 text-white/40" />
                  <span class="text-[9px] text-white/50 font-bold truncate max-w-[68px] text-center leading-none">
                    {channel.name}
                  </span>
                </div>
              {/if}
            </div>

            <!-- Airings Container (yt-focus-container) -->
            <div
              class="flex-1 relative overflow-hidden"
              style="margin-left: {ROW_GAP}px; height: {ROW_H}px;"
            >
              <!-- Airings Track (shifted horizontally in sync with header) -->
              <div
                class="absolute top-0 bottom-0"
                style="width: {totalTrackWidthPx}px; transform: translateX(-{horizontalOffsetPx}px); transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1); will-change: transform;"
              >
                <!-- Grid "Now" indicator line -->
                <div
                  class="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style="left: {nowOffsetPx}px; width: 2px;"
                >
                  <div class="h-full w-[2px] bg-[#ff0033]/60"></div>
                </div>

                {#if blocks.length === 0}
                  <!-- Fallback block when channel has no scheduled guide -->
                  <Focusable
                    focusKey="epg-{channel.id}-noprogram"
                    onEnterPress={() => onPlay(channel)}
                    onArrowPress={(direction) => handleArrowPress(direction, rowIdx, 0, [])}
                    onFocus={() => {
                      focusedChannel = channel;
                      focusedProgram = channel.current_program ?? null;
                      selectedRowIdx = rowIdx;
                    }}
                    class="absolute inset-y-0 left-0 right-0 rounded-lg cursor-pointer"
                    playSound={true}
                  >
                    {#snippet children({ focused })}
                      <div
                        class="w-full h-full rounded-lg flex items-center px-4 border {focused
                          ? 'bg-[#f1f1f1] text-[#0f0f0f] font-semibold border-white shadow-md z-20'
                          : isCurrentRow
                            ? 'bg-white/30 text-[#f1f1f1] border-white/20'
                            : 'bg-white/10 text-white/70 border-white/5'}"
                      >
                        <span class="text-xs">Sin programación disponible</span>
                      </div>
                    {/snippet}
                  </Focusable>
                {:else}
                  <!-- Program Airing Blocks (ytvlr-epg-airing-compact-renderer) - NO SCALE, NO TRANSITION -->
                  {#each blocks as block, bIdx (block.program.id + block.leftPx)}
                    <Focusable
                      focusKey={getBlockFocusKey(channel.id, block.program.id, block.leftPx)}
                      onEnterPress={() => onPlay(channel)}
                      onArrowPress={(direction) => handleArrowPress(direction, rowIdx, bIdx, blocks)}
                      onFocus={() => handleProgramFocus(channel, block.program, block.leftPx, block.widthPx, rowIdx)}
                      class="absolute top-0 bottom-0 cursor-pointer rounded-lg"
                      style="left: {block.leftPx}px; width: {block.widthPx}px; height: {ROW_H}px;"
                      playSound={true}
                    >
                      {#snippet children({ focused })}
                        <div
                          class="w-full h-full rounded-lg px-3 flex flex-col justify-center border {focused
                            ? 'bg-[#f1f1f1] text-[#0f0f0f] font-semibold border-white shadow-lg z-20'
                            : isCurrentRow
                              ? 'bg-white/30 text-[#f1f1f1] border-white/20 hover:bg-white/35'
                              : 'bg-white/10 text-white/70 border-white/5 hover:bg-white/15'}"
                        >
                          <div class="flex items-center gap-1.5">
                            {#if block.isLive && !focused}
                              <span class="w-1.5 h-1.5 rounded-full bg-[#ff0033] shrink-0 animate-pulse"></span>
                            {/if}
                            <span class="text-xs font-semibold truncate leading-tight">
                              {block.program.title}
                            </span>
                          </div>

                          <div class="flex items-center gap-1.5 text-[10px] opacity-75 mt-0.5 tabular-nums">
                            <span>{formatProgramTime(block.program.start_time)}</span>
                            <span>–</span>
                            <span>{formatProgramTime(block.program.end_time)}</span>
                          </div>
                        </div>
                      {/snippet}
                    </Focusable>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
