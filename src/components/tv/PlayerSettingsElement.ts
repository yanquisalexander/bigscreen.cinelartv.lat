import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation';
import { FocusableRegistrar } from './spatialFocus';

interface QualityInfo {
  auto: boolean;
  activeHeight: number | null;
  tracks: { height: number; bandwidth: number; active: boolean }[];
}

interface AudioInfo {
  language: string;
  role: string;
  label: string;
  active: boolean;
}

interface EngineLike {
  getVariantTracksInfo(): QualityInfo | null;
  getAudioTracksInfo(): AudioInfo[] | null;
  selectQuality(option: number | 'auto'): void;
  selectAudioTrack(language: string, role?: string): void;
}

const PARENT_FOCUS_KEY = 'player-settings';

class PlayerSettingsElement extends HTMLElement {
  private shadow: ShadowRoot;
  private _engine: EngineLike | null = null;
  private _open = false;
  private _registrar = new FocusableRegistrar();
  private _quality: QualityInfo | null = null;
  private _audio: AudioInfo[] | null = null;

  static get observedAttributes() {
    return ['open'];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  set engine(value: EngineLike | null) {
    this._engine = value;
    if (this._open) this.refresh();
  }

  get engine() {
    return this._engine;
  }

  set open(value: boolean) {
    this._open = value;
    this.setAttribute('open', value ? 'true' : 'false');
    if (value) {
      requestAnimationFrame(() => this.refresh());
    } else {
      this.teardown();
    }
  }

  get open() {
    return this._open;
  }

  attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
    if (name === 'open') {
      const shouldOpen = newValue === 'true';
      if (shouldOpen !== this._open) {
        this.open = shouldOpen;
      }
    }
  }

  connectedCallback() {
    this._renderBase();
    if (this._open) {
      requestAnimationFrame(() => this.refresh());
    }
  }

  disconnectedCallback() {
    this.teardown();
  }

  private _renderBase() {
    this.shadow.innerHTML = `
      <style>
        :host {
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 40;
        }

        :host([open="true"]) {
          pointer-events: auto;
        }

        .settings-panel {
          position: absolute;
          top: clamp(4.5rem, 9vh, 6rem);
          right: clamp(2rem, 4vw, 3rem);
          width: clamp(240px, 22vw, 320px);
          max-height: clamp(520px, 70vh, 720px);
          overflow-y: auto;
          background: rgba(20, 20, 20, 0.95);
          border-radius: 0;
          padding: clamp(0.75rem, 1.5vh, 1rem);
          z-index: 1;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
        }

        .settings-section-title {
          font-size: clamp(0.65rem, 0.85vw, 0.75rem);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.4);
          padding: clamp(0.5rem, 1vh, 0.75rem) clamp(0.75rem, 1.5vw, 1rem);
          margin-bottom: clamp(0.25rem, 0.5vh, 0.5rem);
        }

        .settings-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: clamp(0.5rem, 1vh, 0.75rem) clamp(0.25rem, 0.5vw, 0.5rem);
        }

        .settings-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(0.5rem, 1vh, 0.75rem) clamp(0.75rem, 1.5vw, 1rem);
          margin: clamp(0.125rem, 0.25vh, 0.25rem) clamp(0.25rem, 0.5vw, 0.5rem);
          border-radius: clamp(0.375rem, 0.7vw, 0.5rem);
          font-size: clamp(0.8rem, 1vw, 0.875rem);
          color: #ffffff;
          cursor: pointer;
          outline: none;
          transition: background 120ms ease;
          position: relative;
        }

        .settings-item[data-focused="true"] {
          background: rgba(255, 255, 255, 0.12);
          font-weight: 600;
        }

        .settings-item-label {
          display: flex;
          align-items: center;
          gap: clamp(0.5rem, 1vw, 0.75rem);
        }

        .settings-item-icon {
          font-size: clamp(1rem, 1.3vw, 1.125rem);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .settings-check {
          font-size: clamp(0.65rem, 0.8vw, 0.7rem);
          opacity: 0.7;
        }

        .settings-empty {
          padding: clamp(0.75rem, 1.5vh, 1rem) clamp(0.75rem, 1.5vw, 1rem);
          color: rgba(255, 255, 255, 0.5);
          font-size: clamp(0.8rem, 1vw, 0.875rem);
        }
      </style>
      <div class="settings-panel" data-settings-panel>
        <div data-settings-content></div>
      </div>
    `;
  }

