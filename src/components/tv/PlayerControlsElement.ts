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

class PlayerControlsElement extends HTMLElement {
  private shadow: ShadowRoot;
  private video: HTMLVideoElement | null = null;
  private registrar = new FocusableRegistrar();
  private rafId = 0;
  private controlsTimer: ReturnType<typeof setTimeout> | null = null;
  private logicTimer: ReturnType<typeof setInterval> | null = null;
  private _showControls = true;
  private _isPlaying = false;
  private _isBuffering = false;
  private _duration = 0;
  private _segments: Segment[] = [];
  private _skipSegment: Segment | null = null;
  private _nextEpisode: FlatEpisode | null = null;
  private _allEpisodes: FlatEpisode[] = [];
  private _renderedEpisodeKeys: string[] = [];
  private _currentEpisodeId: string | number | null = null;
  private _contentId: string | null = null;
  private _nextCountdown = 10;
  private _nextTimer: ReturnType<typeof setInterval> | null = null;
  private _nextShowing = false;
  private _railExpanded = false;
  private _settingsOpen = false;
  private _clientEndpoint = '';
  private _skipFocusableRegistered = false;
  private _seekbarFocusableRegistered = false;
  private _lastEnterKey = '';
  private _lastEnterTime = 0;
  private _lastFocusedControlKey = 'watch-playpause';
  private _isSeeking = false;
  private _wasPlayingBeforeSeek = false;
  private _seekAccumulator = 0;
  private _seekApplyTimer: ReturnType<typeof setTimeout> | null = null;
  private _seekEndTimer: ReturnType<typeof setTimeout> | null = null;
  private _seekKeyHeld = false;
  private _seekDirection = 0;
  private _seekHeldAt = 0;
  private _seekRepeatTimer: ReturnType<typeof setInterval> | null = null;

  static get observedAttributes() {
    return ['content-id', 'client-endpoint'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  set videoEl(value: HTMLVideoElement | null) {
    this.video = value;
    if (value) this._initVideoListeners();
  }

  set engineRef(_value: EngineLike | null) { }

  set episodes(value: { episodes: FlatEpisode[]; currentId: string | number | null; contentId: string | null }) {
    this._allEpisodes = value.episodes;
    this._currentEpisodeId = value.currentId;
    this._contentId = value.contentId;
    this._renderEpisodesButton();
    this._renderEpisodesRail();
    this._syncOverlayFocusability();
  }

  private _renderEpisodesButton() {
    const container = this.shadow.querySelector('[data-episodes-btn-container]') as HTMLElement | null;
    if (!container) return;
    const existing = container.querySelector('#episodes-btn');
    if (this._allEpisodes.length > 0) {
      if (existing) return;
      container.innerHTML = `
              <tv-focusable id="episodes-btn" focus-key="watch-episodes" parent-focus-key="watch-root" data-focused="false" class="control-btn pill-btn">
                <span>Episodios</span>
              </tv-focusable>
            `;
    } else if (existing) {
      existing.remove();
    }
  }

  private _renderEpisodesRail() {
    const list = this.shadow.querySelector('[data-episode-list]') as HTMLElement | null;
    if (!list) return;

    for (const focusKey of this._renderedEpisodeKeys) this.registrar.unregister(focusKey);
    this._renderedEpisodeKeys = [];
    list.replaceChildren();

    const hasMultipleSeasons = new Set(this._allEpisodes.map((episode) => episode.seasonNumber)).size > 1;
    const currentIndex = this._allEpisodes.findIndex((episode) => String(episode.id) === String(this._currentEpisodeId));

    this._allEpisodes.forEach((episode, index) => {
      const card = document.createElement('div');
      const isCurrent = index === currentIndex;
      card.className = 'episode-card';
      card.dataset.focused = 'false';
      card.dataset.current = String(isCurrent);
      card.setAttribute('role', 'button');
      card.tabIndex = -1;
      card.setAttribute('aria-label', `Episodio ${index + 1}: ${episode.title}`);

      const thumb = document.createElement('span');
      thumb.className = 'episode-thumb';
      const imageUrl = resolveImageUrl(episode.thumbnail, this._clientEndpoint);
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        thumb.append(image);
      }

      const title = document.createElement('span');
      title.className = 'episode-card-title';
      title.textContent = `${hasMultipleSeasons ? `T${episode.seasonNumber} · ` : ''}E${index + 1} · ${episode.title}`;
      card.append(thumb, title);
      card.addEventListener('click', () => this._selectEpisode(episode.id));
      list.append(card);

      if (!this._showControls) return;
      this.registrar.register([{
        focusKey: `rail-ep-item-${episode.id}`,
        node: card,
        parentFocusKey: PARENT_FOCUS_KEY,
        onEnterPress: () => this._selectEpisode(episode.id),
        onArrowPress: (direction: string) => {
          if (direction === 'up') {
            this.railExpanded = false;
            this._focusControl('watch-episodes');
            return false;
          }
          if (direction === 'down') {
            // El rail es el límite inferior de la navegación del reproductor.
            // Evitamos que Norigin busque un vecino geométrico fuera de él.
            return false;
          }
          if (direction === 'left' && index === 0) {
            return false;
          }
          if (direction === 'right' && index === this._allEpisodes.length - 1) {
            return false;
          }
          return true;
        },
        onFocus: () => {
          this.railExpanded = true;
          card.dataset.focused = 'true';
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        },
        onBlur: () => {
          card.dataset.focused = 'false';
          requestAnimationFrame(() => this._collapseRailIfFocusLeaves());
        },
      }]);
      this._renderedEpisodeKeys.push(`rail-ep-item-${episode.id}`);
    });
  }

  private _selectEpisode(episodeId: string | number) {
    this.dispatchEvent(new CustomEvent('episode-select', {
      bubbles: true,
      composed: true,
      detail: { episodeId },
    }));
  }

  private _collapseRailIfFocusLeaves() {
    const currentFocus = getCurrentFocusKey() ?? '';
    if (currentFocus === 'watch-episodes' || currentFocus.startsWith('rail-ep-item-')) return;
    this.railExpanded = false;
  }

  set segments(value: Segment[]) {
    this._segments = value;
  }

  set clientEndpoint(value: string) {
    this._clientEndpoint = value;
    this._renderEpisodesRail();
  }

  attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
    if (name === 'content-id') this._contentId = newValue;
    if (name === 'client-endpoint') this._clientEndpoint = newValue ?? '';
  }

