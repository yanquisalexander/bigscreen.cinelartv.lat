import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SpatialNavigation, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
import { FocusableRegistrar } from './spatialFocus';
import { resolveEpisodeThumbnail } from '@/utils/helpers';
import type { FlatEpisode } from './RailEpisodeItem';
import { ctvIconSheet } from '@/lib/ctvIcons';

const PARENT_FOCUS_KEY = 'watch-root';

@customElement('tv-player-episode-rail')
export class PlayerEpisodeRailElement extends LitElement {
  static styles = css`
    :host { display: block; width: 100%; contain: layout style; }

    .episode-rail {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: clamp(8rem, 16vh, 11rem);
      padding: 0 clamp(2rem, 4vw, 3rem);
      margin-top: clamp(0.5rem, 1.2vh, 0.8rem);
      pointer-events: auto;
      opacity: 0.4;
      transition: opacity 300ms ease;
    }

    :host([expanded]) .episode-rail { opacity: 1; }
    :host([controls-hidden]) .episode-rail { opacity: 0; pointer-events: none; }
    .episode-rail[hidden] { display: none !important; }

    .episode-rail-viewport {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      padding: clamp(0.35rem, 0.8vh, 0.55rem) 0;
    }

    .episode-rail-track {
      position: absolute;
      height: 100%;
      width: 100%;
      top: 0;
      left: 0;
      transform: translateY(clamp(8rem, 16vh, 10.5rem));
      transition: transform 300ms cubic-bezier(0.26, 0.86, 0.44, 0.985);
    }

    :host([expanded]) .episode-rail-track { transform: translateY(0); }
    :host([expanded]) .episode-rail-viewport { overflow: visible; }

    .episode-card {
      position: absolute;
      left: 0;
      top: 0;
      display: block;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      outline: 0;
      color: #fff;
      text-align: left;
      cursor: pointer;
      transform: translateX(var(--ep-x, 0px));
      transition: opacity 200ms ease, border-color 200ms ease;
      opacity: 1;
    }

    .episode-card[data-focused="true"] { z-index: 2; }
    .episode-card[data-partial="true"] { opacity: 0.3; }

    .episode-thumb {
      display: block;
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border: 2px solid transparent;
      border-radius: 0.75rem;
      background: #262626;
      transition: border-color 200ms ease, transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .episode-card[data-focused="true"] .episode-thumb { border-color: #fff; transform: scale(1.03); }
    .episode-card[data-current="true"] .episode-thumb { border-color: rgba(255,255,255,0.55); }
    .episode-card[data-focused="true"][data-current="true"] .episode-thumb { border-color: #fff; }
    .episode-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .episode-thumb::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%); pointer-events: none; }

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
      transition: white-space 200ms ease;
    }

    :host([expanded]) .episode-card-title {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .episode-card-desc {
      display: none;
      width: 100%;
      margin: 0.25rem 0 0;
      color: rgba(255,255,255,0.45);
      font-size: clamp(0.65rem, 0.85vw, 0.75rem);
      line-height: 1.35;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :host([expanded]) .episode-card-desc {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .episode-card[data-focused="true"] .episode-card-desc { color: rgba(255,255,255,0.6); }

    .episode-badge {
      position: absolute;
      top: clamp(0.35rem, 0.6vh, 0.5rem);
      left: clamp(0.35rem, 0.6vw, 0.5rem);
      z-index: 2;
      background: rgba(0,0,0,0.6);
      color: #fff;
      font-size: clamp(0.55rem, 0.7vw, 0.65rem);
      font-weight: 600;
      padding: clamp(0.1rem, 0.2vh, 0.15rem) clamp(0.3rem, 0.5vw, 0.4rem);
      border-radius: clamp(0.2rem, 0.4vw, 0.25rem);
      pointer-events: none;
    }

    .episode-playing-label {
      position: absolute;
      bottom: clamp(0.35rem, 0.6vh, 0.5rem);
      left: clamp(0.35rem, 0.6vw, 0.5rem);
      z-index: 2;
      color: #fff;
      font-size: clamp(0.55rem, 0.7vw, 0.65rem);
      font-weight: 500;
      pointer-events: none;
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

  @property({ type: Array, attribute: false }) episodes: FlatEpisode[] = [];
  @property({ type: String, attribute: false }) currentEpisodeId: string | number | null = null;
  @property({ type: Boolean, reflect: true }) expanded = false;
  @property({ type: Boolean, reflect: true, attribute: 'controls-hidden' }) controlsHidden = false;
  @property({ type: String, attribute: 'client-endpoint' }) clientEndpoint = '';

  @state() private _renderedEpisodeKeys: string[] = [];

  private registrar = new FocusableRegistrar();
  private _virtualScrollLeft = 0;
  private _virtualViewportWidth = 0;
  private _virtualItemWidth = 0;
  private _virtualGap = 0;
  private _virtualOverscan = 2;
  private _virtualViewportEl: HTMLElement | null = null;
  private _virtualTrackEl: HTMLElement | null = null;
  private _virtualMetricsComputed = false;
  private _virtualResizeObserver: ResizeObserver | null = null;
  private _lastFocusedControlKey = '';

  disconnectedCallback() {
    super.disconnectedCallback();
    this.registrar.unregisterAll();
    if (this._virtualResizeObserver) {
      this._virtualResizeObserver.disconnect();
      this._virtualResizeObserver = null;
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('episodes') && this.episodes.length > 0 && !this._virtualMetricsComputed) {
      requestAnimationFrame(() => this._computeVirtualMetrics());
    }
    if (changedProperties.has('expanded') && this.expanded && !this._virtualMetricsComputed) {
      requestAnimationFrame(() => this._computeVirtualMetrics());
    }
    if (changedProperties.has('expanded') || changedProperties.has('controlsHidden') || changedProperties.has('episodes')) {
      this._syncFocusables();
    }
  }

  render() {
    return html`
      <div class="episode-rail" ?hidden=${this.episodes.length === 0}>
        ${this._renderEpisodeList()}
      </div>
    `;
  }

  private _renderEpisodeCard(episode: FlatEpisode, index: number, hasMultipleSeasons: boolean) {
    const isCurrent = String(episode.id) === String(this.currentEpisodeId);
    const imageUrl = resolveEpisodeThumbnail(episode.images, episode.thumbnail_resized ?? episode.thumbnail, this.clientEndpoint, 'small');
    const itemW = this._virtualItemWidth || 180;
    const gap = this._virtualGap || 12;
    const x = index * (itemW + gap);
    const vpW = this._virtualViewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const isPartial = x < this._virtualScrollLeft || x + itemW > this._virtualScrollLeft + vpW;
    const epDescription = (episode as any).description || 'Este episodio no tiene descripción disponible.';

    return html`
      <div class="episode-card"
           data-focused="false"
           data-current=${isCurrent}
           data-partial=${isPartial || undefined}
           data-episode-index=${index}
           style="width: ${itemW}px; --ep-x: ${x}px;"
           role="button"
           tabindex="-1"
           aria-label="Episodio ${index + 1}: ${episode.title}"
           @click=${this._handleEpisodeCardClick}>
        <span class="episode-thumb">
          ${imageUrl ? html`<img src=${imageUrl} alt="" loading="lazy" />` : ''}
          <span class="episode-badge">${hasMultipleSeasons ? `T${episode.seasonNumber} · ` : ''}E${index + 1}</span>
          ${isCurrent ? html`<span class="episode-playing-label">Reproduciendo</span>` : ''}
        </span>
        <span class="episode-card-title">
          ${episode.title}
        </span>
        <span class="episode-card-desc">${epDescription}</span>
      </div>
    `;
  }

  private _handleEpisodeCardClick = (e: Event) => {
    const target = e.composedPath().find((el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains('episode-card'));
    if (!target) return;
    const index = parseInt(target.getAttribute('data-episode-index') || '-1', 10);
    if (index >= 0 && index < this.episodes.length) {
      this._selectEpisode(this.episodes[index].id);
    }
  };

  private _renderEpisodeList() {
    if (this.episodes.length === 0) return html``;

    const hasMultipleSeasons = new Set(this.episodes.map(e => e.seasonNumber)).size > 1;
    const { start, end } = this._getVisibleRange();

    return html`
      <div class="episode-rail-viewport" data-virtual-viewport>
        <div class="episode-rail-track" data-virtual-track
             style="transform: translateX(${-this._virtualScrollLeft}px) translateZ(0);">
          ${this.episodes.slice(start, end).map((episode, i) => {
            return this._renderEpisodeCard(episode, start + i, hasMultipleSeasons);
          })}
        </div>
      </div>
    `;
  }

  private _computeVirtualMetrics() {
    this._virtualViewportEl = this.renderRoot.querySelector('[data-virtual-viewport]') as HTMLElement | null;
    this._virtualTrackEl = this.renderRoot.querySelector('[data-virtual-track]') as HTMLElement | null;

    if (!this._virtualViewportEl) return;

    const temp = document.createElement('div');
    temp.className = 'episode-card';
    temp.style.cssText = 'position:absolute;visibility:hidden;width:clamp(156px,18vw,230px);';
    this._virtualViewportEl.appendChild(temp);
    this._virtualItemWidth = temp.offsetWidth;
    this._virtualGap = parseFloat(getComputedStyle(this._virtualViewportEl).gap) || 12;
    temp.remove();

    this._virtualViewportWidth = this._virtualViewportEl.clientWidth;
    this._virtualMetricsComputed = true;

    if (!this._virtualResizeObserver) {
      this._virtualResizeObserver = new ResizeObserver(() => {
        if (this._virtualViewportEl) {
          this._virtualViewportWidth = this._virtualViewportEl.clientWidth;
        }
      });
      this._virtualResizeObserver.observe(this._virtualViewportEl);
    }

    this._scrollToCurrentEpisode();
  }

  private _getVisibleRange(): { start: number; end: number } {
    const itemW = this._virtualItemWidth || 180;
    const gap = this._virtualGap || 12;
    const totalItemWidth = itemW + gap;
    const vpWidth = this._virtualViewportWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);

    const start = Math.max(0, Math.floor(this._virtualScrollLeft / totalItemWidth) - this._virtualOverscan);
    const visibleCount = Math.ceil(vpWidth / totalItemWidth);
    const end = Math.min(this.episodes.length, start + visibleCount + this._virtualOverscan * 2);

    return { start, end };
  }

  private _setVirtualScrollLeft(px: number) {
    this._virtualScrollLeft = px;
    this.requestUpdate();
  }

  scrollToVirtualItem(index: number) {
    const itemWidth = this._virtualItemWidth || 180;
    const gap = this._virtualGap || 12;
    const step = itemWidth + gap;
    const viewportWidth = this._virtualViewportWidth || this._virtualViewportEl?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const totalWidth = Math.max(0, this.episodes.length * step - gap);
    const endPadding = itemWidth * 0.35;
    const maxScroll = Math.max(0, totalWidth - viewportWidth + endPadding);

    const x = index * step;
    const target = Math.max(0, Math.min(x - viewportWidth / 2 + itemWidth / 2, maxScroll));

    this._setVirtualScrollLeft(target);
  }

  async revealAndFocusEpisode(index: number) {
    const episode = this.episodes[index];
    if (!episode) return;
    const focusKey = `rail-ep-item-${episode.id}`;

    this.scrollToVirtualItem(index);
    await this.updateComplete;
    this._syncFocusables();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      SpatialNavigation.setFocus(focusKey);
    } catch (_err) {
      // noop
    }
  }

  private _scrollToCurrentEpisode() {
    const currentIndex = this.episodes.findIndex(e => String(e.id) === String(this.currentEpisodeId));
    if (currentIndex >= 0) {
      this.scrollToVirtualItem(currentIndex);
    }
  }

  private _syncFocusables() {
    const episodeCards = this.renderRoot.querySelectorAll('.episode-card');
    for (const focusKey of this._renderedEpisodeKeys) this.registrar.unregister(focusKey);
    this._renderedEpisodeKeys = [];

    episodeCards.forEach((card) => card.setAttribute('data-focused', 'false'));

    if (!this.controlsHidden && this.expanded && this.episodes.length > 0) {
      episodeCards.forEach((card) => {
        const index = parseInt(card.getAttribute('data-episode-index') || '-1', 10);
        if (index < 0 || index >= this.episodes.length) return;
        const episode = this.episodes[index];
        if (!episode) return;
        const focusKey = `rail-ep-item-${episode.id}`;
        this.registrar.register([{
          focusKey,
          node: card as HTMLElement,
          parentFocusKey: PARENT_FOCUS_KEY,
          onEnterPress: () => this._selectEpisode(episode.id),
          onArrowPress: (direction: string) => {
            if (direction === 'up') {
              this._dispatch('rail-collapse');
              return false;
            }
            if (direction === 'down') return false;
            if (direction === 'left') {
              if (index === 0) return false;
              void this.revealAndFocusEpisode(index - 1);
              return false;
            }
            if (direction === 'right') {
              if (index === this.episodes.length - 1) return false;
              void this.revealAndFocusEpisode(index + 1);
              return false;
            }
            return true;
          },
          onFocus: () => {
            this._lastFocusedControlKey = focusKey;
            card.setAttribute('data-focused', 'true');
            this.scrollToVirtualItem(index);
          },
          onBlur: () => {
            card.setAttribute('data-focused', 'false');
            requestAnimationFrame(() => this._collapseIfFocusLeaves());
          },
        }]);
        this._renderedEpisodeKeys.push(focusKey);
      });
    }
  }

  private _collapseIfFocusLeaves() {
    const currentFocus = getCurrentFocusKey() ?? '';
    if (currentFocus.startsWith('rail-ep-item-')) return;
    this._dispatch('rail-collapse');
  }

  private _selectEpisode(episodeId: string | number) {
    this._dispatch('episode-select', { episodeId });
  }

  private _dispatch(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  public focusEpisodeRail() {
    const focusKey = this._resolveRailFocusKey();
    const railIndex = focusKey ? this.episodes.findIndex((e) => `rail-ep-item-${e.id}` === focusKey) : -1;
    if (railIndex >= 0) void this.revealAndFocusEpisode(railIndex);
  }

  private _resolveRailFocusKey(): string | null {
    if (this._lastFocusedControlKey?.startsWith('rail-ep-item-') && doesFocusableExist(this._lastFocusedControlKey)) {
      return this._lastFocusedControlKey;
    }
    const activeEp = this.episodes.find((e) => String(e.id) === String(this.currentEpisodeId)) ?? this.episodes[0];
    return activeEp ? `rail-ep-item-${activeEp.id}` : null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tv-player-episode-rail': PlayerEpisodeRailElement;
  }
}
