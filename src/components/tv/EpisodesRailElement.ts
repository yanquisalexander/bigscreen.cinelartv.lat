import { FocusableRegistrar } from './spatialFocus';
import type { FlatEpisode } from './RailEpisodeItem';

export type EpisodeWithThumb = { ep: FlatEpisode; thumbUrl: string | null | undefined };

const PARENT_FOCUS_KEY = 'episodes-rail';

class EpisodesRailElement extends HTMLElement {
  private _episodes: EpisodeWithThumb[] = [];
  private _currentIndex = -1;
  private _expanded = false;
  private _seasonCount = 0;
  private _registrar = new FocusableRegistrar();

  static get observedAttributes() {
    return ['expanded', 'current-index'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    this.setupShell();
    if (this._episodes.length > 0) {
      this.renderEpisodes();
    }
  }

  disconnectedCallback() {
    this.unregisterFocusables();
  }

  attributeChangedCallback(name: string, _old: string, newValue: string) {
    if (name === 'expanded') {
      this._expanded = newValue === 'true';
      this.updateExpanded();
    }
    if (name === 'current-index') {
      this._currentIndex = parseInt(newValue, 10);
      this.updateActive();
    }
  }

  set episodes(value: EpisodeWithThumb[]) {
    if (!value || value.length === 0) return;
    this.unregisterFocusables();
    this._episodes = value;
    this._seasonCount = new Set(value.map((e) => e.ep.seasonNumber)).size;
    this.renderEpisodes();
  }

  get episodes() {
    return this._episodes;
  }

  private setupShell() {
    this.innerHTML = `
      <div data-ep-rail style="width: 100%; transition: transform 300ms ease;">
        <div data-ep-viewport style="
          width: 100%;
          position: relative;
          display: flex;
          gap: clamp(0.625rem, 1.5vw, 0.875rem);
          overflow-x: auto;
          padding: clamp(0.5rem, 1.4vw, 0.75rem);
          scroll-snap-type: x proximity;
          scroll-padding-inline: clamp(2rem, 4vw, 3rem);
          -ms-overflow-style: none;
          scrollbar-width: none;
        "></div>
      </div>
      <style>
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        [data-ep-viewport]::-webkit-scrollbar { display: none; }
        [data-ep-item]:focus { outline: none; }
      </style>
    `;
    this.updateExpanded();
  }

  private renderEpisodes() {
    const viewport = this.querySelector('[data-ep-viewport]');
    if (!viewport) return;

    const cw = this._expanded ? 'clamp(180px, 13.5vw, 260px)' : 'clamp(156px, 11.5vw, 220px)';
    const ch = this._expanded ? 'clamp(101px, 7.6vw, 146px)' : 'clamp(88px, 6.5vw, 124px)';

    viewport.innerHTML = this._episodes
      .map(
        (item, index) => {
          const { ep, thumbUrl } = item;
          return `
            <div data-ep-item tabindex="0" data-id="${ep.id}" style="
              width: ${cw};
              flex-shrink: 0;
              scroll-snap-align: center;
              cursor: pointer;
              transition: transform 300ms ease;
            ">
              <div data-ep-card style="
                position: relative;
                background: #262626;
                border-radius: 0.75rem;
                overflow: hidden;
                transition: box-shadow 300ms ease, transform 300ms ease;
                width: ${cw};
                height: ${ch};
              ">
                ${
                  thumbUrl
                    ? `<img src="${thumbUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`
                    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#262626;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#525252" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>`
                }
                <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.6), transparent);pointer-events:none;"></div>
                <div data-active-indicator style="
                  position:absolute;inset:0;
                  background:rgba(0,0,0,0.4);
                  display:none;align-items:center;justify-content:center;
                ">
                  <div style="
                    width:2.5rem;height:2.5rem;border-radius:9999px;
                    background:rgba(255,255,255,0.9);
                    display:flex;align-items:center;justify-content:center;
                  ">
                    <div style="display:flex;align-items:flex-end;gap:2px;height:0.875rem;">
                      <div style="width:2px;height:0.5rem;background:#000;border-radius:9999px;animation:pulse 1s infinite;"></div>
                      <div style="width:2px;height:0.875rem;background:#000;border-radius:9999px;animation:pulse 1s infinite 0.15s;"></div>
                      <div style="width:2px;height:0.625rem;background:#000;border-radius:9999px;animation:pulse 1s infinite 0.3s;"></div>
                    </div>
                  </div>
                </div>
                <div style="
                  position:absolute;top:0.5rem;left:0.5rem;
                  background:rgba(0,0,0,0.6);
                  padding:0.125rem 0.5rem;border-radius:0.25rem;
                  font-size:0.625rem;font-weight:600;color:rgba(255,255,255,0.8);
                ">${this._seasonCount > 1 ? `T${ep.seasonNumber} · ` : ''}E${index + 1}</div>
              </div>
              <div style="margin-top:0.5rem;padding:0 0.125rem;">
                <p data-title style="
                  font-size:0.8125rem;font-weight:500;
                  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                  color:rgba(255,255,255,0.65);
                  transition:color 200ms;
                ">${ep.title}</p>
                <p data-status-text style="
                  font-size:0.6875rem;font-weight:500;margin-top:0.125rem;
                  color:#fff;
                  display:none;
                ">Reproduciendo</p>
              </div>
            </div>`;
        },
      )
      .join('');

    this.bindEvents();
    this.registerFocusables();
    this.updateActive();
  }

  private bindEvents() {
    this._episodes.forEach((item) => {
      const el = this.querySelector(`[data-id="${item.ep.id}"]`);
      if (!el) return;

      el.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('episode-selected', {
            detail: { epId: item.ep.id },
            bubbles: true,
            composed: true,
          }),
        );
      });
    });
  }

  private registerFocusables() {
    this.unregisterFocusables();
    const items = this._episodes.map((item) => {
      const el = this.querySelector(`[data-id="${item.ep.id}"]`) as HTMLElement | null;
      if (!el) return null;
      return {
        focusKey: `rail-ep-item-${item.ep.id}`,
        node: el,
        parentFocusKey: PARENT_FOCUS_KEY,
        onEnterPress: () => {
          this.dispatchEvent(
            new CustomEvent('episode-selected', {
              detail: { epId: item.ep.id },
              bubbles: true,
              composed: true,
            }),
          );
        },
        onArrowPress: () => true,
        onFocus: () => {
          el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          this.dispatchEvent(
            new CustomEvent('episode-focused', {
              detail: { ep: item.ep },
              bubbles: true,
              composed: true,
            }),
          );
        },
        onUpdateFocus: (focused: boolean) => {
          const card = el.querySelector('[data-ep-card]') as HTMLElement | null;
          if (card) {
            card.style.boxShadow = focused ? '0 10px 15px -3px rgba(0,0,0,0.4)' : 'none';
            card.style.transform = focused ? 'scale(1.05)' : 'scale(1)';
            card.style.outline = focused ? '2px solid rgba(255,255,255,0.8)' : 'none';
          }
          const title = el.querySelector('[data-title]') as HTMLElement | null;
          if (title) title.style.color = focused ? 'rgba(255,255,255,0.9)' : '';
        },
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    this._registrar.register(items);
  }

  private unregisterFocusables() {
    this._registrar.unregisterAll();
  }

  private updateExpanded() {
    const row = this.querySelector('[data-ep-rail]') as HTMLElement;
    if (row) {
      row.style.marginTop = this._expanded
        ? 'clamp(0.5rem, 1.8vh, 1rem)'
        : 'clamp(1rem, 3.5vh, 2rem)';
    }
    const cw = this._expanded ? 'clamp(180px, 13.5vw, 260px)' : 'clamp(156px, 11.5vw, 220px)';
    const ch = this._expanded ? 'clamp(101px, 7.6vw, 146px)' : 'clamp(88px, 6.5vw, 124px)';
    this.querySelectorAll<HTMLElement>('[data-ep-card]').forEach((card) => {
      card.style.width = cw;
      card.style.height = ch;
    });
    this.querySelectorAll<HTMLElement>('[data-ep-item]').forEach((item) => {
      (item.style as any).width = cw;
    });
  }

  private updateActive() {
    this.querySelectorAll<HTMLElement>('[data-ep-item]').forEach((el, index) => {
      const isActive = index === this._currentIndex;
      const indicator = el.querySelector('[data-active-indicator]') as HTMLElement;
      const title = el.querySelector('[data-title]') as HTMLElement;
      const status = el.querySelector('[data-status-text]') as HTMLElement;
      if (indicator) indicator.style.display = isActive ? 'flex' : 'none';
      if (title) title.style.color = isActive ? '#fff' : '';
      if (status) status.style.display = isActive ? 'block' : 'none';
    });
  }
}

customElements.define('tv-player-episodes-rail', EpisodesRailElement);
