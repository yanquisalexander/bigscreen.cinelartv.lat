<script lang="ts">
  import type { CinelarPlayerEngine } from '@/services/player/CinelarPlayerEngine';
  import { untracked } from 'svelte';

  interface Props {
    engine: CinelarPlayerEngine | null;
    videoEl: HTMLVideoElement | null;
    streamUrl: string | null;
    adPhase: string;
    prerollChecked: boolean;
  }

  let { engine, videoEl, streamUrl, adPhase, prerollChecked }: Props = $props();

  const SPARKLINE_MAX = 20;
  const SPARKLINE_W = 100;
  const SPARKLINE_H = 8;

  const bufferHistory: number[] = [];
  const dropHistory: number[] = [];
  const bwHistory: number[] = [];
  const skewHistory: number[] = [];

  let bufferCanvas: HTMLCanvasElement | null = null;
  let bwCanvas: HTMLCanvasElement | null = null;
  let dropCanvas: HTMLCanvasElement | null = null;
  let skewCanvas: HTMLCanvasElement | null = null;

  let snapProfile = $state<any>(null);
  let snapDiag = $state<any>(null);
  let snapHealth = $state<any>(null);
  let snapSession = $state<any>(null);
  let snapCodecInfo = $state<{ video: string; audio: string } | null>(null);
  let snapDroppedFrames = $state(0);
  let snapTotalFrames = $state(0);
  let snapBufferAhead = $state(0);
  let snapDate = $state('');

  function drawSparkline(
    canvas: HTMLCanvasElement | null,
    data: number[],
    color: string,
    maxVal?: number,
  ) {
    if (!canvas || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const max = maxVal ?? Math.max(...data, 1);
    const step = w / (SPARKLINE_MAX - 1);

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - (data[i] / max) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  let updateInterval: ReturnType<typeof setInterval> | null = null;

  function tick() {
    if (!engine || !videoEl) return;

    const profile = engine.getProfile();
    const diag = engine.getSyncDiagnostics();
    const health = engine.getBufferHealthScore();
    const session = engine.getSessionSummary();

    const droppedFrames = videoEl.getVideoPlaybackQuality?.()?.droppedVideoFrames ?? 0;
    const totalFrames = videoEl.getVideoPlaybackQuality?.()?.totalVideoFrames ?? 0;

    const ct = videoEl.currentTime;
    let ahead = 0;
    for (let i = 0; i < videoEl.buffered.length; i++) {
      const start = videoEl.buffered.start(i);
      const end = videoEl.buffered.end(i);
      if (start <= ct && end >= ct) { ahead = end - ct; break; }
    }

    // untracked() prevents $state writes from re-triggering the $effect
    untracked(() => {
      snapProfile = profile;
      snapDiag = diag;
      snapHealth = health;
      snapSession = session;
      snapDroppedFrames = droppedFrames;
      snapTotalFrames = totalFrames;
      snapBufferAhead = Math.max(0, ahead);
      snapCodecInfo = profile
        ? { video: `${profile.decoderMaxHeight}p`, audio: '—' }
        : null;
      snapDate = new Date().toLocaleString();
    });

    if (health) {
      bufferHistory.push(health.bufferSeconds);
      if (bufferHistory.length > SPARKLINE_MAX) bufferHistory.shift();
      dropHistory.push(health.dropRate * 100);
      if (dropHistory.length > SPARKLINE_MAX) dropHistory.shift();
    }
    if (diag) {
      skewHistory.push(Math.abs(diag.skewSeconds) * 100);
      if (skewHistory.length > SPARKLINE_MAX) skewHistory.shift();
    }
    if (profile) {
      bwHistory.push((profile.bandwidthEstimate ?? 0) / 1000);
      if (bwHistory.length > SPARKLINE_MAX) bwHistory.shift();
    }

    drawSparkline(bufferCanvas, bufferHistory, '#4ade80');
    drawSparkline(bwCanvas, bwHistory, '#60a5fa', Math.max(...bwHistory, 1000));
    drawSparkline(dropCanvas, dropHistory, '#f87171', 10);
    drawSparkline(skewCanvas, skewHistory, '#c084fc', 50);
  }

  $effect(() => {
    updateInterval = setInterval(tick, 3000);
    tick();
    return () => {
      if (updateInterval) clearInterval(updateInterval);
    };
  });

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

<div
  class="stats-panel"
  role="region"
  aria-label="Stats for nerds"
  style="contain: paint; transform: translateZ(0);"
>
  <div class="stats-content">

    <div class="stats-row">
      <span class="stats-label">Video ID / sCPN</span>
      <span class="stats-value">{streamUrl ? streamUrl.split('/').pop()?.split('?')[0]?.slice(0, 11) ?? '—' : '—'} / {getSessionCpn()}</span>
    </div>

    <div class="stats-row">
      <span class="stats-label">Viewport / Frames</span>
      <span class="stats-value">
        {typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '?x?'} / {snapDroppedFrames} dropped of {snapTotalFrames}
      </span>
    </div>

    <div class="stats-row">
      <span class="stats-label">Current / Optimal Res</span>
      <span class="stats-value">
        {snapProfile?.decoderMaxHeight ?? '?'}p@{snapProfile?.maxFps ?? '?'} / {snapProfile?.displayMaxHeight ?? '?'}p
        {#if snapProfile?.performanceCap}
          <span class="stats-warn"> (capped: {snapProfile.performanceCap.maxHeight}p)</span>
        {/if}
      </span>
    </div>

    <div class="stats-row">
      <span class="stats-label">Volume / Normalized</span>
      <span class="stats-value">{Math.round(videoEl?.volume * 100 ?? 0)}%{videoEl?.muted ? ' (muted)' : ''} / {videoEl?.playbackRate ?? 1}x</span>
    </div>

    <div class="stats-row">
      <span class="stats-label">Codecs HW</span>
      <span class="stats-value">
        {#if snapCodecInfo}{snapCodecInfo.video} / {snapCodecInfo.audio}{:else}— / —{/if}
      </span>
    </div>

    <div class="stats-row stats-sparkline-row">
      <span class="stats-label">Speed</span>
      <span class="stats-value stats-sparkline-row">
        <canvas bind:this={bwCanvas} width={SPARKLINE_W} height={SPARKLINE_H} class="sparkline-canvas"></canvas>
        <span>{Math.round(snapProfile?.bandwidthEstimate ?? 0)} Kbps</span>
      </span>
    </div>

    <div class="stats-row stats-sparkline-row">
      <span class="stats-label">Buffer</span>
      <span class="stats-value stats-sparkline-row">
        <canvas bind:this={bufferCanvas} width={SPARKLINE_W} height={SPARKLINE_H} class="sparkline-canvas"></canvas>
        <span>{snapBufferAhead.toFixed(1)}s</span>
      </span>
    </div>

    <div class="stats-row stats-sparkline-row">
      <span class="stats-label">Drops</span>
      <span class="stats-value stats-sparkline-row">
        <canvas bind:this={dropCanvas} width={SPARKLINE_W} height={SPARKLINE_H} class="sparkline-canvas"></canvas>
        <span>{(snapDiag?.dropRatio ?? 0).toFixed(1)}%</span>
      </span>
    </div>

    <div class="stats-row stats-sparkline-row">
      <span class="stats-label">Skew</span>
      <span class="stats-value stats-sparkline-row">
        <canvas bind:this={skewCanvas} width={SPARKLINE_W} height={SPARKLINE_H} class="sparkline-canvas"></canvas>
        <span>{snapDiag?.skewSeconds ?? 0}s</span>
      </span>
    </div>

    {#if snapHealth}
      <div class="stats-row">
        <span class="stats-label">Health</span>
        <span class="stats-value">
          <span class="stats-badge {snapHealth.overall < 30 ? 'badge-red' : snapHealth.overall > 70 ? 'badge-green' : 'badge-yellow'}">
            {snapHealth.overall}%
          </span>
          {snapHealth.recommendation}
        </span>
      </div>
    {/if}

    {#if snapProfile}
      <div class="stats-row">
        <span class="stats-label">Platform</span>
        <span class="stats-value">
          {snapProfile.platform}
          {#if snapProfile.isLowEndDevice}<span class="stats-warn"> (low)</span>{/if}
          · {#if snapProfile.supportsPlaybackRateSlewing}<span class="stats-ok">slew✓</span>{:else}<span class="stats-warn">slew✗</span>{/if}
        </span>
      </div>
    {/if}

    <div class="stats-row">
      <span class="stats-label">Engine</span>
      <span class="stats-value stats-mono">
        resyncs:{snapDiag?.resyncCount ?? 0} buf:{snapBufferAhead.toFixed(1)} rec:{snapHealth?.recommendation ?? '—'} ad:{adPhase}
      </span>
    </div>

    {#if snapSession}
      <div class="stats-row">
        <span class="stats-label">Session</span>
        <span class="stats-value stats-mono">
          {Math.round(snapSession.sessionDurationMs / 1000)}s stalls:{snapSession.totalStalls} q:{snapSession.totalQualityChanges}
        </span>
      </div>
    {/if}

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
    contain: paint;
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

  .stats-row:last-child { border-bottom: none; }

  .stats-label {
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    flex-shrink: 0;
    font-size: clamp(9px, 0.8vw, 12px);
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

  .stats-sparkline-row {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .sparkline-canvas {
    display: inline-block;
    vertical-align: bottom;
    border-radius: 1px;
    flex-shrink: 0;
    image-rendering: crisp-edges;
  }

  .stats-warn { color: #fbbf24; font-size: clamp(9px, 0.8vw, 12px); }
  .stats-ok { color: #4ade80; font-size: clamp(9px, 0.8vw, 12px); }
  .stats-mono { font-size: clamp(9px, 0.8vw, 12px); color: rgba(255, 255, 255, 0.4); letter-spacing: 0.02em; }

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