  connectedCallback() {
    this._render();
    this._renderEpisodesButton();
    this._renderEpisodesRail();
    this._setupGlobalKeyHandler();
    this._setupSeekbarHoldHandler();
    this.addEventListener('enter-press', this._handleEnterPress);
    this.addEventListener('focus-gained', this._handleFocusGained);
    this.addEventListener('focus-lost', this._handleFocusLost);
    this.addEventListener('arrow-press', this._handleArrowPress);
    this._syncOverlayFocusability();
  }

  disconnectedCallback() {
    this.registrar.unregisterAll();
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    if (this.logicTimer) clearInterval(this.logicTimer);
    if (this._nextTimer) clearInterval(this._nextTimer);
    if (this.rafId) cancelAnimationFrame(this.rafId);
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

  private _render() {
    this.shadow.innerHTML = `
      <style>
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

        /* Top scrim */
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

        .top-title {
          margin-top: clamp(1rem, 3vh, 1.75rem);
          max-width: 60vw;
        }

        .top-title h1 {
          color: #ffffff;
          font-weight: 700;
          font-size: clamp(1.5rem, 2.6vw, 2.2rem);
          line-height: 1.2;
        }

        .top-title p {
          color: rgba(255,255,255,0.3);
          font-size: 15px;
          font-weight: 500;
          margin-top: 0.25rem;
        }

        /* Bottom controls row */
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

        .controls-row-left,
        .controls-row-right {
          display: flex;
          align-items: center;
          gap: clamp(0.5rem, 1vw, 0.75rem);
          flex: 1;
        }

        .controls-row-left {
          justify-content: flex-start;
        }

        .controls-row-right {
          justify-content: flex-end;
        }

        .controls-row-center {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

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

        .circle-btn {
          width: clamp(2.75rem, 5vw, 3.25rem);
          height: clamp(2.75rem, 5vw, 3.25rem);
          border-radius: 9999px;
        }

        .play-pause-btn {
          width: clamp(3.25rem, 6vw, 3.75rem);
          height: clamp(3.25rem, 6vw, 3.75rem);
        }

        .pill-btn {
          padding: clamp(0.4rem, 1vh, 0.6rem) clamp(1rem, 2vw, 1.5rem);
          border-radius: 9999px;
          font-size: clamp(0.8rem, 1vw, 0.9rem);
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        .control-btn svg {
          width: clamp(1.1rem, 2vw, 1.3rem);
          height: clamp(1.1rem, 2vw, 1.3rem);
          stroke: currentColor;
          fill: none;
        }

        .control-btn.play-pause-btn svg {
          width: clamp(1.3rem, 2.4vw, 1.5rem);
          height: clamp(1.3rem, 2.4vw, 1.5rem);
          fill: currentColor;
          stroke: none;
        }

        /* Bottom scrim */
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

        /* Seekbar */
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
          border-radius: 9999px;
          transition: box-shadow 200ms ease, transform 200ms ease;
        }

        

        .seekbar-focus[data-focused="true"] .seekbar-track-bg {
          height: clamp(0.375rem, 0.7vw, 0.5rem);
        }

        .seekbar-focus[data-focused="true"] .seekbar-thumb {
          transform: translate(-50%, -50%) scale(1.3);
        }

        .seekbar-track:hover .seekbar-track-bg {
          height: clamp(0.375rem, 0.7vw, 0.5rem);
        }

        .seekbar-track-bg {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 100%;
          height: clamp(0.25rem, 0.5vw, 0.375rem);
          background: rgba(255,255,255,0.16);
          border-radius: 9999px;
          transition: height 200ms ease;
        }

        .seekbar-buffered {
          position: absolute;
          inset: 0;
          left: 0;
          background: rgba(255,255,255,0.12);
          border-radius: 9999px;
        }

        .seekbar-fill {
          position: absolute;
          inset: 0;
          left: 0;
          background: linear-gradient(to right, #f03 80%, #ff2791 100%);
          border-radius: 9999px;
        }

        .seekbar-thumb {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translate(-50%, -50%);
          width: clamp(0.75rem, 1.5vw, 1rem);
          height: clamp(0.75rem, 1.5vw, 1rem);
          border: 2px solid #ffffff;
          background: #ffffff;
          border-radius: 9999px;
          opacity: 1;
          transition: transform 200ms ease, box-shadow 200ms ease;
        }

        .seekbar-track:hover .seekbar-thumb {
          transform: translate(-50%, -50%) scale(1.35);
        }

        .seekbar-time-end {
          color: rgba(255,255,255,0.7);
          font-size: clamp(0.8rem, 1vw, 0.9rem);
          font-variant-numeric: tabular-nums;
          width: clamp(2.5rem, 4vw, 3rem);
          text-align: right;
        }

        /* Episodes rail container */
        .episodes-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          pointer-events: auto;
        }

        .episode-rail {
          display: flex;
          flex-direction: column;
          max-height: 0;
          min-height: 0;
          overflow: hidden;
          opacity: 0;
          transform: translateY(0.5rem);
          transition: opacity 180ms ease, transform 180ms ease;
          pointer-events: none;
        }

        .episode-rail[data-expanded="true"] {
          max-height: clamp(14rem, 28vh, 19rem);
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .episode-rail-list {
          display: flex;
          align-items: flex-start;
          gap: clamp(0.75rem, 1.5vw, 1.25rem);
          overflow-x: auto;
          scrollbar-width: none;
          scroll-snap-type: x proximity;
          padding: clamp(0.35rem, 0.8vh, 0.55rem) 0.25rem;
        }

        .episode-rail-list::-webkit-scrollbar { display: none; }

        .episode-card {
          flex: 0 0 clamp(156px, 18vw, 230px);
          display: block;
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          outline: 0;
          color: #fff;
          text-align: left;
          cursor: pointer;
          scroll-snap-align: center;
          transform: translateZ(0);
          transition: transform 200ms ease-out, opacity 200ms ease-out;
        }

        .episode-card[data-focused="true"] { transform: scale(1.05); }

        .episode-thumb {
          display: block;
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border: 2px solid transparent;
          border-radius: 0.75rem;
          background: #262626;
        }

        .episode-card[data-focused="true"] .episode-thumb { border-color: #fff; }
        .episode-card[data-current="true"] .episode-thumb { border-color: rgba(255,255,255,0.55); }
        .episode-card[data-focused="true"][data-current="true"] .episode-thumb { border-color: #fff; }

        .episode-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .episode-thumb::after {
          content: '';
          position: absolute;
          inset: 45% 0 0;
          background: linear-gradient(to top, rgba(0,0,0,0.35), transparent);
        }

        .episode-card-title {
          display: block;
          box-sizing: border-box;
          width: 100%;
          margin: 0.4rem 0 0;
          color: rgba(255,255,255,0.9);
          font-size: clamp(0.75rem, 1.1vw, 0.875rem);
          font-weight: 600;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .seekbar-view {
          display: flex;
          align-items: center;
          gap: clamp(0.75rem, 1.5vw, 1rem);
          height: clamp(2.25rem, 3.5vh, 2.75rem);
          max-height: clamp(2.25rem, 3.5vh, 2.75rem);
          flex-shrink: 0;
          transition: opacity 250ms ease, max-height 250ms ease;
          pointer-events: auto;
        }

        .seekbar-view.hidden {
          opacity: 0;
          max-height: 0;
          pointer-events: none;
        }

        .controls-row.hidden {
          opacity: 0;
          max-height: 0;
          pointer-events: none;
        }

        .expanded-view {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex-shrink: 0;
          max-height: clamp(80px, 12vh, 100px);
          padding-bottom: clamp(0.25rem, 0.6vh, 0.5rem);
          transition: opacity 250ms ease, max-height 250ms ease, transform 250ms ease;
          transform-origin: left center;
          pointer-events: auto;
        }

        .expanded-view[data-focused="false"] {
          opacity: 0.78;
          transform: scale(0.96);
        }

        .expanded-view[data-focused="true"] {
          opacity: 1;
          transform: scale(1);
        }

        .expanded-view.hidden {
          opacity: 0;
          max-height: 0;
          padding-bottom: 0;
          pointer-events: none;
        }

        .expanded-view .ep-num {
          font-size: clamp(0.65rem, 0.8vw, 0.7rem);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.4);
          margin-bottom: clamp(0.25rem, 0.5vh, 0.5rem);
        }

        .expanded-view h3 {
          color: #ffffff;
          font-size: clamp(0.9rem, 1vw, 1rem);
          font-weight: 500;
          line-height: 1.3;
        }

        .expanded-view p {
          color: rgba(255,255,255,0.4);
          font-size: clamp(0.6875rem, 0.85vw, 0.75rem);
          line-height: 1.3;
          margin-top: 0.25rem;
        }

        /* Skip intro button */
        .skip-btn {
          position: absolute;
          bottom: clamp(7rem, 16vh, 11rem);
          right: clamp(2rem, 4vw, 3rem);
          z-index: 25;
          display: flex;
          align-items: center;
          gap: clamp(0.5rem, 1vw, 0.75rem);
          padding: clamp(0.625rem, 1.2vw, 0.75rem) clamp(1rem, 2vw, 1.5rem);
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          border-radius: clamp(0.75rem, 1.5vw, 1rem);
          color: #000000;
          font-size: clamp(0.875rem, 1.1vw, 1rem);
          font-weight: 600;
          cursor: pointer;
          outline: none;
          pointer-events: auto;
        }

        .skip-btn[data-focused="true"] {
          scale: 1.05;
          box-shadow: 0 0 0 4px #ffffff;
        }

        .skip-btn .chevron {
          width: clamp(1rem, 1.5vw, 1.25rem);
          height: clamp(1rem, 1.5vw, 1.25rem);
        }

        /* Next episode card */
        .next-card {
          position: absolute;
          bottom: clamp(7rem, 16vh, 11rem);
          right: clamp(2rem, 4vw, 3rem);
          z-index: 25;
          display: flex;
          align-items: center;
          gap: clamp(0.75rem, 1.5vw, 1rem);
          background: #1c1c1e;
          border-radius: clamp(0.75rem, 1.5vw, 1rem);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: clamp(0.75rem, 1.5vw, 1rem);
          min-width: clamp(280px, 40vw, 360px);
          transition: opacity 350ms ease, transform 350ms ease;
          pointer-events: auto;
        }

        .next-card.hidden {
          opacity: 0;
          transform: translateY(12px);
          pointer-events: none;
        }

        .next-card img {
          width: clamp(4rem, 7vw, 5rem);
          height: clamp(2.75rem, 5vw, 3.5rem);
          border-radius: clamp(0.5rem, 1vw, 0.75rem);
          object-fit: cover;
          flex-shrink: 0;
        }

        .next-card .placeholder-thumb {
          width: clamp(4rem, 7vw, 5rem);
          height: clamp(2.75rem, 5vw, 3.5rem);
          border-radius: clamp(0.5rem, 1vw, 0.75rem);
          background: rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .next-card .content {
          flex: 1;
          min-width: 0;
        }

        .next-card .label {
          font-size: clamp(0.65rem, 0.8vw, 0.7rem);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.4);
        }

        .next-card .title {
          color: #ffffff;
          font-size: clamp(0.875rem, 1.1vw, 1rem);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .next-card .actions {
          display: flex;
          align-items: center;
          gap: clamp(0.5rem, 1vw, 0.75rem);
        }

        .next-card .countdown {
          color: rgba(255,255,255,0.7);
          font-size: clamp(0.75rem, 1vw, 0.875rem);
          font-variant-numeric: tabular-nums;
          background: rgba(255,255,255,0.08);
          padding: clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.5rem, 1vw, 0.75rem);
          border-radius: clamp(0.25rem, 0.5vw, 0.375rem);
        }

        .next-card .play-btn {
          width: clamp(2.25rem, 4vw, 2.5rem);
          height: clamp(2.25rem, 4vw, 2.5rem);
          border-radius: clamp(0.5rem, 1vw, 0.75rem);
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000000;
          cursor: pointer;
          outline: none;
          border: none;
        }

        .next-card .play-btn[data-focused="true"] {
          scale: 1.1;
          box-shadow: 0 0 0 4px #ffffff;
        }

        .next-card .cancel-btn {
          width: clamp(2.25rem, 4vw, 2.5rem);
          height: clamp(2.25rem, 4vw, 2.5rem);
          border-radius: clamp(0.5rem, 1vw, 0.75rem);
          background: rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          outline: none;
          border: none;
        }

        .next-card .cancel-btn[data-focused="true"] {
          scale: 1.1;
          box-shadow: 0 0 0 4px rgba(255,255,255,0.5);
        }

        /* Buffering spinner */
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

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

      </style>

      <div class="controls-overlay" data-controls-overlay>
        <!-- Top scrim -->
        <div class="top-scrim">
          <div class="top-title">
            <h1 data-title></h1>
            <p data-subtitle></p>
          </div>
        </div>

        <!-- Bottom scrim -->
        <div class="bottom-scrim">
          <div class="episodes-container" data-episodes-container>
            <!-- Seekbar view -->
            <div class="seekbar-view" data-seekbar-view>
              <span class="seekbar-time" data-current-time>0:00</span>
              <div class="seekbar-focus" data-seekbar-focusable tabindex="0" role="slider" aria-label="Barra de progreso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div class="seekbar-track" data-seekbar-track>
                  <div class="seekbar-track-bg">
                    <div class="seekbar-buffered" data-buffered style="width: 0%;"></div>
                    <div class="seekbar-fill" data-fill style="width: 0%;"></div>
                  </div>
                  <div class="seekbar-thumb" data-thumb></div>
                </div>
              </div>
              <span class="seekbar-time-end" data-duration-time>0:00</span>
            </div>

            <!-- Controls row -->
            <div class="controls-row">
              <div class="controls-row-left" data-episodes-btn-container></div>

              <div class="controls-row-center">
                <tv-focusable focus-key="watch-playpause" parent-focus-key="watch-root" data-focused="false" class="control-btn circle-btn play-pause-btn">
                  <svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0">
                    <path d="M8 5.2v13.6L18.8 12z"></path>
                  </svg>
                </tv-focusable>
              </div>

              <div class="controls-row-right">
                <tv-focusable focus-key="watch-settings" parent-focus-key="watch-root" data-focused="false" class="control-btn circle-btn settings-btn">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </tv-focusable>
              </div>
            </div>

            <div class="episode-rail" data-episode-rail data-expanded="false" aria-label="Episodios">
              <div class="episode-rail-list" data-episode-list></div>
            </div>

          </div>
        </div>
      </div>

      <div class="player-watermark" aria-hidden="true">CinelarTV</div>

      <!-- Skip intro -->
      <div class="skip-btn" data-skip-btn data-focused="false" style="display: none;">
        <span data-skip-label>Omitir intro</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>

      <!-- Next episode card -->
      <div class="next-card hidden" data-next-card>
        <img data-next-thumb style="display: none;" />
        <div data-next-placeholder class="placeholder-thumb" style="display: none;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </div>
        <div class="content">
          <div class="label">Siguiente episodio</div>
          <div class="title" data-next-title></div>
        </div>
        <div class="actions">
          <span class="countdown" data-next-countdown>10s</span>
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

      <!-- Buffering -->
      <div class="buffering" data-buffering style="display: none;">
        <div class="buffering-spinner"></div>
      </div>
    `;
  }

  private _initVideoListeners() {
    if (!this.video) return;

    const video = this.video;
    const onPlay = () => { this._isPlaying = true; this._updatePlayPauseIcon(); };
    const onPause = () => { this._isPlaying = false; this._updatePlayPauseIcon(); };
    const onWaiting = () => { this._isBuffering = true; this._updateBuffering(); };
    const onPlaying = () => { this._isBuffering = false; this._updateBuffering(); };
    const onDurationChange = () => { this._duration = video.duration || 0; this._updateDuration(); };
    const onTimeUpdate = () => { this._updateSeekbar(); };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onPlaying);
    video.addEventListener('canplaythrough', onPlaying);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('timeupdate', onTimeUpdate);

    this._startSeekbarLoop();
    this._startLogicTimer();
  }

