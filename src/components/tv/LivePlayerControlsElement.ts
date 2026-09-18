import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core';
import { ctvIconSheet } from '@/lib/ctvIcons';
import { toastStore } from '@/stores/toastStore';

const CONTROLS_HIDE_DELAY = 5000;

@customElement('tv-live-player-controls')
export class LivePlayerControlsElement extends LitElement {
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

    :host(.controls-hidden) .controls-overlay { pointer-events: none; }
    :host(.controls-hidden) .bottom-scrim { opacity: 0; pointer-events: none; }
    :host(.controls-hidden) .top-scrim { opacity: 0; }

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
      display: flex;
      align-items: center;
      gap: 0;
      transform: translateZ(0);
      will-change: transform;
    }

    :host(.controls-hidden) .player-watermark { opacity: 0; }
    :host(.controls-hidden) .top-scrim { opacity: 0; }

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

    .top-title { margin-top: clamp(1rem, 3vh, 1.75rem); max-width: 60vw; }
    .top-title h1 { color: #ffffff; font-weight: 700; font-size: clamp(1.5rem, 2.6vw, 2.2rem); line-height: 1.2; }
    .top-title p { color: rgba(255,255,255,0.3); font-size: 15px; font-weight: 500; margin-top: 0.25rem; }

    .live-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: #c41028;
      color: #fff;
      font-size: clamp(0.65rem, 0.85vw, 0.75rem);
      font-weight: 700;
      letter-spacing: 0.06em;
      padding: 0.15rem 0.5rem;
      border-radius: 0.15rem;
      margin-bottom: 0.35rem;
      text-transform: uppercase;
    }

    .live-badge::before {
      content: '';
      width: 0.45rem;
      height: 0.45rem;
      background: #fff;
      border-radius: 50%;
    }

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
  private _restoreFocusOnShow = false;

  @state() private _isPlaying = false;

  @property({ type: Object, attribute: false }) videoEl: HTMLVideoElement | null = null;
  @property({ type: String, attribute: 'channel-name' }) channelName = '';
  @property({ type: String, attribute: 'program-title' }) programTitle = '';
  @property({ type: String, attribute: 'secondary-text' }) secondaryText = '';
  @property({ type: Boolean, attribute: 'is-buffering', reflect: true }) isBuffering = false;
  @property({ type: Boolean, attribute: 'show-controls', reflect: true }) showControls = true;

  connectedCallback() {
    super.connectedCallback();
    this._setupGlobalKeyHandler();
    this.addEventListener('enter-press', this._handleEnterPress);
    this.addEventListener('focus-gained', this._handleFocusGained);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    this._teardownVideo();

    const keyHandler = (this as any)._keyHandler;
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler, true);
      (this as any)._keyHandler = null;
    }

    this.removeEventListener('enter-press', this._handleEnterPress);
    this.removeEventListener('focus-gained', this._handleFocusGained);
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (changedProperties.has('videoEl')) {
      this._teardownVideo();
      if (this.videoEl) this._initVideoListeners();
    }

    if (changedProperties.has('showControls')) {
      this.classList.toggle('controls-hidden', !this.showControls);
      if (this.showControls) {
        this._restartControlsHideTimer();
        if (this._restoreFocusOnShow) {
          this._restoreFocusOnShow = false;
          requestAnimationFrame(() => {
            try { SpatialNavigation.setFocus('live-playpause'); } catch { /* noop */ }
          });
        }
      }
    }
  }

  render() {
    const controlsOverlayClasses = { 'controls-overlay': true, hidden: !this.showControls };
    const controlsRowClasses = { 'controls-row': true, hidden: !this.showControls };

    const subtitle = this.secondaryText
      ? `${this.secondaryText}${this.programTitle ? ` • ${this.programTitle}` : ''}`
      : this.programTitle || '';

    return html`
      <div class="top-scrim">
        <div class="top-title">
          <div class="live-badge">EN VIVO</div>
          <h1 data-title>${this.channelName}</h1>
          ${subtitle ? html`<p data-subtitle>${subtitle}</p>` : ''}
        </div>
      </div>

      <div class=${classMap(controlsOverlayClasses)} data-controls-overlay>
        <div class="bottom-scrim">
          <div class=${classMap(controlsRowClasses)}>
            <div class="controls-row-left">
              <tv-focusable focus-key="live-back" parent-focus-key="live-root" data-focused="false" class="control-btn pill-btn"
                focusable=${this.showControls ? 'true' : 'false'}>
                <i class="ctv-icon ctv-seek-previus"></i>
                <span>Volver</span>
              </tv-focusable>
            </div>

            <div class="controls-row-center">
              <tv-focusable focus-key="live-playpause" parent-focus-key="live-root" data-focused="false" class="control-btn circle-btn play-pause-btn"
                focusable=${this.showControls ? 'true' : 'false'}>
                ${this._isPlaying ? html`
                  <i class="ctv-icon ctv-pause"></i>
                ` : html`
                  <i class="ctv-icon ctv-play"></i>
                `}
              </tv-focusable>
            </div>

            <div class="controls-row-right">
              <div class="pill-group">
                <tv-focusable focus-key="live-settings" parent-focus-key="live-root" data-focused="false" class="control-btn pill-btn"
                  focusable=${this.showControls ? 'true' : 'false'}>
                  <i class="ctv-icon ctv-settings"></i>
                  <span>Calidad</span>
                </tv-focusable>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="player-watermark" aria-hidden="true">CinelarTV</div>

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

    const onPlay = () => { this._isPlaying = true; };
    const onPause = () => { this._isPlaying = false; };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    (this as any)._videoListeners = { onPlay, onPause };
  }

  private _teardownVideo() {
    if (this.videoEl && (this as any)._videoListeners) {
      const { onPlay, onPause } = (this as any)._videoListeners;
      this.videoEl.removeEventListener('play', onPlay);
      this.videoEl.removeEventListener('pause', onPause);
      (this as any)._videoListeners = null;
    }
  }

  private _setupGlobalKeyHandler() {
    const handleKey = (e: KeyboardEvent) => {
      const isDirectional = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
      const isAction = e.key === 'Enter' || e.key === ' ';
      if (!isDirectional && !isAction) return;
      if (this.showControls) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      this.showControls = true;
      this._restoreFocusOnShow = true;
    };

    window.addEventListener('keydown', handleKey, true);
    (this as any)._keyHandler = handleKey;
  }

  private _restartControlsHideTimer() {
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    if (!this.videoEl || this.videoEl.paused) return;

    this.controlsTimer = setTimeout(() => {
      if (!this.videoEl || this.videoEl.paused) return;
      this.showControls = false;
    }, CONTROLS_HIDE_DELAY);
  }

  private _handleEnterPress = (e: Event) => {
    const source = e.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'));
    const key = source?.getAttribute('focus-key');
    if (!key) return;

    switch (key) {
      case 'live-playpause': this.togglePlayPause(); break;
      case 'live-back': this.dispatchEvent(new CustomEvent('live-back', { bubbles: true, composed: true })); break;
      case 'live-settings':
        toastStore.getState().show('Próximamente', 'info', 3000);
        break;
    }
    this._restartControlsHideTimer();
  };

  private _handleFocusGained = () => {
    this._restartControlsHideTimer();
  };

  togglePlayPause() {
    if (this.videoEl) {
      if (this._isPlaying) this.videoEl.pause();
      else this.videoEl.play().catch(() => {});
    }
  }
}
