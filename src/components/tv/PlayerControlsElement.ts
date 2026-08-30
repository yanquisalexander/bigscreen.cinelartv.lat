import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { SpatialNavigation, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation-core';
import type { Segment } from '@/types/content';
import type { FlatEpisode } from './RailEpisodeItem';
import { ctvIconSheet } from '@/lib/ctvIcons';
import { pdbg } from '@/services/player/playerDebug';
import { toastStore } from '@/stores/toastStore';
import { formatTime } from '@/utils/helpers';
import './PlayerSeekbarElement';
import './PlayerEpisodeRailElement';
import './PlayerSkipButtonElement';
import './PlayerNextCardElement';

const CONTROLS_HIDE_DELAY = 5000;
const LOGIC_TICK_MS = 1000;
const SEEK_STEP_SECONDS = 10;

interface EngineLike {
  getVariantTracksInfo(): any;
  getAudioTracksInfo(): any;
  selectQuality(option: number | 'auto'): void;
  selectAudioTrack(language: string, role?: string): void;
  on(event: 'playing' | 'paused' | 'buffering' | 'error' | 'timeupdate' | 'durationchange' | 'ended' | 'trackschanged', callback: (data?: any) => void): () => void;
  off?(event: 'playing' | 'paused' | 'buffering' | 'error' | 'timeupdate' | 'durationchange' | 'ended' | 'trackschanged', callback: (data?: any) => void): void;
  seek(time: number): void;
}

@customElement('tv-player-controls')
export class PlayerControlsElement extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 15;
      contain: layout style;
    }

    .controls-overlay {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2;
      display: flex;
      flex-direction: column;
      overflow: visible;
      transition: transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
    }

    .controls-overlay.hidden { pointer-events: none; }

    :host([rail-expanded]) .controls-overlay {
      transform: translateY(clamp(-6rem, -10vh, -8rem));
    }

    :host(.controls-hidden) .controls-overlay { pointer-events: none; }

    :host([rail-expanded]) .bottom-scrim,
    :host(.controls-hidden) .bottom-scrim {
      opacity: 0;
      pointer-events: none;
    }

    .player-watermark {
      position: absolute;
      top: clamp(1.25rem, 3.4vh, 2rem);
      right: clamp(2rem, 4vw, 3rem);
      z-index: 2;
      color: #fff;
      font-size: clamp(1.1rem, 1.45vw, 1.2rem);
      font-weight: 500;
      letter-spacing: 0.02em;
      opacity: 1;
      pointer-events: none;
      transition: opacity 180ms ease, transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    :host(.controls-hidden) .player-watermark { opacity: 0.25; }
    :host(.controls-hidden) .top-scrim { opacity: 0; }
    :host([rail-expanded]) .player-watermark { opacity: 0; transform: translateY(-0.5rem); }

    .top-scrim {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 2;
      box-sizing: border-box;
      background: linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.3), transparent);
      padding: clamp(1.25rem, 3.4vh, 2rem) clamp(2rem, 4vw, 3rem);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: clamp(1rem, 2vw, 1.5rem);
      pointer-events: none;
      transition: opacity 300ms ease;
    }

    :host([rail-expanded]) .top-scrim { opacity: 0; }

    .top-title { margin-top: clamp(1rem, 3vh, 1.75rem); max-width: 60vw; }
    .top-title h1 { color: #ffffff; font-weight: 700; font-size: clamp(1.5rem, 2.6vw, 2.2rem); line-height: 1.2; }
    .top-title p { color: rgba(255,255,255,0.3); font-size: 15px; font-weight: 500; margin-top: 0.25rem; }

    .controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      margin-top: clamp(0.25rem, 0.6vh, 0.5rem);
      flex-shrink: 0;
      max-height: clamp(3.5rem, 6vw, 4rem);
    }

    .controls-row-left, .controls-row-right { display: flex; align-items: center; gap: clamp(0.5rem, 1vw, 0.75rem); flex: 1; }
    .controls-row-left { justify-content: flex-start; }
    .controls-row-right { justify-content: flex-end; }
    .controls-row-center { display: flex; align-items: center; justify-content: center; gap: clamp(0.5rem, 1vw, 0.75rem); flex-shrink: 0; }

    .control-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #f1f1f1;
      background: rgba(255,255,255,0.1);
      border: none;
      cursor: pointer;
      outline: none;
      pointer-events: auto;
    }

    .control-btn[data-focused="true"] {
      background: #f1f1f1;
      color: #0f0f0f;
    }

    .circle-btn { width: 3rem; height: 3rem; border-radius: 1.5rem; }
    .play-pause-btn { width: 4rem; height: 4rem; border-radius: 2rem; }
    .pill-btn { padding: 0 1rem; height: 2.25rem; border-radius: 1.125rem; font-size: clamp(0.7rem, 0.9vw, 0.8rem); font-weight: 600; letter-spacing: 0.01em; gap: 0.35rem; }

    .pill-group {
      display: inline-flex;
      align-items: center;
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 1.125rem;
      vertical-align: middle;
      position: relative;
      margin-left: 0;
      pointer-events: auto;
    }

    .pill-group .control-btn {
      background-color: transparent;
      color: #f1f1f1;
      border-radius: 1.125rem;
      height: 2.25rem;
      line-height: 2.25rem;
      box-shadow: none;
    }

    .pill-group .control-btn.icon-only {
      width: 2.25rem;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .pill-group .control-btn[data-focused="true"] {
      background-color: #f1f1f1;
      color: #0f0f0f;
    }

    .control-btn .ctv-icon { font-size: clamp(1.1rem, 2vw, 1.3rem); line-height: 1; color: inherit; }
    .control-btn.play-pause-btn .ctv-icon { font-size: clamp(1.3rem, 2.4vw, 1.5rem); }

    .bottom-scrim {
      width: 100%;
      box-sizing: border-box;
      padding: clamp(0.5rem, 1vh, 0.75rem) clamp(2rem, 4vw, 3rem) clamp(0.5rem, 1vh, 0.75rem);
      pointer-events: auto;
      transition: opacity 300ms ease;
    }

    .controls-row.hidden { opacity: 0; pointer-events: none; }

    .buffering {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .buffering-spinner {
      width: clamp(2.5rem, 5vw, 3.5rem);
      height: clamp(2.5rem, 5vw, 3.5rem);
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .seek-preview-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 20;
      opacity: 0;
      transition: opacity 150ms ease;
    }

    .seek-preview-overlay.visible { opacity: 1; }

    .seek-preview-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.85);
      border-radius: 1rem;
      padding: 0.75rem 1.5rem;
      color: #fff;
      font-size: clamp(1.4rem, 2.5vw, 2rem);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }

    .seek-preview-badge .ctv-icon {
      font-size: clamp(1.2rem, 2vw, 1.6rem);
      color: #f03;
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

  private controlsTimer: ReturnType<typeof setTimeout> | null = null;
  private logicTimer: ReturnType<typeof setInterval> | null = null;
  private _restoreFocusOnShow = false;
  private _restoreFocusRetry = 0;
  private _restoreFocusToken = 0;
  private _nextCardRef: any = null;

  @state() private _isPlaying = false;
  @state() private _duration = 0;
  @state() private _lastEnterKey = '';
  @state() private _lastEnterTime = 0;
  @state() private _lastFocusedControlKey = 'watch-playpause';
  @state() private _currentEpisodeId: string | number | null = null;
  @state() private _allEpisodes: FlatEpisode[] = [];
  @state() private _seekPreviewVisible = false;
  @state() private _seekPreviewTime = 0;
  @state() private _seekPreviewDirection: 'forward' | 'backward' = 'forward';

  private _onPlay: (() => void) | null = null;
  private _onPause: (() => void) | null = null;
  private _onWaiting: (() => void) | null = null;
  private _onPlaying: (() => void) | null = null;
  private _onDurationChange: (() => void) | null = null;
  private _engineUnsubs: Array<() => void> = [];

  @property({ type: Object, attribute: false }) videoEl!: HTMLVideoElement | null;
  @property({ type: Object, attribute: false }) engineRef!: EngineLike | null;
  @property({ type: Object, attribute: false }) episodes!: { episodes: FlatEpisode[]; currentId: string | number | null; contentId: string | null };
  @property({ type: Array, attribute: false }) segments!: Segment[];
  @property({ type: String, attribute: 'client-endpoint' }) clientEndpoint!: string;
  @property({ type: String, attribute: 'content-id' }) contentId!: string | null;

  @property({ type: String }) contentTitle!: string;
  @property({ type: String }) contentSubtitle!: string;

  @property({ type: Boolean, attribute: 'rail-expanded', reflect: true }) railExpanded!: boolean;
  @property({ type: Boolean, attribute: 'settings-open', reflect: true }) settingsOpen!: boolean;
  @property({ type: Object, attribute: false }) nextEpisode!: FlatEpisode | null;
  @property({ type: Object, attribute: false }) skipSegment!: Segment | null;
  @property({ type: Boolean, attribute: 'is-buffering' }) isBuffering!: boolean;
  @property({ type: Boolean, attribute: 'show-controls', reflect: true }) showControls!: boolean;

  constructor() {
    super();
    this._isPlaying = false;
    this._duration = 0;
    this.videoEl = null;
    this.engineRef = null;
    this.episodes = { episodes: [], currentId: null, contentId: null };
    this.segments = [];
    this.clientEndpoint = '';
    this.contentId = null;
    this.contentTitle = '';
    this.contentSubtitle = '';
    this.railExpanded = false;
    this.settingsOpen = false;
    this.nextEpisode = null;
    this.skipSegment = null;
    this.isBuffering = false;
    this.showControls = true;
  }

  connectedCallback() {
    super.connectedCallback();
    this._setupGlobalKeyHandler();
    this.addEventListener('enter-press', this._handleEnterPress);
    this.addEventListener('focus-gained', this._handleFocusGained);
    this.addEventListener('focus-lost', this._handleFocusLost);
    this.addEventListener('arrow-press', this._handleArrowPress);
    this.addEventListener('seek-preview', this._handleSeekPreview as EventListener);
    this.addEventListener('seek-end', this._handleSeekEnd as EventListener);
    this.addEventListener('seek-apply', this._handleSeekApply as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopAllTimers();
    this._teardownVideo();

    const keyHandler = (this as any)._keyHandler;
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler, true);
      (this as any)._keyHandler = null;
    }

    this.removeEventListener('enter-press', this._handleEnterPress);
    this.removeEventListener('focus-gained', this._handleFocusGained);
    this.removeEventListener('focus-lost', this._handleFocusLost);
    this.removeEventListener('arrow-press', this._handleArrowPress);
    this.removeEventListener('seek-preview', this._handleSeekPreview as EventListener);
    this.removeEventListener('seek-end', this._handleSeekEnd as EventListener);
    this.removeEventListener('seek-apply', this._handleSeekApply as EventListener);
  }

  private _stopAllTimers() {
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    this.controlsTimer = null;
    if (this.logicTimer) { clearInterval(this.logicTimer); this.logicTimer = null; }
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (changedProperties.has('videoEl') || changedProperties.has('engineRef')) {
      const hadEngine = changedProperties.get('engineRef') !== undefined && changedProperties.get('engineRef') !== null;
      const hasEngine = this.engineRef != null;

      this._teardownVideo();
      if (this.videoEl) this._initVideoListeners();

      // If engineRef arrived after videoEl was already set, sync duration
      if (!hadEngine && hasEngine && this.videoEl) {
        const dur = this.videoEl.duration;
        if (dur && isFinite(dur) && dur > 0) {
          this._duration = dur;
        }
      }
    }

    if (changedProperties.has('episodes')) {
      this._allEpisodes = this.episodes.episodes;
      this._currentEpisodeId = this.episodes.currentId;
      this.contentId = this.episodes.contentId;
    }

    if (changedProperties.has('settingsOpen') && changedProperties.get('settingsOpen') !== undefined) {
      this.dispatchEvent(new CustomEvent('settings-toggle', {
        bubbles: true,
        composed: true,
        detail: { open: this.settingsOpen },
      }));
    }

    if (changedProperties.has('isBuffering')) {
      this._syncOverlayFocusability();
    }

    if (changedProperties.has('showControls')) {
      this.classList.toggle('controls-hidden', !this.showControls);

      if (!this.showControls) {
        this._clearFocusedStates();
      }

      if (this.showControls) {
        this._restartControlsHideTimer();

        if (this._restoreFocusOnShow) {
          this._restoreFocusOnShow = false;
          this._restoreFocusRetry = 0;
          this._restoreFocusToken += 1;
          void this._restoreControlFocusWhenReady(this._restoreFocusToken);
        }
      }
    }

    if (changedProperties.has('railExpanded')) {
      this._restartControlsHideTimer();
    }

    // Cache next-card ref after render (avoids querySelector in logic timer)
    if (!this._nextCardRef) {
      this._nextCardRef = this.renderRoot.querySelector('tv-player-next-card');
    }
  }

  render() {
    const controlsOverlayClasses = { 'controls-overlay': true, hidden: !this.showControls };
    const controlsRowClasses = { 'controls-row': true, hidden: !this.showControls };

    return html`
      <div class="top-scrim">
        <div class="top-title">
          <h1 data-title>${this.contentTitle}</h1>
          <p data-subtitle>${this.contentSubtitle}</p>
        </div>
      </div>

      <div class=${classMap(controlsOverlayClasses)} data-controls-overlay>
        <div class="bottom-scrim">
          <div class="episodes-container" data-episodes-container>
            <tv-player-seekbar
              .videoEl=${this.videoEl}
              .showControls=${this.showControls}
              @play-toggle=${this.togglePlayPause}
              @focus-playpause=${() => this._focusControl('watch-playpause')}
              @seek-start=${() => { this.showControls = true; this._restartControlsHideTimer(); }}
              @seek-change=${() => { this.showControls = true; this._restartControlsHideTimer(); }}
              @seek-end=${() => { }}
            ></tv-player-seekbar>

            <div class=${classMap(controlsRowClasses)}>
              <div class="controls-row-left" data-episodes-btn-container>
                ${this._allEpisodes.length > 0 ? html`
                  <div class="pill-group" data-pill-group>
                    <tv-focusable id="episodes-btn" focus-key="watch-episodes" parent-focus-key="watch-root" data-focused="false" class="control-btn pill-btn"
                      focusable=${this.showControls ? 'true' : 'false'}>
                      <i class="ctv-icon ctv-episodes-list"></i>
                      <span>Episodios</span>
                    </tv-focusable>
                    <tv-focusable id="restart-btn" focus-key="watch-restart" parent-focus-key="watch-root" data-focused="false" class="control-btn pill-btn"
                      focusable=${this.showControls ? 'true' : 'false'}>
                      <i class="ctv-icon ctv-arrow-counter-clockwise"></i>
                      <span>Comenzar de nuevo</span>
                    </tv-focusable>
                  </div>
                ` : ''}
              </div>

              <div class="controls-row-center">
                <tv-focusable focus-key="watch-seek-back" parent-focus-key="watch-root" data-focused="false" class="control-btn circle-btn" data-seek-back
                  focusable=${this.showControls ? 'true' : 'false'}>
                  <i class="ctv-icon ctv-seek-previus"></i>
                </tv-focusable>
                <tv-focusable focus-key="watch-playpause" parent-focus-key="watch-root" data-focused="false" class="control-btn circle-btn play-pause-btn"
                  focusable=${this.showControls ? 'true' : 'false'}>
                  ${this._isPlaying ? html`
                    <i class="ctv-icon ctv-pause"></i>
                  ` : html`
                    <i class="ctv-icon ctv-play"></i>
                  `}
                </tv-focusable>
                <tv-focusable focus-key="watch-seek-fwd" parent-focus-key="watch-root" data-focused="false" class="control-btn circle-btn" data-seek-fwd
                  focusable=${this.showControls ? 'true' : 'false'}>
                  <i class="ctv-icon ctv-seek-forward"></i>
                </tv-focusable>
              </div>

              <div class="controls-row-right">
                <div class="pill-group" data-pill-group>
                  <tv-focusable id="captions-btn" focus-key="watch-captions" parent-focus-key="watch-root" data-focused="false" class="control-btn pill-btn"
                    focusable=${this.showControls ? 'true' : 'false'}>
                    <i class="ctv-icon ctv-closed-caption"></i>
                    <span>Subtítulos</span>
                  </tv-focusable>
                  <tv-focusable focus-key="watch-settings" parent-focus-key="watch-root" data-focused="false" class="control-btn pill-btn icon-only"
                    focusable=${this.showControls ? 'true' : 'false'}>
                    <i class="ctv-icon ctv-settings"></i>
                  </tv-focusable>
                </div>
              </div>
            </div>
          </div>
        </div>

        <tv-player-episode-rail
          .episodes=${this._allEpisodes}
          .currentEpisodeId=${this._currentEpisodeId}
          .expanded=${this.railExpanded}
          .controlsHidden=${!this.showControls}
          .clientEndpoint=${this.clientEndpoint}
          @episode-select=${(e: CustomEvent) => this._selectEpisode(e.detail.episodeId)}
          @rail-collapse=${() => { this.railExpanded = false; this._focusControl('watch-episodes'); }}
        ></tv-player-episode-rail>
      </div>

      <div class="player-watermark" aria-hidden="true">CinelarTV</div>

      <div class="seek-preview-overlay ${this._seekPreviewVisible ? 'visible' : ''}" aria-hidden="true">
        <div class="seek-preview-badge">
          <i class="ctv-icon ${this._seekPreviewDirection === 'forward' ? 'ctv-seek-forward' : 'ctv-seek-previus'}"></i>
          <span>${formatTime(this._seekPreviewTime)}</span>
        </div>
      </div>

      <tv-player-skip-btn
        .segment=${this.skipSegment}
        .showControls=${this.showControls}
        @skip=${(e: CustomEvent) => this._handleSkip(e.detail.endTime)}
      ></tv-player-skip-btn>

      <tv-player-next-card
        .episode=${this.nextEpisode}
        .contentId=${this.contentId}
        .clientEndpoint=${this.clientEndpoint}
        @play-next=${this.playNextEpisode}
        @cancel-next=${this.cancelNextEpisode}
      ></tv-player-next-card>

      ${this.isBuffering ? html`
        <div class="buffering" data-buffering>
          <div class="buffering-spinner"></div>
        </div>
      ` : ''}
    `;
  }

  private _initVideoListeners() {
    if (!this.videoEl) return;
    const video = this.videoEl;

    // If we have an engine, use its event system instead of raw video events
    if (this.engineRef && this.engineRef.on) {
      this._engineUnsubs.push(
        this.engineRef.on('playing', () => { this._isPlaying = true; })
      );
      this._engineUnsubs.push(
        this.engineRef.on('paused', () => { this._isPlaying = false; })
      );
      this._engineUnsubs.push(
        this.engineRef.on('buffering', (val: any) => { this.isBuffering = val !== false; })
      );
      this._engineUnsubs.push(
        this.engineRef.on('durationchange', (d: any) => { this._duration = d || 0; })
      );
      this._engineUnsubs.push(
        this.engineRef.on('ended', () => {
          this.dispatchEvent(new CustomEvent('ended', { bubbles: true, composed: true }));
        })
      );
      // Sync duration from video element on timeupdate (fallback for adaptive streams)
      this._engineUnsubs.push(
        this.engineRef.on('timeupdate', () => {
          if (!this.videoEl) return;
          const dur = this.videoEl.duration;
          if (dur && isFinite(dur) && dur > 0 && dur !== this._duration) {
            this._duration = dur;
          }
        })
      );
      pdbg('controls._initVideoListeners', 'engine event listeners attached');
      this._startLogicTimer();
      return;
    }

    // Fallback: listen directly on video element
    pdbg('controls._initVideoListeners', 'engine not available, using direct video listeners');
    this._onPlay = () => { this._isPlaying = true; };
    this._onPause = () => { this._isPlaying = false; };
    this._onWaiting = () => { this.isBuffering = true; };
    this._onPlaying = () => { this.isBuffering = false; };
    this._onDurationChange = () => { this._duration = video.duration || 0; };

    video.addEventListener('play', this._onPlay);
    video.addEventListener('pause', this._onPause);
    video.addEventListener('waiting', this._onWaiting);
    video.addEventListener('playing', this._onPlaying);
    video.addEventListener('canplay', this._onPlaying);
    video.addEventListener('canplaythrough', this._onPlaying);
    video.addEventListener('durationchange', this._onDurationChange);

    this._startLogicTimer();
  }

  private _teardownVideo() {
    // Clean up engine event listeners
    for (const unsub of this._engineUnsubs) {
      unsub();
    }
    this._engineUnsubs = [];

    if (this.videoEl) {
      if (this._onPlay) this.videoEl.removeEventListener('play', this._onPlay);
      if (this._onPause) this.videoEl.removeEventListener('pause', this._onPause);
      if (this._onWaiting) this.videoEl.removeEventListener('waiting', this._onWaiting);
      if (this._onPlaying) {
        this.videoEl.removeEventListener('playing', this._onPlaying);
        this.videoEl.removeEventListener('canplay', this._onPlaying);
        this.videoEl.removeEventListener('canplaythrough', this._onPlaying);
      }
      if (this._onDurationChange) this.videoEl.removeEventListener('durationchange', this._onDurationChange);
    }
    this._onPlay = null;
    this._onPause = null;
    this._onWaiting = null;
    this._onPlaying = null;
    this._onDurationChange = null;

    if (this.logicTimer) { clearInterval(this.logicTimer); this.logicTimer = null; }
  }

  private _startLogicTimer() {
    this.logicTimer = setInterval(() => {
      if (!this.videoEl) return;
      const ct = this.videoEl.currentTime;
      const dur = this.videoEl.duration || 0;

      const active = this.segments.find((s) => {
        const start = s.start ?? s.start_time ?? 0;
        const end = s.end ?? s.end_time ?? 0;
        return ct >= start && ct <= end && (s.type === 'intro' || s.segment_type === 'skip_intro' || s.type === 'resume' || s.segment_type === 'skip_resume');
      });

      if (active && active !== this.skipSegment) this.skipSegment = active;
      else if (!active && this.skipSegment) this.skipSegment = null;

      if (this.nextEpisode && dur > 60) {
        const nearEnd = ct > 0 && (dur - ct) <= 30;
        const card = this._nextCardRef;
        if (nearEnd) {
          if (card && typeof card.show === 'function') card.show();
        } else {
          if (card && typeof card.hide === 'function') card.hide();
        }
      }
    }, LOGIC_TICK_MS);
  }

  private _selectEpisode(episodeId: string | number) {
    this.dispatchEvent(new CustomEvent('episode-select', { bubbles: true, composed: true, detail: { episodeId } }));
  }

  private _handleSkip(endTime: number) {
    if (this.engineRef && typeof this.engineRef.seek === 'function') {
      this.engineRef.seek(endTime);
    } else if (this.videoEl) {
      this.videoEl.currentTime = endTime;
    }
    this.skipSegment = null;
    this.dispatchEvent(new CustomEvent('skip', { bubbles: true, composed: true }));
  }

  private _clearFocusedStates() {
    this.renderRoot.querySelectorAll('[data-focused="true"]').forEach((el) => {
      el.setAttribute('data-focused', 'false');
    });
  }

  private _syncOverlayFocusability() {
    if (this.showControls) return;

    const currentFocus = getCurrentFocusKey() ?? '';
    if (currentFocus.startsWith('player-settings')) return;

    const hiddenOverlayFocusKeys = new Set([
      'watch-playpause',
      'watch-settings',
      'watch-captions',
      'watch-episodes',
      'watch-restart',
      'watch-seekbar',
    ]);

    const isHiddenOverlayFocus =
      !currentFocus ||
      hiddenOverlayFocusKeys.has(currentFocus) ||
      currentFocus.startsWith('rail-ep-item-');

    if (!isHiddenOverlayFocus) return;

    requestAnimationFrame(() => {
      const nowFocus = getCurrentFocusKey() ?? '';
      const stillHidden =
        !nowFocus ||
        hiddenOverlayFocusKeys.has(nowFocus) ||
        nowFocus.startsWith('rail-ep-item-');

      if (stillHidden && nowFocus !== 'watch-root') {
        try { SpatialNavigation.setFocus('watch-root'); } catch (_err) { /* noop */ }
      }
    });
  }

  private _restartControlsHideTimer() {
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    if (this.settingsOpen || this.railExpanded) return;
    if (!this.videoEl || this.videoEl.paused) return;
    const currentFocus = getCurrentFocusKey() ?? '';
    if (currentFocus.startsWith('player-settings')) return;

    this.controlsTimer = setTimeout(() => {
      if (!this.videoEl || this.videoEl.paused || this.settingsOpen || this.railExpanded) return;
      const activeFocus = getCurrentFocusKey() ?? '';
      if (activeFocus.startsWith('player-settings')) return;
      this.showControls = false;
    }, CONTROLS_HIDE_DELAY);
  }

  private _setupGlobalKeyHandler() {
    const handleKey = (e: KeyboardEvent) => {
      const isDirectional = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      const isAction = e.key === 'Enter' || e.key === ' ';
      if (!isDirectional && !isAction) return;

      const currentFocus = getCurrentFocusKey() ?? '';
      if (this.settingsOpen || currentFocus.startsWith('player-settings') || this.showControls) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      this.showControls = true;
      this._restoreFocusOnShow = true;
    };

    window.addEventListener('keydown', handleKey, true);
    (this as any)._keyHandler = handleKey;
  }

  private _canFocusControl(focusKey: string): boolean {
    if (!focusKey) return false;
    if (focusKey.startsWith('rail-ep-item-') && !this.railExpanded) return false;
    if (focusKey === 'watch-seekbar' && (!this.showControls || this.railExpanded)) return false;
    if (focusKey === 'watch-skip' && !this.skipSegment) return false;
    if ((focusKey === 'watch-next-play' || focusKey === 'watch-next-cancel') && (!this.nextEpisode)) return false;

    const el = this._getControlElement(focusKey);
    if (!el) return false;
    if (el.getAttribute('focusable') === 'false') return false;
    if (el.getAttribute('aria-disabled') === 'true') return false;

    return true;
  }

  private _getControlElement(focusKey: string): HTMLElement | null {
    if (focusKey === 'watch-seekbar') {
      return this.renderRoot.querySelector('tv-player-seekbar') as HTMLElement | null;
    }
    if (focusKey === 'watch-skip') {
      return this.renderRoot.querySelector('tv-player-skip-btn') as HTMLElement | null;
    }
    return this.renderRoot.querySelector(`[focus-key="${focusKey}"]`) as HTMLElement | null;
  }

  private _focusControl(focusKey: string): boolean {
    if (!this._canFocusControl(focusKey)) return false;

    requestAnimationFrame(() => {
      if (!this._canFocusControl(focusKey)) return;
      try { SpatialNavigation.setFocus(focusKey); } catch (_err) { /* noop */ }
    });

    return true;
  }

  private _restoreControlFocusWhenReady(token: number): Promise<void> {
    const doRestore = async (): Promise<void> => {
      if (token !== this._restoreFocusToken) return;

      await this.updateComplete;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      if (token !== this._restoreFocusToken) return;

      const candidates = [
        this._lastFocusedControlKey,
        'watch-playpause',
        'watch-seek-back',
        'watch-seek-fwd',
        'watch-seekbar',
        'watch-episodes',
        'watch-restart',
        'watch-captions',
        'watch-settings',
        'watch-skip',
        'watch-next-play',
        'watch-next-cancel',
      ].filter((key): key is string => Boolean(key));

      for (const key of candidates) {
        if (!this._canFocusControl(key)) continue;
        try { SpatialNavigation.setFocus(key); } catch (_err) { /* noop */ }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (token !== this._restoreFocusToken) return;
        if (getCurrentFocusKey() === key) return;
      }

      if (this._restoreFocusRetry < 5) {
        this._restoreFocusRetry += 1;
        requestAnimationFrame(() => void doRestore());
        return;
      }

      try { SpatialNavigation.setFocus('watch-root'); } catch (_err) { /* noop */ }
    };
    return doRestore();
  }

  private _handleEnterPress = (e: Event) => {
    const source = e.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'));
    const key = source?.getAttribute('focus-key');
    if (!key || (key === this._lastEnterKey && e.timeStamp - this._lastEnterTime < 300)) return;
    this._lastEnterKey = key;
    this._lastEnterTime = e.timeStamp;
    switch (key) {
      case 'watch-playpause': this.togglePlayPause(); break;
      case 'watch-episodes': this.toggleEpisodesRail(); break;
      case 'watch-restart': this.restartVideo(); break;
      case 'watch-settings': this.toggleSettings(); break;
      case 'watch-captions': this.showCaptionsToast(); break;
      case 'watch-seek-back': {
        const seekbar = this.renderRoot.querySelector('tv-player-seekbar') as any;
        if (seekbar && typeof seekbar.seekBy === 'function') seekbar.seekBy(-SEEK_STEP_SECONDS);
        break;
      }
      case 'watch-seek-fwd': {
        const seekbar = this.renderRoot.querySelector('tv-player-seekbar') as any;
        if (seekbar && typeof seekbar.seekBy === 'function') seekbar.seekBy(SEEK_STEP_SECONDS);
        break;
      }
      case 'watch-next-play': this.playNextEpisode(); break;
      case 'watch-next-cancel': this.cancelNextEpisode(); break;
    }
    this._restartControlsHideTimer();
  };

  private _handleFocusGained = (e: Event) => {
    const source = e.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'));
    const key = source?.getAttribute('focus-key');
    if (!key) return;
    if (key.startsWith('watch-') || key.startsWith('rail-ep-item-')) this._lastFocusedControlKey = key;
    this._restartControlsHideTimer();
  };

  private _handleFocusLost = (_e: Event) => {
    if (!this.railExpanded) return;
    requestAnimationFrame(() => {
      const currentFocus = getCurrentFocusKey();
      if (currentFocus === 'watch-episodes' || currentFocus === 'watch-restart' || currentFocus === 'watch-captions' || currentFocus === 'episodes-rail' || currentFocus?.startsWith('rail-ep-item-')) return;
      this.railExpanded = false;
    });
  };

  private _handleSeekPreview = (e: CustomEvent) => {
    this._seekPreviewVisible = true;
    this._seekPreviewTime = e.detail.targetTime;
    this._seekPreviewDirection = e.detail.direction;
  };

  private _handleSeekEnd = () => {
    this._seekPreviewVisible = false;
    this._seekPreviewTime = 0;
  };

  private _handleSeekApply = (e: CustomEvent) => {
    const time = e.detail?.time;
    if (time == null) return;
    if (this.engineRef && typeof this.engineRef.seek === 'function') {
      this.engineRef.seek(time);
    } else if (this.videoEl) {
      this.videoEl.currentTime = time;
    }
  };

  private _handleArrowPress = (e: Event) => {
    const custom = e as CustomEvent<{ direction?: string }>;
    const source = custom.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'));
    const key = source?.getAttribute('focus-key');
    this._restartControlsHideTimer();

    if (key === 'watch-settings' && custom.detail?.direction === 'left') { custom.preventDefault(); this._focusControl('watch-captions'); return; }
    if (key === 'watch-captions' && custom.detail?.direction === 'left') { custom.preventDefault(); this._focusControl('watch-seek-fwd'); return; }
    if (key === 'watch-captions' && custom.detail?.direction === 'right') { custom.preventDefault(); this._focusControl('watch-settings'); return; }
    if (key === 'watch-playpause' && custom.detail?.direction === 'left') { custom.preventDefault(); this._focusControl('watch-seek-back'); return; }
    if (key === 'watch-playpause' && custom.detail?.direction === 'right') { custom.preventDefault(); this._focusControl('watch-seek-fwd'); return; }
    if (key === 'watch-seek-back' && custom.detail?.direction === 'right') { custom.preventDefault(); this._focusControl('watch-playpause'); return; }
    if (key === 'watch-seek-fwd' && custom.detail?.direction === 'left') { custom.preventDefault(); this._focusControl('watch-playpause'); return; }
    if (key === 'watch-seek-fwd' && custom.detail?.direction === 'right') { custom.preventDefault(); this._focusControl('watch-captions'); return; }
    if (key === 'watch-episodes' && custom.detail?.direction === 'right') { custom.preventDefault(); this._focusControl('watch-restart'); return; }
    if (key === 'watch-restart' && custom.detail?.direction === 'right') { custom.preventDefault(); this._focusControl('watch-seek-back'); return; }
    if (key === 'watch-restart' && custom.detail?.direction === 'left') { custom.preventDefault(); this._focusControl('watch-episodes'); return; }
    if (key === 'watch-seek-back' && custom.detail?.direction === 'left') { custom.preventDefault(); this._focusControl('watch-restart'); return; }

    if (!['watch-episodes', 'watch-restart', 'watch-seek-back', 'watch-playpause', 'watch-seek-fwd', 'watch-captions', 'watch-settings'].includes(key ?? '') || custom.detail?.direction !== 'down' || this._allEpisodes.length === 0) return;

    custom.preventDefault();
    this.railExpanded = true;
    const episodeRail = this.renderRoot.querySelector('tv-player-episode-rail') as any;
    if (episodeRail && typeof episodeRail.focusEpisodeRail === 'function') {
      episodeRail.focusEpisodeRail();
    }
  };

  focusPlayPause() { SpatialNavigation.setFocus('watch-playpause'); }
  focusSettings() { SpatialNavigation.setFocus('watch-settings'); }
  focusSkip() { SpatialNavigation.setFocus('watch-skip'); }
  focusNextPlay() { SpatialNavigation.setFocus('watch-next-play'); }

  toggleSettings() { this.settingsOpen = !this.settingsOpen; }

  showCaptionsToast() {
    toastStore.getState().show('Subtítulos próximamente', 'info', 3000);
  }

  toggleEpisodesRail() {
    this.railExpanded = !this.railExpanded;
    if (this.railExpanded) {
      const episodeRail = this.renderRoot.querySelector('tv-player-episode-rail') as any;
      if (episodeRail && typeof episodeRail.focusEpisodeRail === 'function') {
        episodeRail.focusEpisodeRail();
      }
    } else {
      SpatialNavigation.setFocus('watch-episodes');
    }
  }

  togglePlayPause() {
    if (this.videoEl) {
      if (this._isPlaying) this.videoEl.pause();
      else this.videoEl.play().catch(() => { });
    }
  }

  restartVideo() {
    if (this.engineRef && typeof this.engineRef.seek === 'function') {
      this.engineRef.seek(0);
    } else if (this.videoEl) {
      this.videoEl.currentTime = 0;
    }
    if (this.videoEl) this.videoEl.play().catch(() => { });
    this.dispatchEvent(new CustomEvent('restart-video', { bubbles: true, composed: true }));
  }

  playNextEpisode() {
    if (!this.nextEpisode || !this.contentId) return;
    const nextCard = this.renderRoot.querySelector('tv-player-next-card') as any;
    if (nextCard && typeof nextCard.hide === 'function') nextCard.hide();
    this.dispatchEvent(new CustomEvent('next-episode', {
      bubbles: true, composed: true,
      detail: { contentId: this.contentId, episodeId: this.nextEpisode.id },
    }));
  }

  cancelNextEpisode() {
    const nextCard = this.renderRoot.querySelector('tv-player-next-card') as any;
    if (nextCard && typeof nextCard.hide === 'function') nextCard.hide();
  }
}
