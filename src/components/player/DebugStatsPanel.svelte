<script lang="ts">
  import type { CinelarPlayerEngine } from '@/services/player/CinelarPlayerEngine';

  interface Props {
    engine: CinelarPlayerEngine | null;
    videoEl: HTMLVideoElement | null;
    streamUrl: string | null;
    adPhase: string;
    prerollChecked: boolean;
  }

  let { engine, videoEl, streamUrl, adPhase, prerollChecked }: Props = $props();

  // ── Snapshot state (updated imperatively in tick) ──
  let snapProfile = $state<any>(null);
  let snapDiag = $state<any>(null);
  let snapHealth = $state<any>(null);
  let snapSession = $state<any>(null);
  let snapCodecInfo = $state<{ video: string; audio: string } | null>(null);
  let snapDroppedFrames = $state(0);
  let snapTotalFrames = $state(0);
  let snapBufferAhead = $state(0);
  let snapDate = $state('');

  // ── Update interval: 3s for TV (reduces GPU contention with video decoder) ──
  let updateInterval: ReturnType<typeof setInterval> | null = null;

  function tick() {
    if (!engine || !videoEl) return;

    // Read all metrics
    snapProfile = engine.getProfile();
    snapDiag = engine.getSyncDiagnostics();
    snapHealth = engine.getBufferHealthScore();
    snapSession = engine.getSessionSummary();

    snapDroppedFrames = videoEl.getVideoPlaybackQuality?.()?.droppedVideoFrames ?? 0;
    snapTotalFrames = videoEl.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0;

    const ct = videoEl.currentTime;
    let ahead = 0;
    for (let i = 0; i < videoEl.buffered.length; i++) {
      const start = videoEl.buffered.start(i);
      const end = videoEl.buffered.end(i);
      if (start <= ct && end >= ct) { ahead = end - ct; break; }
    }
    snapBufferAhead = Math.max(0, ahead);

    snapCodecInfo = snapProfile
      ? { video: `${snapProfile.decoderMaxHeight}p`, audio: '—' }
      : null;
    snapDate = new Date().toLocaleString();
  }

  $effect(() => {
    updateInterval = setInterval(tick, 3000); // Reduced from 1s to 3s for Smart TV
    tick();
    return () => {
      if (updateInterval) clearInterval(updateInterval);
    };
  });

  // ── sCPN-like ID ──
  function getSessionCpn(): string {
    const id = streamUrl ?? '';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(11, '0');
    return `${hex.slice(0, 4)}_${hex.slice(4, 8)} ${hex.slice(0, 3)} ${hex.slice(3, 6)} ${hex.slice(6, 9)} ${hex.slice(9, 12)} ${hex.slice(0, 4)}`;
  }
</script>

<!--
  TV Performance Optimizations:
  - Update interval: 3 seconds (was 1s) - reduces CPU/GPU contention with video decoder
  - Removed sparkline canvases (4 canvases) - biggest GPU hog
  - CSS containment: contain: paint - isolates repaints from video compositor
  - Simplified layout: fewer rows, no complex calculations
-->
<div
  class="stats-panel"
  role="region"
  aria-label="Stats for nerds"
  style="contain: paint; transform: translateZ(0);"