  private _startSeekbarLoop() {
    if (!this.video) return;
    const video = this.video;
    const FRAME_MS = 100;
    let lastPct = -1;
    let lastDur = 0;

    const update = () => {
      const dur = video.duration || 0;
      const ct = video.currentTime;
      const pct = dur > 0 ? (ct / dur) * 100 : 0;

      if (dur !== lastDur && isFinite(dur) && dur > 0) {
        lastDur = dur;
        this._duration = dur;
        this._updateDuration();
      }

      if (Math.abs(pct - lastPct) > 0.5) {
        lastPct = pct;

        let bufferedEnd = 0;
        if (video.buffered.length > 0) {
          bufferedEnd = video.buffered.end(video.buffered.length - 1);
        }
        const bufferedPct = dur > 0 ? (bufferedEnd / dur) * 100 : 0;

        const fill = this.shadow.querySelector('[data-fill]') as HTMLElement;
        const buffered = this.shadow.querySelector('[data-buffered]') as HTMLElement;
        const thumb = this.shadow.querySelector('[data-thumb]') as HTMLElement;
        const timeLabel = this.shadow.querySelector('[data-current-time]') as HTMLElement;

        if (fill) fill.style.width = `${pct}%`;
        if (buffered) buffered.style.width = `${bufferedPct}%`;
        if (thumb) thumb.style.left = `${pct}%`;
        if (timeLabel) timeLabel.textContent = formatTime(ct);
      }

      this.rafId = window.setTimeout(update, FRAME_MS);
    };

    this.rafId = window.setTimeout(update, FRAME_MS);
  }

