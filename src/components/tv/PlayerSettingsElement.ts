import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation';

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
  private _engine: EngineLike | null = null;
  private _open = false;
  private _registeredKeys: string[] = [];
  private _quality: QualityInfo | null = null;
  private _audio: AudioInfo[] | null = null;

  static get observedAttributes() {
    return ['open'];
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
    this.render();
    if (value) {
      // refresh() necesita que el DOM esté renderizado para encontrar los nodos
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
      const shouldOpen = newValue != null && newValue !== 'false';
      if (shouldOpen !== this._open) {
        this.open = shouldOpen;
      }
    }
  }

  connectedCallback() {
    this.render();
    if (this._open) {
      requestAnimationFrame(() => this.refresh());
    }
  }

  disconnectedCallback() {
    this.teardown();
  }

  /** Lee las pistas del engine y registra los items en norigin. */
  private refresh(focusKey?: string) {
    if (!this._engine) return;
    this._quality = this._engine.getVariantTracksInfo();
    this._audio = this._engine.getAudioTracksInfo();
    this.render();
    this.registerFocusables();
    // Enfocar el item indicado (o el primero) para no perder el foco remoto.
    const firstKey = focusKey
      || (this._quality
        ? `player-settings-quality-auto`
        : this._audio && this._audio.length
          ? `player-settings-audio-${this.sanitize(this._audio[0].language)}-${this.sanitize(this._audio[0].role)}`
          : null);
    if (firstKey) {
      // rAF para asegurar que los nodos ya están registrados en norigin.
      requestAnimationFrame(() => SpatialNavigation.setFocus(firstKey));
    }
  }

  private teardown() {
    this.unregisterFocusables();
  }

  private sanitize(s: string): string {
    return (s || 'und').replace(/[^a-z0-9]/gi, '');
  }

  private registerFocusables() {
    this.unregisterFocusables();
    const items = this.collectItems();
    items.forEach((item) => {
      const el = this.querySelector(`[data-set-key="${item.key}"]`) as HTMLElement | null;
      if (!el) return;
      this._registeredKeys.push(item.key);
      SpatialNavigation.addFocusable({
        focusKey: item.key,
        node: el,
        parentFocusKey: PARENT_FOCUS_KEY,
        focusable: true,
        trackChildren: false,
        saveLastFocusedChild: false,
        isFocusBoundary: false,
        autoRestoreFocus: true,
        forceFocus: false,
        onEnterPress: () => item.activate(),
        onEnterRelease: () => {},
        onArrowPress: () => true,
        onArrowRelease: () => {},
        onFocus: () => {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },
        onBlur: () => {},
        onUpdateFocus: (focused: boolean) => {
          el.style.background = focused ? 'rgba(255,255,255,0.12)' : 'transparent';
          el.style.fontWeight = focused ? '600' : '400';
        },
        onUpdateHasFocusedChild: () => {},
      });
    });
  }

  private unregisterFocusables() {
    this._registeredKeys.forEach((key) => SpatialNavigation.removeFocusable({ focusKey: key }));
    this._registeredKeys = [];
  }

  private collectItems(): {
    key: string;
    activate: () => void;
  }[] {
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
        const key = `player-settings-audio-${this.sanitize(a.language)}-${this.sanitize(a.role)}`;
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

  private render() {
    if (!this._open) {
      this.innerHTML = '';
      return;
    }
    const qualityRows = this._quality
      ? [
          this.qualityRow('Auto', 'player-settings-quality-auto', this._quality.auto),
          ...this._quality.tracks.map((t) =>
            this.qualityRow(`${t.height}p`, `player-settings-quality-${t.height}`, this._quality!.activeHeight === t.height && !this._quality!.auto),
          ),
        ].join('')
      : '<div style="padding:10px 14px;color:rgba(255,255,255,0.5);font-size:0.8rem;">Sin opciones de calidad</div>';

    const audioRows = this._audio && this._audio.length
      ? this._audio
          .map((a) =>
            this.audioRow(a.label, `player-settings-audio-${this.sanitize(a.language)}-${this.sanitize(a.role)}`, a.active),
          )
          .join('')
      : '<div style="padding:10px 14px;color:rgba(255,255,255,0.5);font-size:0.8rem;">Sin pistas de audio</div>';

    this.innerHTML = `
      <div style="
        position: absolute;
        top: clamp(4.5rem, 9vh, 6rem);
        right: clamp(2rem, 4vw, 3rem);
        width: clamp(220px, 22vw, 300px);
        height: clamp(260px, 40vh, 380px);
        overflow-y: auto;
        background: rgba(20,20,20,0.95);
        border: 0;
        border-radius: 0;
        padding: 10px;
        z-index: 40;
        pointer-events: auto;
      ">
        <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.4);padding:6px 10px 4px;">Calidad</div>
        ${qualityRows}
        <div style="height:1px;background:rgba(255,255,255,0.08);margin:8px 4px;"></div>
        <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.4);padding:6px 10px 4px;">Audio</div>
        ${audioRows}
      </div>
      <style>
        [data-set-key] { cursor: pointer; outline: none; }
      </style>
    `;
  }

  private qualityRow(label: string, key: string, active: boolean): string {
    return `
      <div data-set-key="${key}" tabindex="0" style="
        display:flex;align-items:center;justify-content:space-between;
        padding:8px 12px;border-radius:8px;color:#fff;font-size:0.85rem;
        transition: background 120ms ease;
      ">
        <span>${label}</span>
        ${active ? '<span style="font-size:0.7rem;opacity:0.7;">✓</span>' : ''}
      </div>`;
  }

  private audioRow(label: string, key: string, active: boolean): string {
    return `
      <div data-set-key="${key}" tabindex="0" style="
        display:flex;align-items:center;justify-content:space-between;
        padding:8px 12px;border-radius:8px;color:#fff;font-size:0.85rem;
        transition: background 120ms ease;
      ">
        <span>${label}</span>
        ${active ? '<span style="font-size:0.7rem;opacity:0.7;">✓</span>' : ''}
      </div>`;
  }
}

customElements.define('tv-player-settings', PlayerSettingsElement);