>
  <div class="stats-content">

    <!-- Row: Video ID / sCPN -->
    <div class="stats-row">
      <span class="stats-label">Video ID / sCPN</span>
      <span class="stats-value">{streamUrl ? streamUrl.split('/').pop()?.split('?')[0]?.slice(0, 11) ?? '—' : '—'} / {getSessionCpn()}</span>
    </div>

    <!-- Row: Viewport / Frames -->
    <div class="stats-row">
      <span class="stats-label">Viewport / Frames</span>
      <span class="stats-value">
        {typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '?x?'} / {snapDroppedFrames} dropped of {snapTotalFrames}
      </span>
    </div>

    <!-- Row: Current / Optimal Res -->
    <div class="stats-row">
      <span class="stats-label">Current / Optimal Res</span>
      <span class="stats-value">
        {snapProfile?.decoderMaxHeight ?? '?'}p@{snapProfile?.maxFps ?? '?'} / {snapProfile?.displayMaxHeight ?? '?'}p
        {#if snapProfile?.performanceCap}
          <span class="stats-warn"> (capped: {snapProfile.performanceCap.maxHeight}p)</span>
        {/if}
      </span>
    </div>

    <!-- Row: Volume / Normalized -->
    <div class="stats-row">
      <span class="stats-label">Volume / Normalized</span>
      <span class="stats-value">{Math.round(videoEl?.volume * 100 ?? 0)}%{videoEl?.muted ? ' (muted)' : ''} / {videoEl?.playbackRate ?? 1}x</span>
    </div>

    <!-- Row: Codecs -->
    <div class="stats-row">
      <span class="stats-label">Codecs HW</span>
      <span class="stats-value">
        {#if snapCodecInfo}{snapCodecInfo.video} / {snapCodecInfo.audio}{:else}— / —{/if}
      </span>
    </div>

    <!-- Row: Buffer Health Score -->
    {#if snapHealth}
      <div class="stats-row">
        <span class="stats-label">Health Score</span>
        <span class="stats-value">
          <span class="stats-badge {snapHealth.overall < 30 ? 'badge-red' : snapHealth.overall > 70 ? 'badge-green' : 'badge-yellow'}">
            {snapHealth.overall}%
          </span>
          {snapHealth.recommendation}
          {#if snapHealth.stallFrequency > 0}
            <span class="stats-warn"> · {snapHealth.stallFrequency} stalls/min</span>
          {/if}
        </span>
      </div>
    {/if}

    <!-- Row: Platform -->
    {#if snapProfile}
      <div class="stats-row">
        <span class="stats-label">Platform</span>
        <span class="stats-value">
          {snapProfile.platform}
          {#if snapProfile.isLowEndDevice}<span class="stats-warn"> (low-end)</span>{/if}
          · {#if snapProfile.supportsPlaybackRateSlewing}<span class="stats-ok">slewing ✓</span>{:else}<span class="stats-warn">slewing ✗</span>{/if}
        </span>
      </div>
    {/if}

    <!-- Row: Engine internals -->
    <div class="stats-row">
      <span class="stats-label">Engine</span>
      <span class="stats-value stats-mono">
        resyncs:{snapDiag?.resyncCount ?? 0} buf:{snapBufferAhead.toFixed(1)} rec:{snapHealth?.recommendation ?? '—'} ad:{adPhase}
      </span>
    </div>

    <!-- Row: Session -->
    {#if snapSession}
      <div class="stats-row">
        <span class="stats-label">Session</span>
        <span class="stats-value stats-mono">
          {Math.round(snapSession.sessionDurationMs / 1000)}s
          stalls:{snapSession.totalStalls} qchanges:{snapSession.totalQualityChanges}
          recovery:{snapSession.recoverySuccesses}/{snapSession.recoveryAttempts}
        </span>
      </div>
    {/if}

    <!-- Row: Date -->
    <div class="stats-row">
      <span class="stats-label">Date</span>
      <span class="stats-value">{snapDate}</span>
    </div>

  </div>
</div>

<style>
  .stats-panel {
    position: absolute;
    top: 2vh;
    right: 2vw;
    z-index: 50;
    background: rgba(0, 0, 0, 0.88);
    color: #f1f1f1;
    font-family: 'Roboto Mono', 'Consolas', 'Courier New', monospace;
    font-size: clamp(10px, 0.9vw, 13px);
    line-height: 1.2;
    border-radius: 4px;
    max-height: 88vh;
    overflow-y: auto;
    overflow-x: hidden;
    width: clamp(320px, 26vw, 420px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    pointer-events: auto;
    /* Critical for TV performance: isolate panel repaints from video compositor */
    contain: paint;
    /* Improve scrolling performance on Smart TV */
    -webkit-overflow-scrolling: touch;
  }

  .stats-content {
    padding: clamp(6px, 0.8vw, 10px) clamp(8px, 1vw, 14px);
  }

  .stats-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: clamp(2px, 0.3vh, 4px) 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    gap: 10px;
    min-height: clamp(18px, 2.2vh, 24px);
  }

  .stats-row:last-child {
    border-bottom: none;
  }

  .stats-label {
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    flex-shrink: 0;
    font-size: clamp(9px, 0.8vw, 12px);
    text-transform: none;
    letter-spacing: 0.01em;
  }

  .stats-value {
    color: #e8e8e8;
    text-align: right;
    word-break: break-word;
    font-size: clamp(10px, 0.9vw, 13px);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .stats-warn {
    color: #fbbf24;
    font-size: clamp(9px, 0.8vw, 12px);
  }

  .stats-ok {
    color: #4ade80;
    font-size: clamp(9px, 0.8vw, 12px);
  }

  .stats-mono {
    font-size: clamp(9px, 0.8vw, 12px);
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.02em;
  }

  .stats-badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: clamp(9px, 0.8vw, 12px);
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .badge-green { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
  .badge-yellow { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
  .badge-red { background: rgba(248, 113, 113, 0.2); color: #f87171; }

  .stats-panel::-webkit-scrollbar { width: 4px; }
  .stats-panel::-webkit-scrollbar-track { background: transparent; }
  .stats-panel::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 3px; }
</style>