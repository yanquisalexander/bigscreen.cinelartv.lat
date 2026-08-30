import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core';
import { FocusableRegistrar } from './spatialFocus';
import { resolveEpisodeThumbnail } from '@/utils/helpers';
import type { FlatEpisode } from './RailEpisodeItem';

const PARENT_FOCUS_KEY = 'watch-root';

@customElement('tv-player-next-card')
export class PlayerNextCardElement extends LitElement {
  static styles = css`
    :host { display: block; contain: layout style; }

    .next-card {
      position: absolute;
      bottom: clamp(10rem, 20vh, 14rem);
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

    .next-card.hidden { opacity: 0; transform: translateY(12px); pointer-events: none; }

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

    .next-card .content { flex: 1; min-width: 0; }
    .next-card .label { font-size: clamp(0.65rem, 0.8vw, 0.7rem); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); }
    .next-card .title { color: #ffffff; font-size: clamp(0.875rem, 1.1vw, 1rem); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .next-card .actions { display: flex; align-items: center; gap: clamp(0.5rem, 1vw, 0.75rem); }
    .next-card .countdown { color: rgba(255,255,255,0.7); font-size: clamp(0.75rem, 1vw, 0.875rem); font-variant-numeric: tabular-nums; background: rgba(255,255,255,0.08); padding: clamp(0.25rem, 0.5vw, 0.375rem) clamp(0.5rem, 1vw, 0.75rem); border-radius: clamp(0.25rem, 0.5vw, 0.375rem); }

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

    .next-card .play-btn[data-focused="true"] { scale: 1.1; box-shadow: 0 0 0 4px #ffffff; }

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

    .next-card .cancel-btn[data-focused="true"] { scale: 1.1; box-shadow: 0 0 0 4px rgba(255,255,255,0.5); }
  `;

  @property({ type: Object, attribute: false }) episode: FlatEpisode | null = null;
  @property({ type: String }) contentId: string | null = null;
  @property({ type: String, attribute: 'client-endpoint' }) clientEndpoint = '';

  @state() private _showing = false;
  @state() private _countdown = 10;

  private registrar = new FocusableRegistrar();
  private _nextTimer: ReturnType<typeof setInterval> | null = null;
  private _focusablePlayRegistered = false;
  private _focusableCancelRegistered = false;

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._nextTimer) { clearInterval(this._nextTimer); this._nextTimer = null; }
    this.registrar.unregisterAll();
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('episode')) {
      if (!this.episode) {
        this._hide();
      }
    }
  }

  render() {
    if (!this.episode) return html``;

    return html`
      <div class="next-card ${this._showing ? '' : 'hidden'}" data-next-card>
        ${this.episode.thumbnail ? html`
          <img src=${resolveEpisodeThumbnail(this.episode.images, this.episode.thumbnail_resized ?? this.episode.thumbnail, this.clientEndpoint) || ''} />
        ` : html`
          <div class="placeholder-thumb">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
        `}
        <div class="content">
          <div class="label">Siguiente episodio</div>
          <div class="title" data-next-title>${this.episode.title}</div>
        </div>
        <div class="actions">
          <span class="countdown" data-next-countdown>${this._countdown}s</span>
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
    `;
  }

  public show() {
    if (this._showing) return;
    this._showing = true;
    this._countdown = 10;
    this._syncFocusables();

    if (this._nextTimer) clearInterval(this._nextTimer);
    this._nextTimer = setInterval(() => {
      this._countdown--;
      if (this._countdown <= 0) {
        if (this._nextTimer) clearInterval(this._nextTimer);
        this._navigateToNext();
      }
    }, 1000);
  }

  public hide() {
    this._hide();
  }

  private _hide() {
    this._showing = false;
    if (this._nextTimer) { clearInterval(this._nextTimer); this._nextTimer = null; }
    this.registrar.unregisterAll();
    this._focusablePlayRegistered = false;
    this._focusableCancelRegistered = false;
  }

  private _syncFocusables() {
    const playBtn = this.renderRoot.querySelector('.play-btn') as HTMLElement | null;
    const cancelBtn = this.renderRoot.querySelector('.cancel-btn') as HTMLElement | null;

    if (playBtn && !this._focusablePlayRegistered) {
      this._focusablePlayRegistered = true;
      this.registrar.register([{
        focusKey: 'watch-next-play',
        node: playBtn,
        parentFocusKey: PARENT_FOCUS_KEY,
        onEnterPress: () => this._dispatch('play-next'),
        onArrowPress: () => true,
        onFocus: () => playBtn.setAttribute('data-focused', 'true'),
        onBlur: () => playBtn.setAttribute('data-focused', 'false'),
      }]);
    }

    if (cancelBtn && !this._focusableCancelRegistered) {
      this._focusableCancelRegistered = true;
      this.registrar.register([{
        focusKey: 'watch-next-cancel',
        node: cancelBtn,
        parentFocusKey: PARENT_FOCUS_KEY,
        onEnterPress: () => this._dispatch('cancel-next'),
        onArrowPress: () => true,
        onFocus: () => cancelBtn.setAttribute('data-focused', 'true'),
        onBlur: () => cancelBtn.setAttribute('data-focused', 'false'),
      }]);
    }
  }

  private _navigateToNext() {
    if (!this.episode || !this.contentId) return;
    this._dispatch('play-next');
  }

  private _dispatch(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  public focusPlay() { SpatialNavigation.setFocus('watch-next-play'); }
  public focusCancel() { SpatialNavigation.setFocus('watch-next-cancel'); }
}

declare global {
  interface HTMLElementTagNameMap {
    'tv-player-next-card': PlayerNextCardElement;
  }
}
