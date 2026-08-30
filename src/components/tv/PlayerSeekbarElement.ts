import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { SpatialNavigation, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation-core';
import { FocusableRegistrar } from './spatialFocus';
import { formatTime } from '@/utils/helpers';
import { ctvIconSheet } from '@/lib/ctvIcons';

const PARENT_FOCUS_KEY = 'watch-root';
const SEEK_STEP_SECONDS = 10;
const SEEK_REPEAT_MS = 180;

function getSeekStep(heldMs: number): number {
  if (heldMs > 3000) return 60;
  if (heldMs > 1000) return 30;
  return SEEK_STEP_SECONDS;
}

function getSeekInterval(heldMs: number): number {
  if (heldMs > 3000) return 80;
  if (heldMs > 1000) return 120;
  return SEEK_REPEAT_MS;
}

@customElement('tv-player-seekbar')
export class PlayerSeekbarElement extends LitElement {
  static styles = css`
    :host { display: contents; }

    .seekbar-view {
      display: flex;
      align-items: center;
      gap: clamp(0.75rem, 1.5vw, 1rem);
      height: clamp(2.25rem, 3.5vh, 2.75rem);
      max-height: clamp(2.25rem, 3.5vh, 2.75rem);
      flex-shrink: 0;
      transition: opacity 250ms ease;
      pointer-events: auto;
    }

    .seekbar-view.hidden { opacity: 0; pointer-events: none; }

    .seekbar-time {
      color: rgba(255,255,255,0.9);
      font-size: clamp(0.8rem, 1vw, 0.9rem);
      font-variant-numeric: tabular-nums;
      width: clamp(2.5rem, 4vw, 3rem);
      text-align: right;
    }

    .seekbar-track {
      position: relative;
      flex: 1;
      height: clamp(1.5rem, 3vh, 2rem);
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .seekbar-focus {
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      border-radius: 0.5rem;
      transition: box-shadow 200ms ease, transform 200ms ease;
    }

    .seekbar-focus[data-focused="true"] .seekbar-track-bg {
      height: 0.5rem;
      border-radius: 0.5rem;
    }

    .seekbar-track:hover .seekbar-track-bg {
      height: 0.5rem;
      border-radius: 0.5rem;
    }

    .seekbar-track-bg {
      position: absolute;
      inset: 0;
      margin: auto;
      width: 100%;
      height: 0.375rem;
      background: rgba(255,255,255,0.3);
      border-radius: 0.375rem;
      transition: height 200ms cubic-bezier(.05, 0, .3, 1), border-radius 200ms cubic-bezier(.05, 0, .3, 1);
      overflow: hidden;
    }

    .seekbar-buffered {
      position: absolute;
      inset: 0;
      left: 0;
      background: rgba(255,255,255,0.12);
      width: 100%;
      transform-origin: left;
    }

    .seekbar-fill {
      position: absolute;
      inset: 0;
      left: 0;
      background: #f1f1f1;
      width: 100%;
      transform-origin: left;
      transition: background 200ms ease;
    }

    .seekbar-focus[data-focused="true"] .seekbar-fill {
      background: linear-gradient(to right, #f03 80%, #ff2791 100%);
    }

    .seekbar-track:hover .seekbar-fill {
      background: linear-gradient(to right, #f03 80%, #ff2791 100%);
    }

    .seekbar-thumb {
      position: absolute;
      top: 50%;
      left: 0;
      width: 1rem;
      height: 1rem;
      border: none;
      background: #f1f1f1;
      border-radius: 50%;
      display: none;
      pointer-events: none;
    }

    .seekbar-focus[data-focused="true"] .seekbar-thumb {
      display: block;
      transform: translateX(calc(var(--thumb-x, 0px) - 0.5rem)) translateY(-50%) scale(1.25);
    }

    .seekbar-track:hover .seekbar-thumb {
      display: block;
      transform: translateX(calc(var(--thumb-x, 0px) - 0.5rem)) translateY(-50%) scale(1.25);
    }

    .seekbar-time-end {
      color: rgba(255,255,255,0.7);
      font-size: clamp(0.8rem, 1vw, 0.9rem);
      font-variant-numeric: tabular-nums;
      width: clamp(2.5rem, 4vw, 3rem);
      text-align: right;
    }
  `;

  protected createRenderRoot(): Element | ShadowRoot {
    const root = super.createRenderRoot();
    const shadow = root as ShadowRoot;
    if (shadow.adoptedStyleSheets) {
      shadow.adoptedStyleSheets = [ctvIconSheet, ...shadow.adoptedStyleSheets];
    }
    return root;
  }

  @property({ type: Boolean }) showControls = false;
  @property({ type: Object, attribute: false }) videoEl: HTMLVideoElement | null = null;

  @state() private _duration = 0;

  private registrar = new FocusableRegistrar();
  private rafId = 0;
  private _seekbarTrackWidth = 0;
  private _seekbarTrackObserver: ResizeObserver | null = null;
  private _focusableRegistered = false;

  private _isSeeking = false;
  private _wasPlayingBeforeSeek = false;
  private _seekAccumulator = 0;
  private _seekEndTimer: ReturnType<typeof setTimeout> | null = null;
  private _seekKeyHeld = false;
  private _seekDirection = 0;
  private _seekHeldAt = 0;
  private _seekRepeatTimer: ReturnType<typeof setInterval> | null = null;
  private _seekTargetTime = 0;

  private _focused = false;

  connectedCallback() {
    super.connectedCallback();
    this._setupSeekbarHoldHandler();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardownSeekbarHoldHandler();
    this._stopAllTimers();
    this._stopSeekbarLoop();
    this._teardownTrackObserver();
    this.registrar.unregisterAll();
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('videoEl')) {
      this._stopSeekbarLoop();
      if (this.videoEl) this._startSeekbarLoop();
    }
    if (changedProperties.has('showControls')) {
      this._syncFocusable();
      if (this.showControls) {
        this._syncNow();
        // Restart loop if it stopped while paused
        if (!this.rafId && this.videoEl) this._startSeekbarLoop();
      }
    }
  }

  render() {
    const classes = { 'seekbar-view': true, hidden: !this.showControls };
    return html`
      <div class=${classMap(classes)}>
        <span class="seekbar-time" data-current-time>0:00</span>
        <div class="seekbar-focus" data-seekbar-focusable
             tabindex=${this.showControls ? '0' : '-1'}
             aria-disabled=${String(!this.showControls)}
             role="slider" aria-label="Barra de progreso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="seekbar-track" data-seekbar-track>
            <div class="seekbar-track-bg">
              <div class="seekbar-buffered" data-buffered style="transform: scaleX(0);"></div>
              <div class="seekbar-fill" data-fill style="transform: scaleX(0);"></div>
            </div>
            <div class="seekbar-thumb" data-thumb></div>
          </div>
        </div>
        <span class="seekbar-time-end" data-duration-time>${this._duration && isFinite(this._duration) && this._duration > 0 ? formatTime(this._duration) : '0:00'}</span>
      </div>
    `;
  }

  get durationLabel(): string {
    return this._duration && isFinite(this._duration) && this._duration > 0 ? formatTime(this._duration) : '0:00';
  }

  private _el<K extends string>(sel: K): HTMLElement | null {
    return this.renderRoot.querySelector(sel) as HTMLElement | null;
  }

  private _startSeekbarLoop() {
    if (!this.videoEl) return;
    const video = this.videoEl;
    const TICK_MS = 100;
    let lastPct = -1;
    let lastDur = 0;
    let lastBufferedPct = -1;
    let nextTickTime = 0;

    const timeLabel = this._el('[data-current-time]');
    const fill = this._el('[data-fill]');
    const buffered = this._el('[data-buffered]');
    const thumb = this._el('[data-thumb]');
    const seekbar = this._el('[data-seekbar-focusable]');
    const track = this._el('[data-seekbar-track]');

    if (track && !this._seekbarTrackObserver) {
      this._seekbarTrackWidth = track.clientWidth;
      this._seekbarTrackObserver = new ResizeObserver(([entry]) => {
        this._seekbarTrackWidth = entry.contentRect.width;
      });
      this._seekbarTrackObserver.observe(track);
    }

    const doSync = () => {
      const dur = video.duration || 0;
      const ct = this._isSeeking ? this._seekTargetTime : video.currentTime;
      const pct = dur > 0 ? (ct / dur) * 100 : 0;

      if (dur !== lastDur && isFinite(dur) && dur > 0) {
        lastDur = dur;
        this._duration = dur;
      }

      if (timeLabel) timeLabel.textContent = formatTime(ct);

      if (Math.abs(pct - lastPct) > 0.5) {
        lastPct = pct;
        let bufferedEnd = 0;
        if (video.buffered.length > 0) bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPct = dur > 0 ? (bufferedEnd / dur) * 100 : 0;

        if (fill) fill.style.transform = `scaleX(${pct / 100})`;
        if (Math.abs(bufferedPct - lastBufferedPct) > 0.5 && buffered) {
          lastBufferedPct = bufferedPct;
          buffered.style.transform = `scaleX(${bufferedPct / 100})`;
        }
        if (thumb && this._seekbarTrackWidth > 0) {
          const thumbX = (pct / 100) * this._seekbarTrackWidth;
          thumb.style.setProperty('--thumb-x', `${thumbX}px`);
        }
        if (seekbar) {
          seekbar.setAttribute('aria-valuenow', String(Math.round(pct)));
          seekbar.setAttribute('aria-valuetext', `${formatTime(ct)} de ${formatTime(dur)}`);
        }
      }
    };

    const update = () => {
      if (!this.showControls) {
        this.rafId = 0;
        return;
      }

      const now = performance.now();
      if (now < nextTickTime) {
        this.rafId = requestAnimationFrame(update);
        return;
      }
      nextTickTime = now + TICK_MS;

      doSync();
      this.rafId = requestAnimationFrame(update);
    };

    doSync();
    this.rafId = requestAnimationFrame(update);
  }

  private _stopSeekbarLoop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = 0; }
    this._teardownTrackObserver();
  }

  private _teardownTrackObserver() {
    if (this._seekbarTrackObserver) { this._seekbarTrackObserver.disconnect(); this._seekbarTrackObserver = null; }
    this._seekbarTrackWidth = 0;
  }

  private _syncNow() {
    if (!this.videoEl) return;
    const video = this.videoEl;
    const dur = video.duration || 0;
    const ct = this._isSeeking ? this._seekTargetTime : video.currentTime;
    const pct = dur > 0 ? (ct / dur) * 100 : 0;

    const timeLabel = this._el('[data-current-time]');
    const fill = this._el('[data-fill]');
    const thumb = this._el('[data-thumb]');
    const seekbar = this._el('[data-seekbar-focusable]');
    const bufferedEl = this._el('[data-buffered]');

    if (timeLabel) timeLabel.textContent = formatTime(ct);
    if (fill) fill.style.transform = `scaleX(${pct / 100})`;
    if (thumb && this._seekbarTrackWidth > 0) {
      const thumbX = (pct / 100) * this._seekbarTrackWidth;
      thumb.style.setProperty('--thumb-x', `${thumbX}px`);
    }
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const bufferedPct = dur > 0 ? (bufferedEnd / dur) * 100 : 0;
      if (bufferedEl) bufferedEl.style.transform = `scaleX(${bufferedPct / 100})`;
    }
    if (seekbar) {
      seekbar.setAttribute('aria-valuenow', String(Math.round(pct)));
      seekbar.setAttribute('aria-valuetext', `${formatTime(ct)} de ${formatTime(dur)}`);
    }
  }

  private _syncFocusable() {
    const seekbar = this._el('[data-seekbar-focusable]');
    if (this.showControls && seekbar) {
      if (!this._focusableRegistered) {
        this._focusableRegistered = true;
        this.registrar.register([{
          focusKey: 'watch-seekbar',
          node: seekbar,
          parentFocusKey: PARENT_FOCUS_KEY,
          onEnterPress: () => this._dispatch('play-toggle'),
          onArrowPress: (direction: string) => {
            if (!this.showControls) return true;
            if (direction === 'down') {
              this._dispatch('focus-playpause');
              return false;
            }
            if (direction === 'left') { this._seekBy(-SEEK_STEP_SECONDS); return false; }
            if (direction === 'right') { this._seekBy(SEEK_STEP_SECONDS); return false; }
            return true;
          },
          onFocus: () => {
            this._focused = true;
            seekbar.setAttribute('data-focused', 'true');
          },
          onBlur: () => {
            this._focused = false;
            seekbar.setAttribute('data-focused', 'false');
            this._stopSeekRepeat();
            this._resetSeekHold();
            if (this._isSeeking) this._endSeek();
          },
        }]);
      }
    } else if (this._focusableRegistered) {
      this._focusableRegistered = false;
      this.registrar.unregister('watch-seekbar');
    }
  }

  private _dispatch(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  private _seekBy(seconds: number) {
    if (!this.videoEl) return;
    if (!this._isSeeking) {
      this._isSeeking = true;
      this._wasPlayingBeforeSeek = !this.videoEl.paused;
      if (!this.videoEl.paused) this.videoEl.pause();
      if (!this.rafId) this._startSeekbarLoop();
    }
    this._seekAccumulator += seconds;
    this._seekTargetTime = Math.max(0, Math.min(this.videoEl.currentTime + this._seekAccumulator, this.videoEl.duration || 0));
    const dir = this._seekAccumulator > 0 ? 'forward' : 'backward';
    this._dispatch('seek-preview', { targetTime: this._seekTargetTime, direction: dir, accumulator: this._seekAccumulator });
    this._dispatch('seek-start');
    if (this._seekEndTimer) clearTimeout(this._seekEndTimer);
    this._seekEndTimer = setTimeout(() => this._endSeek(), 300);
  }

  private _applySeek() {
    if (!this.videoEl || !this._isSeeking) return;
    const video = this.videoEl;
    const duration = video.duration || 0;
    let target = Math.max(0, Math.min(video.currentTime + this._seekAccumulator, duration));
    if (video.seekable.length > 0) {
      target = Math.max(video.seekable.start(0), Math.min(target, video.seekable.end(video.seekable.length - 1)));
    }
    video.currentTime = target;
    this._seekAccumulator = 0;
    this._dispatch('seek-change');
  }

  private _endSeek() {
    if (!this._isSeeking) return;
    if (this._seekEndTimer) { clearTimeout(this._seekEndTimer); this._seekEndTimer = null; }
    this._applySeek();
    this._isSeeking = false;
    this._seekAccumulator = 0;
    this._seekTargetTime = 0;
    if (this._wasPlayingBeforeSeek && this.videoEl && this.videoEl.paused) this.videoEl.play().catch(() => { });
    this._wasPlayingBeforeSeek = false;
    this._dispatch('seek-end');
  }

  private _stopAllTimers() {
    if (this._seekEndTimer) clearTimeout(this._seekEndTimer);
    if (this._seekRepeatTimer) clearInterval(this._seekRepeatTimer);
    this._seekEndTimer = null;
    this._seekRepeatTimer = null;
  }

  private _setupSeekbarHoldHandler() {
    window.addEventListener('keydown', this._handleSeekbarKeyDown, true);
    window.addEventListener('keyup', this._handleSeekbarKeyUp, true);
  }

  private _teardownSeekbarHoldHandler() {
    window.removeEventListener('keydown', this._handleSeekbarKeyDown, true);
    window.removeEventListener('keyup', this._handleSeekbarKeyUp, true);
    this._stopSeekRepeat();
    this._resetSeekHold();
  }

  private _resetSeekHold() { this._seekKeyHeld = false; this._seekDirection = 0; this._seekHeldAt = 0; }

  private _startSeekRepeat(dir: number) {
    this._stopSeekRepeat();
    const tick = () => {
      if (!this._seekKeyHeld || !this.videoEl || !this._seekbarHoldCanIntercept()) {
        this._stopSeekRepeat(); this._resetSeekHold(); if (this._isSeeking) this._endSeek(); return;
      }
      const heldMs = performance.now() - this._seekHeldAt;
      const step = getSeekStep(heldMs);
      this._seekBy(dir * step);
      this._seekRepeatTimer = setTimeout(tick, getSeekInterval(heldMs)) as any;
    };
    this._seekRepeatTimer = setTimeout(tick, SEEK_REPEAT_MS) as any;
  }

  private _stopSeekRepeat() {
    if (this._seekRepeatTimer) { clearInterval(this._seekRepeatTimer); this._seekRepeatTimer = null; }
  }

  private _seekbarHoldCanIntercept(): boolean {
    const seekbar = this._el('[data-seekbar-focusable]');
    if (seekbar && (document.activeElement === seekbar || seekbar.contains(document.activeElement))) return true;
    if (!this.showControls) return false;
    return (getCurrentFocusKey() ?? '') === 'watch-seekbar';
  }

  private _handleSeekbarKeyDown = (e: KeyboardEvent) => {
    const code = e.keyCode || e.key;
    const dir = code === 37 || code === 'ArrowLeft' ? -1 : code === 39 || code === 'ArrowRight' ? 1 : 0;
    if (!dir || !this._seekbarHoldCanIntercept()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!this._seekKeyHeld) {
      this._seekKeyHeld = true; this._seekDirection = dir; this._seekHeldAt = performance.now();
      this._seekBy(dir * SEEK_STEP_SECONDS); this._startSeekRepeat(dir); return;
    }
    if (dir !== this._seekDirection) {
      this._seekDirection = dir; this._seekBy(dir * SEEK_STEP_SECONDS); this._startSeekRepeat(dir);
    }
  };

  private _handleSeekbarKeyUp = (e: KeyboardEvent) => {
    if (!this._seekKeyHeld) return;
    const code = e.keyCode || e.key;
    if (code !== 37 && code !== 'ArrowLeft' && code !== 39 && code !== 'ArrowRight') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const wasHold = performance.now() - this._seekHeldAt >= SEEK_REPEAT_MS;
    this._stopSeekRepeat(); this._resetSeekHold();
    if (wasHold) this._endSeek();
  };

  public seekBy(seconds: number) {
    this._seekBy(seconds);
  }

  public focusSeekbar() {
    SpatialNavigation.setFocus('watch-seekbar');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tv-player-seekbar': PlayerSeekbarElement;
  }
}