  private _seekBy(seconds: number) {
    if (!this.video) return;

    if (!this._isSeeking) {
      this._isSeeking = true;
      this._wasPlayingBeforeSeek = !this.video.paused;
      if (!this.video.paused) this.video.pause();
    }

    this._seekAccumulator += seconds;

    this._showControls = true;
    this._updateControlsVisibility();
    this._syncOverlayFocusability();
    this._restartControlsHideTimer();

    if (this._seekEndTimer) clearTimeout(this._seekEndTimer);
    this._seekEndTimer = setTimeout(() => this._endSeek(), 300);

    if (this._seekApplyTimer) return;
    this._seekApplyTimer = setTimeout(() => {
      this._seekApplyTimer = null;
      this._applySeek();
    }, 200);
  }

  private _applySeek() {
    if (!this.video || !this._isSeeking) return;
    const video = this.video;
    const duration = video.duration || 0;
    const delta = this._seekAccumulator;
    this._seekAccumulator = 0;

    let target = Math.max(0, Math.min(video.currentTime + delta, duration));

    if (video.seekable.length > 0) {
      const seekStart = video.seekable.start(0);
      const seekEnd = video.seekable.end(video.seekable.length - 1);
      target = Math.max(seekStart, Math.min(target, seekEnd));
    }

    video.currentTime = target;

    this._showControls = true;
    this._updateControlsVisibility();
    this._syncOverlayFocusability();
    this._restartControlsHideTimer();
    this._updateSeekbar();
  }