  private refresh(focusKey?: string) {
    if (!this._engine) return;
    this._quality = this._engine.getVariantTracksInfo();
    this._audio = this._engine.getAudioTracksInfo();
    this._renderContent();
    this.registerFocusables();

    const firstKey = focusKey
      || (this._quality
        ? 'player-settings-quality-auto'
        : this._audio && this._audio.length
          ? `player-settings-audio-${this._sanitize(this._audio[0].language)}-${this._sanitize(this._audio[0].role)}`
          : null);
    if (firstKey) {
      requestAnimationFrame(() => SpatialNavigation.setFocus(firstKey));
    }
  }

  private teardown() {
    this.unregisterFocusables();
  }

  private _sanitize(s: string): string {
    return (s || 'und').replace(/[^a-z0-9]/gi, '');
  }

  private _renderContent() {
    const contentEl = this.shadow.querySelector('[data-settings-content]')!;

    const qualityRows = this._quality
      ? [
          this._settingsRow('Auto', 'player-settings-quality-auto', this._quality.auto, 'AUTO'),
          ...this._quality.tracks.map((t) =>
            this._settingsRow(`${t.height}p`, `player-settings-quality-${t.height}`, this._quality!.activeHeight === t.height && !this._quality!.auto, 'QUALITY'),
          ),
        ].join('')
      : '<div class="settings-empty">Sin opciones de calidad</div>';

    const audioRows = this._audio && this._audio.length
      ? this._audio
          .map((a) =>
            this._settingsRow(a.label, `player-settings-audio-${this._sanitize(a.language)}-${this._sanitize(a.role)}`, a.active, 'AUDIO'),
          )
          .join('')
      : '<div class="settings-empty">Sin pistas de audio</div>';

    contentEl.innerHTML = `
      <div class="settings-section-title">Calidad</div>
      ${qualityRows}
      <div class="settings-divider"></div>
      <div class="settings-section-title">Audio</div>
      ${audioRows}
    `;
  }

  private _settingsRow(label: string, key: string, active: boolean, icon: string): string {
    return `
      <div data-set-key="${key}" data-focused="false" class="settings-item">
        <div class="settings-item-label">
          <span class="settings-item-icon">${icon === 'AUTO' ? '🔄' : icon === 'QUALITY' ? '📺' : '🔊'}</span>
          <span>${label}</span>
        </div>
        ${active ? '<span class="settings-check">✓</span>' : ''}
      </div>
    `;
  }

  private registerFocusables() {
    const items = this.collectItems().map((item) => {
      const el = this.shadow.querySelector(`[data-set-key="${item.key}"]`) as HTMLElement | null;
      if (!el) return null;
      return {
        focusKey: item.key,
        node: el,
        parentFocusKey: PARENT_FOCUS_KEY,
        onEnterPress: () => item.activate(),
        onArrowPress: () => true,
        onFocus: () => {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },
        onUpdateFocus: (focused: boolean) => {
          el.setAttribute('data-focused', focused ? 'true' : 'false');
        },
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    this._registrar.register(items);
  }

  private unregisterFocusables() {
    this._registrar.unregisterAll();
  }

  private collectItems(): { key: string; activate: () => void }[] {
    const items: { key: string; activate: () => void }[] = [];
    if (this._quality) {
      items.push({
        key: 'player-settings-quality-auto',
        activate: () => {
          this._engine?.selectQuality('auto');
          this.refresh('player-settings-quality-auto');
          this.dispatchEvent(
            new CustomEvent('quality-change', { detail: { option: 'auto' }, bubbles: true, composed: true }),
          );
        },
      });
      this._quality.tracks.forEach((t) => {
        const key = `player-settings-quality-${t.height}`;
        items.push({
          key,
          activate: () => {
            this._engine?.selectQuality(t.height);
            this.refresh(key);
            this.dispatchEvent(
              new CustomEvent('quality-change', { detail: { option: t.height }, bubbles: true, composed: true }),
            );
          },
        });
      });
    }
    if (this._audio) {
      this._audio.forEach((a) => {
        const key = `player-settings-audio-${this._sanitize(a.language)}-${this._sanitize(a.role)}`;
        items.push({
          key,
          activate: () => {
            this._engine?.selectAudioTrack(a.language, a.role || undefined);
            this.refresh(key);
            this.dispatchEvent(
              new CustomEvent('audio-change', { detail: { language: a.language, role: a.role }, bubbles: true, composed: true }),
            );
          },
        });
      });
    }
    return items;
  }
}

customElements.define('tv-player-settings', PlayerSettingsElement);

export { PlayerSettingsElement };
