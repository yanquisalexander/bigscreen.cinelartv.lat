import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { SpatialNavigation, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';
import { FocusableRegistrar } from './spatialFocus';
import { formatTime, resolveImageUrl } from '@/utils/helpers';
import type { Segment } from '@/types/content';
import type { FlatEpisode } from './RailEpisodeItem';

const PARENT_FOCUS_KEY = 'watch-root';
const CONTROLS_HIDE_DELAY = 5000;
const LOGIC_TICK_MS = 1000;
const SEEK_STEP_SECONDS = 10;
const SEEK_REPEAT_MS = 180;

interface EngineLike {
  getVariantTracksInfo(): any;
  getAudioTracksInfo(): any;
  selectQuality(option: number | 'auto'): void;
  selectAudioTrack(language: string, role?: string): void;
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
    }

    .controls-overlay {
      position: absolute;
      inset: 0;
      transition: opacity 300ms ease;
      pointer-events: auto;
    }

    .controls-overlay.hidden {
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
      transition: opacity 180ms ease;
    }

    :host(.controls-hidden) .player-watermark { opacity: 0.25; }

    .top-scrim {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      width: 100%;
      box-sizing: border-box;
      background: linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.3), transparent);
      padding: clamp(1.25rem, 3.4vh, 2rem) clamp(2rem, 4vw, 3rem);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: clamp(1rem, 2vw, 1.5rem);
    }

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
      transition: opacity 250ms ease, max-height 250ms ease;
    }

    .controls-row-left, .controls-row-right { display: flex; align-items: center; gap: clamp(0.5rem, 1vw, 0.75rem); flex: 1; }
    .controls-row-left { justify-content: flex-start; }
    .controls-row-right { justify-content: flex-end; }
    .controls-row-center { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

    .control-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.1);
      cursor: pointer;
      outline: none;
      pointer-events: auto;
    }

    .control-btn[data-focused="true"] {
      background: #ffffff;
      color: #000000;
      scale: 1.08;
      box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    }

    .circle-btn { width: clamp(2.75rem, 5vw, 3.25rem); height: clamp(2.75rem, 5vw, 3.25rem); border-radius: 9999px; }
    .play-pause-btn { width: clamp(3.25rem, 6vw, 3.75rem); height: clamp(3.25rem, 6vw, 3.75rem); }
    .pill-btn { padding: clamp(0.4rem, 1vh, 0.6rem) clamp(1rem, 2vw, 1.5rem); border-radius: 9999px; font-size: clamp(0.8rem, 1vw, 0.9rem); font-weight: 600; letter-spacing: 0.01em; }

    .control-btn svg { width: clamp(1.1rem, 2vw, 1.3rem); height: clamp(1.1rem, 2vw, 1.3rem); stroke: currentColor; fill: none; }
    .control-btn.play-pause-btn svg { width: clamp(1.3rem, 2.4vw, 1.5rem); height: clamp(1.3rem, 2.4vw, 1.5rem); fill: currentColor; stroke: none; }

    .bottom-scrim {
      position: absolute;
      inset-x: 0;
      bottom: 0;
      width: 100%;
      box-sizing: border-box;
      background: linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.4), transparent);
      padding: clamp(1.5rem, 3.5vh, 2.5rem) clamp(2rem, 4vw, 3rem) clamp(1.5rem, 4vh, 2.5rem);
      pointer-events: auto;
    }

    .seekbar-time { color: rgba(255,255,255,0.9); font-size: clamp(0.8rem, 1vw, 0.9rem); font-variant-numeric: tabular-nums; width: clamp(2.5rem, 4vw, 3rem); text-align: right; }
    
    .seekbar-track { position: relative; flex: 1; height: clamp(1.5rem, 3vh, 2rem); display: flex; align-items: center; cursor: pointer; }
    
    .seekbar-focus { display: flex; align-items: center; flex: 1; min-width: 0; border: none; outline: none; border-radius: 9999px; transition: box-shadow 200ms ease, transform 200ms ease; }
    .seekbar-focus[data-focused="true"] .seekbar-track-bg { height: clamp(0.375rem, 0.7vw, 0.5rem); }
    .seekbar-focus[data-focused="true"] .seekbar-thumb { transform: translate(-50%, -50%) scale(1.3); }
    .seekbar-track:hover .seekbar-track-bg { height: clamp(0.375rem, 0.7vw, 0.5rem); }
    
    .seekbar-track-bg { position: absolute; inset: 0; margin: auto; width: 100%; height: clamp(0.25rem, 0.5vw, 0.375rem); background: rgba(255,255,255,0.16); border-radius: 9999px; transition: height 200ms ease; }
    .seekbar-buffered { position: absolute; inset: 0; left: 0; background: rgba(255,255,255,0.12); border-radius: 9999px; }
    .seekbar-fill { position: absolute; inset: 0; left: 0; background: linear-gradient(to right, #f03 80%, #ff2791 100%); border-radius: 9999px; }
    
    .seekbar-thumb { position: absolute; top: 50%; left: 0; transform: translate(-50%, -50%); width: clamp(0.75rem, 1.5vw, 1rem); height: clamp(0.75rem, 1.5vw, 1rem); border: 2px solid #ffffff; background: #ffffff; border-radius: 9999px; opacity: 1; transition: transform 200ms ease, box-shadow 200ms ease; }
    .seekbar-track:hover .seekbar-thumb { transform: translate(-50%, -50%) scale(1.35); }
    
    .seekbar-time-end { color: rgba(255,255,255,0.7); font-size: clamp(0.8rem, 1vw, 0.9rem); font-variant-numeric: tabular-nums; width: clamp(2.5rem, 4vw, 3rem); text-align: right; }

    .episodes-container { display: flex; flex-direction: column; width: 100%; pointer-events: auto; }
    
    .episode-rail { display: flex; flex-direction: column; max-height: 0; min-height: 0; overflow: hidden; opacity: 0; transform: translateY(0.5rem); transition: opacity 180ms ease, transform 180ms ease; pointer-events: none; }
    .episode-rail[data-expanded="true"] { max-height: clamp(14rem, 28vh, 19rem); opacity: 1; transform: translateY(0); pointer-events: auto; }
    
    .episode-rail-list { display: flex; align-items: flex-start; gap: clamp(0.75rem, 1.5vw, 1.25rem); overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; padding: clamp(0.35rem, 0.8vh, 0.55rem) 0.25rem; }
    .episode-rail-list::-webkit-scrollbar { display: none; }
    
    .episode-card { flex: 0 0 clamp(156px, 18vw, 230px); display: block; box-sizing: border-box; margin: 0; padding: 0; outline: 0; color: #fff; text-align: left; cursor: pointer; scroll-snap-align: center; transform: translateZ(0); transition: transform 200ms ease-out, opacity 200ms ease-out; }
    .episode-card[data-focused="true"] { transform: scale(1.05); }
    
    .episode-thumb { display: block; position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border: 2px solid transparent; border-radius: 0.75rem; background: #262626; }
    .episode-card[data-focused="true"] .episode-thumb { border-color: #fff; }
    .episode-card[data-current="true"] .episode-thumb { border-color: rgba(255,255,255,0.55); }
    .episode-card[data-focused="true"][data-current="true"] .episode-thumb { border-color: #fff; }
    .episode-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .episode-thumb::after { content: ''; position: absolute; inset: 45% 0 0; background: linear-gradient(to top, rgba(0,0,0,0.35), transparent); }
    
    .episode-card-title { display: block; box-sizing: border-box; width: 100%; margin: 0.4rem 0 0; color: rgba(255,255,255,0.9); font-size: clamp(0.75rem, 1.1vw, 0.875rem); font-weight: 600; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .seekbar-view { display: flex; align-items: center; gap: clamp(0.75rem, 1.5vw, 1rem); height: clamp(2.25rem, 3.5vh, 2.75rem); max-height: clamp(2.25rem, 3.5vh, 2.75rem); flex-shrink: 0; transition: opacity 250ms ease, max-height 250ms ease; pointer-events: auto; }
    .seekbar-view.hidden { opacity: 0; max-height: 0; pointer-events: none; }
    .controls-row.hidden { opacity: 0; max-height: 0; pointer-events: none; }

    .expanded-view { display: flex; flex-direction: column; justify-content: center; flex-shrink: 0; max-height: clamp(80px, 12vh, 100px); padding-bottom: clamp(0.25rem, 0.6vh, 0.5rem); transition: opacity 250ms ease, max-height 250ms ease, transform 250ms ease; transform-origin: left center; pointer-events: auto; }
    .expanded-view[data-focused="false"] { opacity: 0.78; transform: scale(0.96); }
    .expanded-view[data-focused="true"] { opacity: 1; transform: scale(1); }
    .expanded-view.hidden { opacity: 0; max-height: 0; padding-bottom: 0; pointer-events: none; }
    .expanded-view .ep-num { font-size: clamp(0.65rem, 0.8vw, 0.7rem); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); margin-bottom: clamp(0.25rem, 0.5vh, 0.5rem); }
    .expanded-view h3 { color: #ffffff; font-size: clamp(0.9rem, 1vw, 1rem); font-weight: 500; line-height: 1.3; }
    .expanded-view p { color: rgba(255,255,255,0.4); font-size: clamp(0.6875rem, 0.85vw, 0.75rem); line-height: 1.3; margin-top: 0.25rem; }

    .skip-btn { position: absolute; bottom: clamp(7rem, 16vh, 11rem); right: clamp(2rem, 4vw, 3rem); z-index: 25; display: flex; align-items: center; gap: clamp(0.5rem, 1vw, 0.75rem); padding: clamp(0.625rem, 1.2vw, 0.75rem) clamp(1rem, 2vw, 1.5rem); background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); border-radius: clamp(0.75rem, 1.5vw, 1rem); color: #000000; font-size: clamp(0.875rem, 1.1vw, 1rem); font-weight: 600; cursor: pointer; outline: none; pointer-events: auto; }
    .skip-btn[data-focused="true"] { scale: 1.05; box-shadow: 0 0 0 4px #ffffff; }
    .skip-btn .chevron { width: clamp(1rem, 1.5vw, 1.25rem); height: clamp(1rem, 1.5vw, 1.25rem); }

    .next-card { position: absolute; bottom: clamp(7rem, 16vh, 11rem); right: clamp(2rem, 4vw, 3rem); z-index: 25; display: flex; align-items: center; gap: clamp(0.75rem, 1.5vw, 1rem); background: #1c1c1e; border-radius: clamp(0.75rem, 1.5vw, 1rem); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55); border: 1px solid rgba(255, 255, 255, 0.06); padding: clamp(0.75rem, 1.5vw, 1rem); min-width: clamp(280px, 40vw, 360px); transition: opacity 350ms ease, transform 350ms ease; pointer-events: auto; }
    .next-card.hidden { opacity: 0; transform: translateY(12px); pointer-events: none; }
    .next-card img { width: clamp(4rem, 7vw, 5rem); height: clamp(2.75rem, 5vw, 3.5rem); border-radius: clamp(0.5rem, 1vw, 0.75rem); object-fit: cover; flex-shrink: 0; }
    .next-card .placeholder-thumb { width: clamp(4rem, 7vw, 5rem); height: clamp(2.75rem, 5vw, 3.5rem); border-radius: clamp(0.5rem, 1vw, 0.75rem); background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .next-card .content { flex: 1; min-width: 0; }
    .next-card .label { font-size: clamp(0.65rem, 0.8vw, 0.7rem); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); }
    .next-card .title { color: #ffffff; font-size: clamp(0.875rem, 1.1vw, 1rem); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .next-card .actions { display: flex; align-items: center; gap: clamp(0.5rem, 1vw, 0.75rem); }
    .next-card .countdown { color: rgba(255,255,255,0.7); font-size: clamp(0.75rem, 1vw, 0.875rem); font-variant-numeric: tabular-nums; background: rgba(255,255,255,0.08); padding: clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.5rem, 1vw, 0.75rem); border-radius: clamp(0.25rem, 0.5vw, 0.375rem); }
    .next-card .play-btn { width: clamp(2.25rem, 4vw, 2.5rem); height: clamp(2.25rem, 4vw, 2.5rem); border-radius: clamp(0.5rem, 1vw, 0.75rem); background: #ffffff; display: flex; align-items: center; justify-content: center; color: #000000; cursor: pointer; outline: none; border: none; }
    .next-card .play-btn[data-focused="true"] { scale: 1.1; box-shadow: 0 0 0 4px #ffffff; }
    .next-card .cancel-btn { width: clamp(2.25rem, 4vw, 2.5rem); height: clamp(2.25rem, 4vw, 2.5rem); border-radius: clamp(0.5rem, 1vw, 0.75rem); background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.7); cursor: pointer; outline: none; border: none; }
    .next-card .cancel-btn[data-focused="true"] { scale: 1.1; box-shadow: 0 0 0 4px rgba(255,255,255,0.5); }

    .buffering { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    .buffering-spinner { width: clamp(2.5rem, 5vw, 3.5rem); height: clamp(2.5rem, 5vw, 3.5rem); border: 2px solid rgba(255,255,255,0.3); border-top-color: #ffffff; border-radius: 50%; animation: spin 0.8s linear infinite; }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  `;

  private registrar = new FocusableRegistrar();
  private rafId = 0;
  private controlsTimer: ReturnType<typeof setTimeout> | null = null;
  private logicTimer: ReturnType<typeof setInterval> | null = null;
  private _restoreFocusOnShow = false;
  private _restoreFocusRetry = 0;
  private _restoreFocusToken = 0;

  @state() private _isPlaying!: boolean;
  @state() private _duration!: number;
  @state() private _nextCountdown!: number;
  @state() private _nextTimer!: ReturnType<typeof setInterval> | null;
  @state() private _nextShowing!: boolean;
  @state() private _isSeeking!: boolean;
  @state() private _wasPlayingBeforeSeek!: boolean;
  @state() private _seekAccumulator!: number;
  @state() private _seekApplyTimer!: ReturnType<typeof setTimeout> | null;
  @state() private _seekEndTimer!: ReturnType<typeof setTimeout> | null;
  @state() private _seekKeyHeld!: boolean;
  @state() private _seekDirection!: number;
  @state() private _seekHeldAt!: number;
  @state() private _seekRepeatTimer!: ReturnType<typeof setInterval> | null;
  @state() private _skipFocusableRegistered!: boolean;
  @state() private _seekbarFocusableRegistered!: boolean;
  @state() private _lastEnterKey!: string;
  @state() private _lastEnterTime!: number;
  @state() private _lastFocusedControlKey!: string;
  @state() private _currentEpisodeId!: string | number | null;
  @state() private _allEpisodes!: FlatEpisode[];
  @state() private _renderedEpisodeKeys!: string[];

  private _onPlay: (() => void) | null = null;
  private _onPause: (() => void) | null = null;
  private _onWaiting: (() => void) | null = null;
  private _onPlaying: (() => void) | null = null;
  private _onDurationChange: (() => void) | null = null;
  private _onTimeUpdate: (() => void) | null = null;

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
    this._nextCountdown = 10;
    this._nextTimer = null;
    this._nextShowing = false;
    this._isSeeking = false;
    this._wasPlayingBeforeSeek = false;
    this._seekAccumulator = 0;
    this._seekApplyTimer = null;
    this._seekEndTimer = null;
    this._seekKeyHeld = false;
    this._seekDirection = 0;
    this._seekHeldAt = 0;
    this._seekRepeatTimer = null;
    this._skipFocusableRegistered = false;
    this._seekbarFocusableRegistered = false;
    this._lastEnterKey = '';
    this._lastEnterTime = 0;
    this._lastFocusedControlKey = 'watch-playpause';
    this._currentEpisodeId = null;
    this._allEpisodes = [];
    this._renderedEpisodeKeys = [];

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
    this._setupSeekbarHoldHandler();
    this.addEventListener('enter-press', this._handleEnterPress);
    this.addEventListener('focus-gained', this._handleFocusGained);
    this.addEventListener('focus-lost', this._handleFocusLost);
    this.addEventListener('arrow-press', this._handleArrowPress);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._teardownVideo();
    this.registrar.unregisterAll();
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    if (this._nextTimer) clearInterval(this._nextTimer);
    if (this._seekApplyTimer) clearTimeout(this._seekApplyTimer);
    if (this._seekEndTimer) clearTimeout(this._seekEndTimer);
    const keyHandler = (this as any)._keyHandler;
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler, true);
      (this as any)._keyHandler = null;
    }
    this._teardownSeekbarHoldHandler();
    this.removeEventListener('enter-press', this._handleEnterPress);
    this.removeEventListener('focus-gained', this._handleFocusGained);
    this.removeEventListener('focus-lost', this._handleFocusLost);
    this.removeEventListener('arrow-press', this._handleArrowPress);
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (changedProperties.has('videoEl')) {
      this._teardownVideo();
      if (this.videoEl) this._initVideoListeners();
    }

    if (changedProperties.has('episodes')) {
      this._allEpisodes = this.episodes.episodes;
      this._currentEpisodeId = this.episodes.currentId;
      this.contentId = this.episodes.contentId;
    }

    if (changedProperties.has('settingsOpen')) {
      this.dispatchEvent(new CustomEvent('settings-toggle', {
        bubbles: true,
        composed: true,
        detail: { open: this.settingsOpen },
      }));
    }

    const needsSync = [
      'showControls',
      'railExpanded',
      'episodes',
      'skipSegment',
      'nextEpisode',
      'isBuffering',
    ].some((p) => changedProperties.has(p));

    if (needsSync) {
      this._syncOverlayFocusability();
      this._syncFocusables();
    }

    if (changedProperties.has('showControls')) {
      this.classList.toggle('controls-hidden', !this.showControls);

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
  }

  render() {
    const controlsOverlayClasses = { 'controls-overlay': true, hidden: !this.showControls };
    const seekbarViewClasses = { 'seekbar-view': true, hidden: !this.showControls };
    const controlsRowClasses = { 'controls-row': true, hidden: !this.showControls };

    return html`
      <div class=${classMap(controlsOverlayClasses)} data-controls-overlay>
        <div class="top-scrim">
          <div class="top-title">
            <h1 data-title>${this.contentTitle}</h1>
            <p data-subtitle>${this.contentSubtitle}</p>
          </div>
        </div>

        <div class="bottom-scrim">
          <div class="episodes-container" data-episodes-container>
            <div class=${classMap(seekbarViewClasses)} data-seekbar-view>
              <span class="seekbar-time" data-current-time>0:00</span>
              <div class="seekbar-focus" data-seekbar-focusable 
                   tabindex=${this.showControls ? '0' : '-1'} 
                   aria-disabled=${String(!this.showControls)}
                   role="slider" aria-label="Barra de progreso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div class="seekbar-track" data-seekbar-track>
                  <div class="seekbar-track-bg">
                    <div class="seekbar-buffered" data-buffered style="width: 0%;"></div>
                    <div class="seekbar-fill" data-fill style="width: 0%;"></div>
                  </div>
                  <div class="seekbar-thumb" data-thumb></div>
                </div>
              </div>
              <span class="seekbar-time-end" data-duration-time>${this._duration && isFinite(this._duration) && this._duration > 0 ? formatTime(this._duration) : '0:00'}</span>
            </div>

            <div class=${classMap(controlsRowClasses)}>
              <div class="controls-row-left" data-episodes-btn-container>
                ${this._allEpisodes.length > 0 ? html`
                  <tv-focusable id="episodes-btn" focus-key="watch-episodes" parent-focus-key="watch-root" data-focused="false" class="control-btn pill-btn"
                    focusable=${this.showControls ? 'true' : 'false'}>
                    <span>Episodios</span>
                  </tv-focusable>
                ` : ''}
              </div>

              <div class="controls-row-center">
                <tv-focusable focus-key="watch-playpause" parent-focus-key="watch-root" data-focused="false" class="control-btn circle-btn play-pause-btn"
                  focusable=${this.showControls ? 'true' : 'false'}>
                  ${this._isPlaying ? html`
                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0">
                      <rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                  ` : html`
                    <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0">
                      <path d="M8 5.2v13.6L18.8 12z"></path>
                    </svg>
                  `}
                </tv-focusable>
              </div>

              <div class="controls-row-right">
                <tv-focusable focus-key="watch-settings" parent-focus-key="watch-root" data-focused="false" class="control-btn circle-btn settings-btn"
                  focusable=${this.showControls ? 'true' : 'false'}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </tv-focusable>
              </div>
            </div>

            <div class="episode-rail" data-episode-rail data-expanded=${this.railExpanded} aria-label="Episodios">
              <div class="episode-rail-list" data-episode-list>
                ${this.showControls ? this._allEpisodes.map((episode, index) => this._renderEpisodeCard(episode, index)) : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="player-watermark" aria-hidden="true">CinelarTV</div>

      ${this.skipSegment ? html`
        <div class="skip-btn" data-skip-btn data-focused="false">
          <span data-skip-label>Omitir ${this.skipSegment.type === 'intro' || this.skipSegment.segment_type === 'skip_intro' ? 'intro' : 'resumen'}</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      ` : ''}

      ${this.nextEpisode && this._nextShowing ? html`
        <div class="next-card" data-next-card>
          ${this.nextEpisode.thumbnail ? html`
            <img src=${resolveImageUrl(this.nextEpisode.thumbnail, this.clientEndpoint) || ''} />
          ` : html`
            <div class="placeholder-thumb">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          `}
          <div class="content">
            <div class="label">Siguiente episodio</div>
            <div class="title" data-next-title>${this.nextEpisode.title}</div>
          </div>
          <div class="actions">
            <span class="countdown" data-next-countdown>${this._nextCountdown}s</span>
            <tv-focusable focus-key="watch-next-play" parent-focus-key="watch-root" data-focused="false" class="play-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0">
                <polygon points="6 4v16l12-8z"></polygon>
              </svg>
            </tv-focusable>
            <tv-focusable focus-key="watch-next-cancel" parent-focus-key="watch-root" data-focused="false" class="cancel-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </tv-focusable>
          </div>
        </div>
      ` : ''}

      ${this.isBuffering ? html`
        <div class="buffering" data-buffering>
          <div class="buffering-spinner"></div>
        </div>
      ` : ''}
    `;
  }

  private _renderEpisodeCard(episode: FlatEpisode, index: number) {
    const isCurrent = String(episode.id) === String(this._currentEpisodeId);
    const hasMultipleSeasons = new Set(this._allEpisodes.map(e => e.seasonNumber)).size > 1;
    const imageUrl = resolveImageUrl(episode.thumbnail, this.clientEndpoint);

    return html`
      <div class="episode-card" 
           data-focused="false" 
           data-current=${isCurrent} 
           role="button" 
           tabindex="-1"
           aria-label="Episodio ${index + 1}: ${episode.title}"
           @click=${() => this._selectEpisode(episode.id)}>
        <span class="episode-thumb">
          ${imageUrl ? html`<img src=${imageUrl} alt="" loading="lazy" />` : ''}
        </span>
        <span class="episode-card-title">
          ${hasMultipleSeasons ? `T${episode.seasonNumber} · ` : ''}E${index + 1} · ${episode.title}
        </span>
      </div>
    `;
  }

  private _syncFocusables() {
    const seekbar = this.renderRoot.querySelector('[data-seekbar-focusable]') as HTMLElement | null;
    if (this.showControls && seekbar) {
      if (!this._seekbarFocusableRegistered) {
        this._seekbarFocusableRegistered = true;
        this.registrar.register([{
          focusKey: 'watch-seekbar',
          node: seekbar,
          parentFocusKey: PARENT_FOCUS_KEY,
          onEnterPress: () => this.togglePlayPause(),
          onArrowPress: (direction: string) => {
            if (!this.showControls || this.railExpanded) return true;
            if (direction === 'down') {
              if (this._allEpisodes.length > 0) {
                this.railExpanded = true;
                const activeEp = this._allEpisodes.find((e) => e.id === this._currentEpisodeId) ?? this._allEpisodes[0];
                if (activeEp) requestAnimationFrame(() => SpatialNavigation.setFocus(`rail-ep-item-${activeEp.id}`));
              } else {
                this._focusControl('watch-playpause');
              }
              return false;
            }
            if (direction === 'left') { this._seekBy(-SEEK_STEP_SECONDS); return false; }
            if (direction === 'right') { this._seekBy(SEEK_STEP_SECONDS); return false; }
            return true;
          },
          onFocus: () => { this._lastFocusedControlKey = 'watch-seekbar'; seekbar.setAttribute('data-focused', 'true'); },
          onBlur: () => { seekbar.setAttribute('data-focused', 'false'); this._stopSeekRepeat(); this._resetSeekHold(); if (this._isSeeking) this._endSeek(); },
        }]);
      }
    } else if (this._seekbarFocusableRegistered) {
      this._seekbarFocusableRegistered = false;
      this.registrar.unregister('watch-seekbar');
    }

    const skipBtn = this.renderRoot.querySelector('[data-skip-btn]') as HTMLElement | null;
    if (this.skipSegment && skipBtn) {
      if (!this._skipFocusableRegistered) {
        this._skipFocusableRegistered = true;
        this.registrar.register([{
          focusKey: 'watch-skip',
          node: skipBtn,
          parentFocusKey: PARENT_FOCUS_KEY,
          onEnterPress: () => this.handleSkip(),
          onArrowPress: () => true,
          onFocus: () => skipBtn.setAttribute('data-focused', 'true'),
          onBlur: () => skipBtn.setAttribute('data-focused', 'false'),
        }]);
      }
    } else if (this._skipFocusableRegistered) {
      this._skipFocusableRegistered = false;
      this.registrar.unregister('watch-skip');
    }

    const episodeCards = this.renderRoot.querySelectorAll('.episode-card');
    for (const focusKey of this._renderedEpisodeKeys) this.registrar.unregister(focusKey);
    this._renderedEpisodeKeys = [];

    if (this.showControls && this.railExpanded && this._allEpisodes.length > 0) {
      episodeCards.forEach((card, index) => {
        const episode = this._allEpisodes[index];
        if (!episode) return;
        const focusKey = `rail-ep-item-${episode.id}`;
        this.registrar.register([{
          focusKey,
          node: card as HTMLElement,
          parentFocusKey: PARENT_FOCUS_KEY,
          onEnterPress: () => this._selectEpisode(episode.id),
          onArrowPress: (direction: string) => {
            if (direction === 'up') { this.railExpanded = false; this._focusControl('watch-episodes'); return false; }
            if (direction === 'down') return false;
            if (direction === 'left' && index === 0) return false;
            if (direction === 'right' && index === this._allEpisodes.length - 1) return false;
            return true;
          },
          onFocus: () => {
            this.railExpanded = true;
            card.setAttribute('data-focused', 'true');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          },
          onBlur: () => {
            card.setAttribute('data-focused', 'false');
            requestAnimationFrame(() => this._collapseRailIfFocusLeaves());
          },
        }]);
        this._renderedEpisodeKeys.push(focusKey);
      });
    }
  }

  private _initVideoListeners() {
    if (!this.videoEl) return;
    const video = this.videoEl;
    this._onPlay = () => { this._isPlaying = true; };
    this._onPause = () => { this._isPlaying = false; };
    this._onWaiting = () => { this.isBuffering = true; };
    this._onPlaying = () => { this.isBuffering = false; };
    this._onDurationChange = () => { this._duration = video.duration || 0; };
    this._onTimeUpdate = () => { };

    video.addEventListener('play', this._onPlay);
    video.addEventListener('pause', this._onPause);
    video.addEventListener('waiting', this._onWaiting);
    video.addEventListener('playing', this._onPlaying);
    video.addEventListener('canplay', this._onPlaying);
    video.addEventListener('canplaythrough', this._onPlaying);
    video.addEventListener('durationchange', this._onDurationChange);
    video.addEventListener('timeupdate', this._onTimeUpdate);

    this._startSeekbarLoop();
    this._startLogicTimer();
  }

  private _teardownVideo() {
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
      if (this._onTimeUpdate) this.videoEl.removeEventListener('timeupdate', this._onTimeUpdate);
    }
    this._onPlay = null;
    this._onPause = null;
    this._onWaiting = null;
    this._onPlaying = null;
    this._onDurationChange = null;
    this._onTimeUpdate = null;

    if (this.rafId) { clearTimeout(this.rafId); this.rafId = 0; }
    if (this.logicTimer) { clearInterval(this.logicTimer); this.logicTimer = null; }
  }

  private _startSeekbarLoop() {
    if (!this.videoEl) return;
    const video = this.videoEl;
    const FRAME_MS = 100;
    let lastPct = -1;
    let lastDur = 0;
    let lastSec = -1;

    const update = () => {
      const dur = video.duration || 0;
      const ct = video.currentTime;
      const pct = dur > 0 ? (ct / dur) * 100 : 0;

      if (dur !== lastDur && isFinite(dur) && dur > 0) {
        lastDur = dur;
        this._duration = dur;
      }

      const sec = Math.floor(ct);
      if (sec !== lastSec) {
        lastSec = sec;
        const timeLabel = this.renderRoot.querySelector('[data-current-time]') as HTMLElement;
        if (timeLabel) timeLabel.textContent = formatTime(ct);
      }

      if (Math.abs(pct - lastPct) > 0.5) {
        lastPct = pct;
        let bufferedEnd = 0;
        if (video.buffered.length > 0) bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPct = dur > 0 ? (bufferedEnd / dur) * 100 : 0;

        const fill = this.renderRoot.querySelector('[data-fill]') as HTMLElement;
        const buffered = this.renderRoot.querySelector('[data-buffered]') as HTMLElement;
        const thumb = this.renderRoot.querySelector('[data-thumb]') as HTMLElement;
        const seekbar = this.renderRoot.querySelector('[data-seekbar-focusable]') as HTMLElement | null;

        if (fill) fill.style.width = `${pct}%`;
        if (buffered) buffered.style.width = `${bufferedPct}%`;
        if (thumb) thumb.style.left = `${pct}%`;

        if (seekbar) {
          seekbar.setAttribute('aria-valuenow', String(Math.round(pct)));
          seekbar.setAttribute('aria-valuetext', `${formatTime(ct)} de ${formatTime(dur)}`);
        }
      }
      this.rafId = window.setTimeout(update, FRAME_MS);
    };
    this.rafId = window.setTimeout(update, FRAME_MS);
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
        if (nearEnd && !this._nextShowing) this._showNextCardInternal();
        else if (!nearEnd && this._nextShowing) this._hideNextCard();
      }
    }, LOGIC_TICK_MS);
  }

  private _showNextCardInternal() {
    this._nextShowing = true;
    this._nextCountdown = 10;
    if (this._nextTimer) clearInterval(this._nextTimer);
    this._nextTimer = setInterval(() => {
      this._nextCountdown--;
      if (this._nextCountdown <= 0) {
        if (this._nextTimer) clearInterval(this._nextTimer);
        this._navigateToNext();
      }
    }, 1000);
  }

  private _hideNextCard() {
    this._nextShowing = false;
    if (this._nextTimer) clearInterval(this._nextTimer);
  }

  private _navigateToNext() {
    if (!this.nextEpisode || !this.contentId) return;
    this.dispatchEvent(new CustomEvent('next-episode', {
      bubbles: true, composed: true,
      detail: { contentId: this.contentId, episodeId: this.nextEpisode.id },
    }));
  }

  private _selectEpisode(episodeId: string | number) {
    this.dispatchEvent(new CustomEvent('episode-select', { bubbles: true, composed: true, detail: { episodeId } }));
  }

  private _collapseRailIfFocusLeaves() {
    const currentFocus = getCurrentFocusKey() ?? '';
    if (currentFocus.startsWith('rail-ep-item-')) return;
    this.railExpanded = false;
  }

  private _seekBy(seconds: number) {
    if (!this.videoEl) return;
    if (!this._isSeeking) {
      this._isSeeking = true;
      this._wasPlayingBeforeSeek = !this.videoEl.paused;
      if (!this.videoEl.paused) this.videoEl.pause();
    }
    this._seekAccumulator += seconds;
    this.showControls = true;
    this._restartControlsHideTimer();
    if (this._seekEndTimer) clearTimeout(this._seekEndTimer);
    this._seekEndTimer = setTimeout(() => this._endSeek(), 300);
    if (this._seekApplyTimer) return;
    this._seekApplyTimer = setTimeout(() => { this._seekApplyTimer = null; this._applySeek(); }, 200);
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
    this.showControls = true;
    this._restartControlsHideTimer();
  }

  private _endSeek() {
    if (!this._isSeeking) return;
    if (this._seekApplyTimer) { clearTimeout(this._seekApplyTimer); this._seekApplyTimer = null; this._applySeek(); }
    this._isSeeking = false;
    this._seekAccumulator = 0;
    if (this._wasPlayingBeforeSeek && this.videoEl && this.videoEl.paused) this.videoEl.play().catch(() => { });
    this._wasPlayingBeforeSeek = false;
  }

  private _nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  private _getControlElement(focusKey: string): HTMLElement | null {
    if (focusKey === 'watch-seekbar') {
      return this.renderRoot.querySelector('[data-seekbar-focusable]') as HTMLElement | null;
    }

    if (focusKey === 'watch-skip') {
      return this.renderRoot.querySelector('[data-skip-btn]') as HTMLElement | null;
    }

    return this.renderRoot.querySelector(`[focus-key="${focusKey}"]`) as HTMLElement | null;
  }

  private _canFocusControl(focusKey: string): boolean {
    if (!focusKey) return false;

    if (focusKey.startsWith('rail-ep-item-') && !this.railExpanded) {
      return false;
    }

    if (focusKey === 'watch-seekbar' && (!this.showControls || this.railExpanded)) {
      return false;
    }

    if (focusKey === 'watch-skip' && !this.skipSegment) {
      return false;
    }

    if (
      (focusKey === 'watch-next-play' || focusKey === 'watch-next-cancel') &&
      (!this.nextEpisode || !this._nextShowing)
    ) {
      return false;
    }

    const el = this._getControlElement(focusKey);
    if (!el) return false;

    if (el.getAttribute('focusable') === 'false') return false;
    if (el.getAttribute('aria-disabled') === 'true') return false;

    return true;
  }

  private _focusControl(focusKey: string): boolean {
    if (!this._canFocusControl(focusKey)) return false;

    requestAnimationFrame(() => {
      if (!this._canFocusControl(focusKey)) return;

      try {
        SpatialNavigation.setFocus(focusKey);
      } catch (_err) {
        // noop
      }
    });

    return true;
  }

  private _restoreControlFocus(): void {
    this._restoreFocusRetry = 0;
    this._restoreFocusToken += 1;
    void this._restoreControlFocusWhenReady(this._restoreFocusToken);
  }

  private async _restoreControlFocusWhenReady(token: number): Promise<void> {
    if (token !== this._restoreFocusToken) return;

    await this.updateComplete;
    await this._nextFrame();

    if (token !== this._restoreFocusToken) return;

    const candidates = [
      this._lastFocusedControlKey,
      'watch-playpause',
      'watch-seekbar',
      'watch-episodes',
      'watch-settings',
      'watch-skip',
      'watch-next-play',
      'watch-next-cancel',
    ].filter((key): key is string => Boolean(key));

    for (const key of candidates) {
      if (!this._canFocusControl(key)) continue;

      try {
        SpatialNavigation.setFocus(key);
      } catch (_err) {
        // noop
      }

      await this._nextFrame();

      if (token !== this._restoreFocusToken) return;

      if (getCurrentFocusKey() === key) {
        return;
      }
    }

    if (this._restoreFocusRetry < 5) {
      this._restoreFocusRetry += 1;
      requestAnimationFrame(() => void this._restoreControlFocusWhenReady(token));
      return;
    }

    try {
      SpatialNavigation.setFocus('watch-root');
    } catch (_err) {
      // noop
    }
  }

  private _syncOverlayFocusability() {
    if (this.showControls) return;

    const currentFocus = getCurrentFocusKey() ?? '';

    if (currentFocus.startsWith('player-settings')) return;

    const hiddenOverlayFocusKeys = new Set([
      'watch-playpause',
      'watch-settings',
      'watch-episodes',
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
        try {
          SpatialNavigation.setFocus('watch-root');
        } catch (_err) {
          // noop
        }
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
      const isDirectional = [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
      ].includes(e.key);

      const isAction = e.key === 'Enter' || e.key === ' ';

      if (!isDirectional && !isAction) return;

      const currentFocus = getCurrentFocusKey() ?? '';

      if (
        this.settingsOpen ||
        currentFocus.startsWith('player-settings') ||
        this.showControls
      ) {
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();

      this.showControls = true;
      this._restoreFocusOnShow = true;
    };

    window.addEventListener('keydown', handleKey, true);
    (this as any)._keyHandler = handleKey;
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
    this._seekRepeatTimer = setInterval(() => {
      if (!this._seekKeyHeld || !this.videoEl || !this._seekbarHoldCanIntercept()) {
        this._stopSeekRepeat(); this._resetSeekHold(); if (this._isSeeking) this._endSeek(); return;
      }
      this._seekBy(dir * SEEK_STEP_SECONDS);
    }, SEEK_REPEAT_MS);
  }

  private _stopSeekRepeat() {
    if (this._seekRepeatTimer) { clearInterval(this._seekRepeatTimer); this._seekRepeatTimer = null; }
  }

  private _seekbarHoldCanIntercept(): boolean {
    if (this.settingsOpen || this.railExpanded) return false;
    const seekbar = this.renderRoot.querySelector('[data-seekbar-focusable]') as HTMLElement | null;
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

  private _handleEnterPress = (e: Event) => {
    const source = e.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'));
    const key = source?.getAttribute('focus-key');
    if (!key || (key === this._lastEnterKey && e.timeStamp - this._lastEnterTime < 300)) return;
    this._lastEnterKey = key; this._lastEnterTime = e.timeStamp;
    switch (key) {
      case 'watch-seekbar': case 'watch-playpause': this.togglePlayPause(); break;
      case 'watch-episodes': this.toggleEpisodesRail(); break;
      case 'watch-settings': this.toggleSettings(); break;
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
      if (currentFocus === 'watch-episodes' || currentFocus === 'episodes-rail' || currentFocus?.startsWith('rail-ep-item-')) return;
      this.railExpanded = false;
    });
  };

  private _handleArrowPress = (e: Event) => {
    const custom = e as CustomEvent<{ direction?: string }>;
    const source = custom.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'));
    const key = source?.getAttribute('focus-key');
    this._restartControlsHideTimer();

    if (key === 'watch-settings' && custom.detail?.direction === 'left') { custom.preventDefault(); this._focusControl('watch-playpause'); return; }
    if (key === 'watch-playpause' && custom.detail?.direction === 'left') { custom.preventDefault(); this._focusControl('watch-episodes'); return; }
    if (key === 'watch-playpause' && custom.detail?.direction === 'right') { custom.preventDefault(); this._focusControl('watch-settings'); return; }
    if (key === 'watch-episodes' && custom.detail?.direction === 'right') { custom.preventDefault(); this._focusControl('watch-playpause'); return; }

    if (!['watch-episodes', 'watch-playpause', 'watch-settings'].includes(key ?? '') || custom.detail?.direction !== 'down' || this._allEpisodes.length === 0) return;

    custom.preventDefault();
    this.railExpanded = true;
    const activeEp = this._allEpisodes.find((e) => e.id === this._currentEpisodeId) ?? this._allEpisodes[0];
    if (activeEp) requestAnimationFrame(() => SpatialNavigation.setFocus(`rail-ep-item-${activeEp.id}`));
  };

  focusPlayPause() { SpatialNavigation.setFocus('watch-playpause'); }
  focusSettings() { SpatialNavigation.setFocus('watch-settings'); }
  focusSkip() { SpatialNavigation.setFocus('watch-skip'); }
  focusNextPlay() { SpatialNavigation.setFocus('watch-next-play'); }

  toggleSettings() { this.settingsOpen = !this.settingsOpen; }

  toggleEpisodesRail() {
    this.railExpanded = !this.railExpanded;
    if (this.railExpanded) {
      const activeEp = this._allEpisodes.find((e) => e.id === this._currentEpisodeId) ?? this._allEpisodes[0];
      if (activeEp) requestAnimationFrame(() => SpatialNavigation.setFocus(`rail-ep-item-${activeEp.id}`));
    } else {
      SpatialNavigation.setFocus('watch-episodes');
    }
  }

  togglePlayPause() {
    if (this._isSeeking) { this._endSeek(); return; }
    if (this.videoEl) {
      if (this._isPlaying) this.videoEl.pause();
      else this.videoEl.play().catch(() => { });
    }
  }

  handleSkip() {
    if (!this.skipSegment) return;
    if (this._isSeeking) this._endSeek();
    const end = this.skipSegment.end ?? this.skipSegment.end_time ?? 0;
    if (this.videoEl) this.videoEl.currentTime = end;
    this.skipSegment = null;
    this.dispatchEvent(new CustomEvent('skip', { bubbles: true, composed: true }));
  }

  playNextEpisode() {
    if (!this.nextEpisode || !this.contentId) return;
    if (this._isSeeking) this._endSeek();
    if (this._nextTimer) clearInterval(this._nextTimer);
    this._hideNextCard();
    this.dispatchEvent(new CustomEvent('next-episode', {
      bubbles: true, composed: true,
      detail: { contentId: this.contentId, episodeId: this.nextEpisode.id },
    }));
  }

  cancelNextEpisode() {
    if (this._nextTimer) clearInterval(this._nextTimer);
    this._hideNextCard();
  }
}