  private _endSeek() {
    if (!this._isSeeking) return;

    if (this._seekApplyTimer) {
      clearTimeout(this._seekApplyTimer);
      this._seekApplyTimer = null;
      this._applySeek();
    }

    this._isSeeking = false;
    this._seekAccumulator = 0;

    if (this._wasPlayingBeforeSeek && this.video && this.video.paused) {
      this.video.play().catch(() => {});
    }
    this._wasPlayingBeforeSeek = false;
  }

  private _startLogicTimer() {
    this.logicTimer = setInterval(() => {
      if (!this.video) return;
      const ct = this.video.currentTime;
      const dur = this.video.duration || 0;

      // Skip segment detection
      const active = this._segments.find((s) => {
        const start = s.start ?? s.start_time ?? 0;
        const end = s.end ?? s.end_time ?? 0;
        return ct >= start && ct <= end && (s.type === 'intro' || s.segment_type === 'skip_intro' || s.type === 'resume' || s.segment_type === 'skip_resume');
      });

      if (active && active !== this._skipSegment) {
        this._skipSegment = active;
        this._showSkipButton();
      } else if (!active && this._skipSegment) {
        this._skipSegment = null;
        this._hideSkipButton();
      }

      // Next episode detection
      if (this._nextEpisode && dur > 60) {
        const nearEnd = ct > 0 && (dur - ct) <= 30;
        const shouldShow = nearEnd;

        if (shouldShow && !this._nextShowing) {
          this._showNextCardInternal();
        } else if (!shouldShow && this._nextShowing) {
          this._hideNextCard();
        }
      }
    }, LOGIC_TICK_MS);
  }

  private _updatePlayPauseIcon() {
    const icon = this.shadow.querySelector('.play-pause-btn .icon') as SVGElement;
    if (!icon) return;
    if (this._isPlaying) {
      // Pause icon
      icon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
      icon.setAttribute('fill', 'currentColor');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '0');
    } else {
      // Play icon
      icon.innerHTML = '<path d="M8 5.2v13.6L18.8 12z"></path>';
      icon.setAttribute('fill', 'currentColor');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '0');
    }
  }

  private _updateBuffering() {
    const el = this.shadow.querySelector('[data-buffering]') as HTMLElement;
    if (el) el.style.display = this._isBuffering ? 'flex' : 'none';
  }

  private _updateDuration() {
    const el = this.shadow.querySelector('[data-duration-time]') as HTMLElement;
    if (!el) return;
    const dur = this._duration;
    if (!dur || !isFinite(dur) || dur <= 0) {
      el.textContent = '0:00';
    } else {
      el.textContent = formatTime(dur);
    }
  }

  private _updateSeekbar() {
    // Called by the rAF loop
    if (!this.video) return;
    const video = this.video;
    const dur = video.duration || 0;
    const ct = video.currentTime;
    const pct = dur > 0 ? (ct / dur) * 100 : 0;

    let bufferedEnd = 0;
    if (video.buffered.length > 0) {
      bufferedEnd = video.buffered.end(video.buffered.length - 1);
    }
    const bufferedPct = dur > 0 ? (bufferedEnd / dur) * 100 : 0;

    const fill = this.shadow.querySelector('[data-fill]') as HTMLElement;
    const buffered = this.shadow.querySelector('[data-buffered]') as HTMLElement;
    const thumb = this.shadow.querySelector('[data-thumb]') as HTMLElement;
    const timeLabel = this.shadow.querySelector('[data-current-time]') as HTMLElement;

    if (fill) fill.style.width = `${pct}%`;
    if (buffered) buffered.style.width = `${bufferedPct}%`;
    if (thumb) thumb.style.left = `${pct}%`;
    if (timeLabel) timeLabel.textContent = formatTime(ct);

    const seekbar = this.shadow.querySelector('[data-seekbar-focusable]') as HTMLElement | null;
    if (seekbar) {
      seekbar.setAttribute('aria-valuenow', String(Math.round(pct)));
      seekbar.setAttribute('aria-valuetext', `${formatTime(ct)} de ${formatTime(dur)}`);
    }
  }

  private _showSkipButton() {
    const btn = this.shadow.querySelector('[data-skip-btn]') as HTMLElement;
    const label = this.shadow.querySelector('[data-skip-label]') as HTMLElement;
    if (btn) btn.style.display = 'flex';
    if (label) {
      const segType = this._skipSegment?.type === 'intro' || this._skipSegment?.segment_type === 'skip_intro' ? 'intro' : 'resumen';
      label.textContent = `Omitir ${segType}`;
    }
    this._registerSkipFocusable();
  }

  private _hideSkipButton() {
    const btn = this.shadow.querySelector('[data-skip-btn]') as HTMLElement;
    if (btn) btn.style.display = 'none';
    this._unregisterSkipFocusable();
  }

  private _registerSkipFocusable() {
    if (this._skipFocusableRegistered) return;
    const btn = this.shadow.querySelector('[data-skip-btn]') as HTMLElement;
    if (!btn) return;
    this._skipFocusableRegistered = true;
    this.registrar.register([{
      focusKey: 'watch-skip',
      node: btn,
      parentFocusKey: PARENT_FOCUS_KEY,
      onEnterPress: () => this.handleSkip(),
      onArrowPress: () => true,
      onFocus: () => btn.setAttribute('data-focused', 'true'),
      onBlur: () => btn.setAttribute('data-focused', 'false'),
    }]);
  }

  private _unregisterSkipFocusable() {
    if (!this._skipFocusableRegistered) return;
    this._skipFocusableRegistered = false;
    this.registrar.unregister('watch-skip');
  }

  private _showNextCardInternal() {
    this._nextShowing = true;
    const card = this.shadow.querySelector('[data-next-card]') as HTMLElement;
    const thumb = this.shadow.querySelector('[data-next-thumb]') as HTMLImageElement;
    const placeholder = this.shadow.querySelector('[data-next-placeholder]') as HTMLElement;
    const title = this.shadow.querySelector('[data-next-title]') as HTMLElement;

    if (card) card.classList.remove('hidden');
    if (this._nextEpisode) {
      const thumbUrl = resolveImageUrl(this._nextEpisode.thumbnail, this._clientEndpoint);
      if (thumbUrl && thumb) {
        thumb.src = thumbUrl;
        thumb.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
      } else if (placeholder) {
        placeholder.style.display = 'flex';
      }
      if (title) title.textContent = this._nextEpisode.title;
    }

    // Start countdown
    this._nextCountdown = 10;
    const countdownEl = this.shadow.querySelector('[data-next-countdown]') as HTMLElement;
    if (countdownEl) countdownEl.textContent = `${this._nextCountdown}s`;

    if (this._nextTimer) clearInterval(this._nextTimer);
    this._nextTimer = setInterval(() => {
      this._nextCountdown--;
      if (countdownEl) countdownEl.textContent = `${this._nextCountdown}s`;
      if (this._nextCountdown <= 0) {
        if (this._nextTimer) clearInterval(this._nextTimer);
        this._navigateToNext();
      }
    }, 1000);
  }

  private _hideNextCard() {
    this._nextShowing = false;
    const card = this.shadow.querySelector('[data-next-card]') as HTMLElement;
    if (card) card.classList.add('hidden');
    if (this._nextTimer) clearInterval(this._nextTimer);
  }

  private _navigateToNext() {
    if (!this._nextEpisode || !this._contentId) return;
    this.dispatchEvent(new CustomEvent('next-episode', {
      bubbles: true,
      composed: true,
      detail: { contentId: this._contentId, episodeId: this._nextEpisode.id },
    }));
  }

  private _registerSeekbarFocusable() {
    if (this._seekbarFocusableRegistered) return;
    const seekbar = this.shadow.querySelector('[data-seekbar-focusable]') as HTMLElement | null;
    if (!seekbar) return;

    this._seekbarFocusableRegistered = true;
    this.registrar.register([{
      focusKey: 'watch-seekbar',
      node: seekbar,
      parentFocusKey: PARENT_FOCUS_KEY,
      onEnterPress: () => this.togglePlayPause(),
      onArrowPress: (direction: string) => {
        if (!this._showControls || this._railExpanded) return true;
        if (direction === 'down') {
          this._focusControl('watch-playpause');
          return false;
        }
        if (direction === 'left') {
          this._seekBy(-SEEK_STEP_SECONDS);
          return false;
        }
        if (direction === 'right') {
          this._seekBy(SEEK_STEP_SECONDS);
          return false;
        }
        return true;
      },
      onFocus: () => {
        this._lastFocusedControlKey = 'watch-seekbar';
        seekbar.setAttribute('data-focused', 'true');
      },
      onBlur: () => {
        seekbar.setAttribute('data-focused', 'false');
        this._stopSeekRepeat();
        this._resetSeekHold();
        if (this._isSeeking) this._endSeek();
      },
    }]);
  }

  private _focusControl(focusKey: string): boolean {
    const el = this.shadow.querySelector(`[focus-key="${focusKey}"]`) as HTMLElement | null;
    if (!el || el.getAttribute('focusable') === 'false') return false;
    requestAnimationFrame(() => {
      SpatialNavigation.setFocus(focusKey);
    });
    return true;
  }

  private _restoreControlFocus(): void {
    if (this._focusControl(this._lastFocusedControlKey)) return;
    if (this._focusControl('watch-playpause')) return;
    SpatialNavigation.setFocus('watch-root');
  }

  private _setFocusableAttr(selector: string, enabled: boolean) {
    const el = this.shadow.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    el.setAttribute('focusable', enabled ? 'true' : 'false');
    if (!enabled) el.setAttribute('data-focused', 'false');
  }

  private _setSeekbarDomFocusable(enabled: boolean) {
    const seekbar = this.shadow.querySelector('[data-seekbar-focusable]') as HTMLElement | null;
    if (!seekbar) return;
    seekbar.setAttribute('tabindex', enabled ? '0' : '-1');
    seekbar.setAttribute('aria-disabled', String(!enabled));
    if (!enabled) seekbar.setAttribute('data-focused', 'false');
  }

  private _syncOverlayFocusability() {
    const controlsVisible = this._showControls;

    if (controlsVisible && this._allEpisodes.length > 0 && this._renderedEpisodeKeys.length === 0) {
      this._renderEpisodesRail();
    } else if (!controlsVisible && this._renderedEpisodeKeys.length > 0) {
      for (const focusKey of this._renderedEpisodeKeys) this.registrar.unregister(focusKey);
      this._renderedEpisodeKeys = [];
      this.railExpanded = false;
    }

    this._setFocusableAttr('[focus-key="watch-playpause"]', controlsVisible);
    this._setFocusableAttr('[focus-key="watch-settings"]', controlsVisible);
    this._setFocusableAttr('[focus-key="watch-episodes"]', controlsVisible && this._allEpisodes.length > 0);
    this._setSeekbarDomFocusable(controlsVisible);

    if (controlsVisible) {
      if (!this._seekbarFocusableRegistered) this._registerSeekbarFocusable();
    } else if (this._seekbarFocusableRegistered) {
      this.registrar.unregister('watch-seekbar');
      this._seekbarFocusableRegistered = false;
    }

    if (!controlsVisible) {
      const currentFocus = getCurrentFocusKey();
      if (
        !currentFocus ||
        currentFocus === 'watch-playpause' ||
        currentFocus === 'watch-settings' ||
        currentFocus === 'watch-episodes' ||
        currentFocus === 'watch-seekbar'
      ) {
        requestAnimationFrame(() => {
          if (getCurrentFocusKey() !== 'watch-root') {
            SpatialNavigation.setFocus('watch-root');
          }
        });
      }
    }
  }

  private _restartControlsHideTimer() {
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    if (this._settingsOpen || this._railExpanded) return;
    if (!this.video || this.video.paused) return;

    const currentFocus = getCurrentFocusKey() ?? '';
    if (currentFocus.startsWith('player-settings')) return;

    this.controlsTimer = setTimeout(() => {
      if (!this.video || this.video.paused || this._settingsOpen || this._railExpanded) return;
      const activeFocus = getCurrentFocusKey() ?? '';
      if (activeFocus.startsWith('player-settings')) return;
      this._showControls = false;
      this._updateControlsVisibility();
      this._syncOverlayFocusability();
    }, CONTROLS_HIDE_DELAY);
  }

  private _setupGlobalKeyHandler() {
    const handleKey = (e: KeyboardEvent) => {
      const isDirectional = e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown';
      const isAction = e.key === 'Enter' || e.key === ' ';
      if (!isDirectional && !isAction) return;
      const currentFocus = getCurrentFocusKey() ?? '';
      if (this._settingsOpen || currentFocus.startsWith('player-settings')) return;
      if (this._showControls) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this._showControls = true;
      this._updateControlsVisibility();
      this._syncOverlayFocusability();
      if (isDirectional) {
        this._restoreControlFocus();
      }
    };

    window.addEventListener('keydown', handleKey, true);
    (this as any)._keyHandler = handleKey;
  }

  /* ─── Continuous seek while holding Left/Right ──────────────────────────
     Norigin throttles repeated keydowns (80ms) and re-enters navigation on
     each one, which makes holding an arrow key unreliable for scrubbing and
     can steal focus from the seekbar. These handlers run in the capture
     phase on window, BEFORE norigin's bubble-phase listeners, and swallow
     Left/Right entirely while the seekbar is active. The media is seeked
     directly here, so focus never leaves the seekbar during a hold.

     We cannot rely on the OS delivering repeated keydown events: IR remotes
     and some TV WebViews only send a single press. So the first keydown
     starts a self-driven repeat timer (SEEK_REPEAT_MS) that keeps stepping
     until the key is released (or focus leaves the seekbar). */

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

  private _resetSeekHold() {
    this._seekKeyHeld = false;
    this._seekDirection = 0;
    this._seekHeldAt = 0;
  }

  private _startSeekRepeat(dir: number) {
    this._stopSeekRepeat();
    this._seekRepeatTimer = setInterval(() => {
      // Self-healing: stop if the key was released, the video vanished or the
      // seekbar is no longer active (focus moved, controls hidden, rail open).
      if (!this._seekKeyHeld || !this.video || !this._seekbarHoldCanIntercept()) {
        this._stopSeekRepeat();
        this._resetSeekHold();
        if (this._isSeeking) this._endSeek();
        return;
      }
      this._seekBy(dir * SEEK_STEP_SECONDS);
    }, SEEK_REPEAT_MS);
  }

  private _stopSeekRepeat() {
    if (this._seekRepeatTimer) {
      clearInterval(this._seekRepeatTimer);
      this._seekRepeatTimer = null;
    }
  }

  private _seekbarHoldCanIntercept(): boolean {
    if (this._settingsOpen || this._railExpanded) return false;
    // Desktop path: clicking the seekbar puts DOM focus on it while norigin's
    // focus key stays elsewhere. If the seekbar (or a child) has DOM focus we
    // intercept regardless of norigin state.
    const seekbar = this.shadow.querySelector('[data-seekbar-focusable]') as HTMLElement | null;
    if (seekbar && (document.activeElement === seekbar || seekbar.contains(document.activeElement))) {
      return true;
    }
    if (!this._showControls) return false;
    return (getCurrentFocusKey() ?? '') === 'watch-seekbar';
  }

  private _handleSeekbarKeyDown = (e: KeyboardEvent) => {
    const code = e.keyCode || e.key;
    const dir = code === 37 || code === 'ArrowLeft' ? -1 : code === 39 || code === 'ArrowRight' ? 1 : 0;
    if (!dir) return;
    if (!this._seekbarHoldCanIntercept()) return;

    // Norigin (and anything else) must never see these: focus stays on the seekbar.
    e.preventDefault();
    e.stopImmediatePropagation();

    if (!this._seekKeyHeld) {
      // Initial press: seek immediately and start the self-driven repeat.
      this._seekKeyHeld = true;
      this._seekDirection = dir;
      this._seekHeldAt = performance.now();
      this._seekBy(dir * SEEK_STEP_SECONDS);
      this._startSeekRepeat(dir);
      return;
    }
    // Direction flipped mid-hold (rare): reseed the repeat with the new direction.
    if (dir !== this._seekDirection) {
      this._seekDirection = dir;
      this._seekBy(dir * SEEK_STEP_SECONDS);
      this._startSeekRepeat(dir);
    }
  };

  private _handleSeekbarKeyUp = (e: KeyboardEvent) => {
    if (!this._seekKeyHeld) return;
    const code = e.keyCode || e.key;
    if (code !== 37 && code !== 'ArrowLeft' && code !== 39 && code !== 'ArrowRight') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const wasHold = performance.now() - this._seekHeldAt >= SEEK_REPEAT_MS;
    this._stopSeekRepeat();
    this._resetSeekHold();
    if (wasHold) this._endSeek();
  };

  private _handleEnterPress = (e: Event) => {
    const source = e.composedPath().find(
      (el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'),
    );
    const key = source?.getAttribute('focus-key');
    if (!key) return;
    if (key === this._lastEnterKey && e.timeStamp - this._lastEnterTime < 300) return;
    this._lastEnterKey = key;
    this._lastEnterTime = e.timeStamp;
    switch (key) {
      case 'watch-seekbar':
        this.togglePlayPause();
        break;
      case 'watch-playpause':
        this.togglePlayPause();
        break;
      case 'watch-episodes':
        this.toggleEpisodesRail();
        break;
      case 'watch-settings':
        this.toggleSettings();
        break;
      case 'watch-next-play':
        this.playNextEpisode();
        break;
      case 'watch-next-cancel':
        this.cancelNextEpisode();
        break;
    }
    this._restartControlsHideTimer();
  };

  private _handleFocusGained = (e: Event) => {
    const source = e.composedPath().find(
      (el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'),
    );
    const key = source?.getAttribute('focus-key');
    if (!key) return;
    if (key.startsWith('watch-') || key.startsWith('rail-ep-item-')) {
      this._lastFocusedControlKey = key;
    }
    this._restartControlsHideTimer();
  };

  private _handleFocusLost = (_e: Event) => {
    if (!this._railExpanded) return;
    requestAnimationFrame(() => {
      const currentFocus = getCurrentFocusKey();
      if (
        currentFocus === 'watch-episodes' ||
        currentFocus === 'episodes-rail' ||
        currentFocus?.startsWith('rail-ep-item-')
      ) {
        return;
      }
      this.railExpanded = false;
    });
  };

  private _handleArrowPress = (e: Event) => {
    const custom = e as CustomEvent<{ direction?: string }>;
    const source = custom.composedPath().find(
      (el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('focus-key'),
    );
    const key = source?.getAttribute('focus-key');
    this._restartControlsHideTimer();

    if (key === 'watch-settings' && custom.detail?.direction === 'left') {
      custom.preventDefault();
      this._focusControl('watch-playpause');
      return;
    }

    if (key === 'watch-playpause' && custom.detail?.direction === 'left') {
      custom.preventDefault();
      this._focusControl('watch-episodes');
      return;
    }

    if (key === 'watch-playpause' && custom.detail?.direction === 'right') {
      custom.preventDefault();
      this._focusControl('watch-settings');
      return;
    }

    if (key === 'watch-episodes' && custom.detail?.direction === 'right') {
      custom.preventDefault();
      this._focusControl('watch-playpause');
      return;
    }

    if (key !== 'watch-episodes' || custom.detail?.direction !== 'down' || this._allEpisodes.length === 0) {
      return;
    }

    custom.preventDefault();
    this.railExpanded = true;
    const activeEp = this._allEpisodes.find((e) => e.id === this._currentEpisodeId) ?? this._allEpisodes[0];
    if (activeEp) {
      requestAnimationFrame(() => {
        SpatialNavigation.setFocus(`rail-ep-item-${activeEp.id}`);
      });
    }
  };

  private _showControlsTemporarily(restoreFocus = true) {
    this._showControls = true;
    this._updateControlsVisibility();
    this._syncOverlayFocusability();
    if (restoreFocus) this._restoreControlFocus();
    this._restartControlsHideTimer();
  }

  private _updateControlsVisibility() {
    const overlay = this.shadow.querySelector('[data-controls-overlay]') as HTMLElement;
    if (overlay) {
      overlay.classList.toggle('hidden', !this._showControls);
    }
    this.classList.toggle('controls-hidden', !this._showControls);
  }

  // --- Public API ---

  set showControls(value: boolean) {
    this._showControls = value;
    this._updateControlsVisibility();
    this._syncOverlayFocusability();
    if (value) this._restoreControlFocus();
    this._restartControlsHideTimer();
  }

  get showControls(): boolean {
    return this._showControls;
  }

  set contentTitle(value: string) {
    const el = this.shadow.querySelector('[data-title]') as HTMLElement;
    if (el) el.textContent = value;
  }

  set contentSubtitle(value: string) {
    const el = this.shadow.querySelector('[data-subtitle]') as HTMLElement;
    if (el) el.textContent = value;
  }

  set railExpanded(value: boolean) {
    if (value === this._railExpanded) return;
    this._railExpanded = value;
    const container = this.shadow.querySelector('[data-episodes-container]') as HTMLElement;
    const rail = this.shadow.querySelector('[data-episode-rail]') as HTMLElement;

    if (container) {
      container.className = `episodes-container ${value ? 'episodes-expanded' : 'episodes-collapsed'}`;
    }
    if (rail) rail.dataset.expanded = String(value);

    this._syncOverlayFocusability();
    this._restartControlsHideTimer();
  }

  get railExpanded(): boolean {
    return this._railExpanded;
  }

  set settingsOpen(value: boolean) {
    this._settingsOpen = value;
    this.dispatchEvent(new CustomEvent('settings-toggle', {
      bubbles: true, composed: true,
      detail: { open: value },
    }));
    this._restartControlsHideTimer();
  }

  get settingsOpen(): boolean {
    return this._settingsOpen;
  }

  set nextEpisode(value: FlatEpisode | null) {
    this._nextEpisode = value;
    if (!value) this._hideNextCard();
  }

  set skipSegment(value: Segment | null) {
    this._skipSegment = value;
    if (value) this._showSkipButton();
    else this._hideSkipButton();
  }

  set isBuffering(value: boolean) {
    this._isBuffering = value;
    this._updateBuffering();
  }

  focusPlayPause() {
    SpatialNavigation.setFocus('watch-playpause');
  }

  focusSettings() {
    SpatialNavigation.setFocus('watch-settings');
  }

  focusSkip() {
    SpatialNavigation.setFocus('watch-skip');
  }

  focusNextPlay() {
    SpatialNavigation.setFocus('watch-next-play');
  }

  toggleSettings() {
    this.settingsOpen = !this._settingsOpen;
  }

  toggleEpisodesRail() {
    this.railExpanded = !this._railExpanded;
    if (this._railExpanded) {
      const activeEp =
        this._allEpisodes.find((e) => e.id === this._currentEpisodeId) ?? this._allEpisodes[0];
      if (activeEp) {
        requestAnimationFrame(() => {
          SpatialNavigation.setFocus(`rail-ep-item-${activeEp.id}`);
        });
      }
    } else {
      SpatialNavigation.setFocus('watch-episodes');
    }
  }

  togglePlayPause() {
    if (this._isSeeking) {
      this._endSeek();
      return;
    }
    if (this.video) {
      if (this._isPlaying) {
        this.video.pause();
      } else {
        this.video.play().catch(() => { });
      }
    }
  }

  handleSkip() {
    if (!this._skipSegment) return;
    if (this._isSeeking) this._endSeek();
    const end = this._skipSegment.end ?? this._skipSegment.end_time ?? 0;
    if (this.video) this.video.currentTime = end;
    this._skipSegment = null;
    this._hideSkipButton();
    this.dispatchEvent(new CustomEvent('skip', { bubbles: true, composed: true }));
  }

  playNextEpisode() {
    if (!this._nextEpisode || !this._contentId) return;
    if (this._isSeeking) this._endSeek();
    if (this._nextTimer) clearInterval(this._nextTimer);
    this._hideNextCard();
    this.dispatchEvent(new CustomEvent('next-episode', {
      bubbles: true, composed: true,
      detail: { contentId: this._contentId, episodeId: this._nextEpisode.id },
    }));
  }

  cancelNextEpisode() {
    if (this._nextTimer) clearInterval(this._nextTimer);
    this._hideNextCard();
  }
}

customElements.define('tv-player-controls', PlayerControlsElement);

export { PlayerControlsElement };
