import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core';
import { FocusableRegistrar } from './spatialFocus';
import { trackImpression, trackEvent, trackError, selectMediaFile, trackClick } from '@/services/player/vast-client';
import { pdbg } from '@/services/player/playerDebug';
import { generateQrDataModel, type QrDataModel } from '@/utils/qr';
import { ctvIconSheet } from '@/lib/ctvIcons';
import type { VastAd } from '@/types/vast';

const FOCUS_KEY_ROOT = 'ad-overlay';
const PARENT_FOCUS_KEY = 'watch-root';

@customElement('tv-ad-overlay')
export class AdOverlayElement extends LitElement {
  static styles = css`
    :host {
  --gutter: clamp(32px, 3.5vw, 64px);
  --gap: clamp(20px, 2.8vw, 56px);
  --panel-w: clamp(300px, 23vw, 420px);
  /* ancho seguro = viewport - panel - 2 gutters - gap */
  --video-safe-w: calc(100vw - var(--panel-w) - (var(--gutter) * 2) - var(--gap));
  
  position: fixed;
  inset: 0;
  z-index: 50;
  background: #000000;
  display: block;
  overflow: hidden;
  contain: layout style;
  user-select: none;
}

/* ── Video Stage ── */
.video-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 550ms cubic-bezier(0.16, 1, 0.3, 1),
              height 550ms cubic-bezier(0.16, 1, 0.3, 1),
              left 550ms cubic-bezier(0.16, 1, 0.3, 1),
              top 550ms cubic-bezier(0.16, 1, 0.3, 1),
              transform 550ms cubic-bezier(0.16, 1, 0.3, 1),
              border-radius 550ms cubic-bezier(0.16, 1, 0.3, 1);
  transform: translateZ(0);
  will-change: width, height, transform;
}

.video-stage.shrunk {
  /* CLAVE: el video nunca invade el espacio del panel */
  width: clamp(560px, var(--video-safe-w), 66vw);
  height: auto;
  aspect-ratio: 16 / 9;
  max-height: clamp(360px, 78vh, 820px);
  left: var(--gutter);
  top: 50%;
  transform: translateY(-50%) translateZ(0);
  border-radius: clamp(12px, 1.2vw, 20px);
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 24px 64px rgba(0,0,0,0.95);
}

.video-stage video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

/* ── Ambient ── */
.shrunk-ambient-bg {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 50%, rgba(25,25,30,0.9) 0%, #000 75%);
  opacity: 0;
  pointer-events: none;
  transition: opacity 500ms ease;
}
.shrunk-ambient-bg.visible { opacity: 1; }

/* ── Scrim ── */
.wR7gVc { background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 33.36%, #000 100%); }
.gkU4db { height: clamp(120px, 14vh, 160px); }
.o5D4td {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 0 var(--gutter) clamp(20px, 3vh, 36px);
  z-index: 5;
  transition: opacity 400ms ease;
}
.o5D4td.hidden { opacity: 0; pointer-events: none; }

/* ── Progress ── */
.ad-progress-track {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: clamp(3px, 0.35vw, 4px);
  background: rgba(255,255,255,0.2);
  z-index: 10;
}
.ad-progress-fill { height: 100%; background: #fabb05; width: 0%; transition: width 200ms linear; }

/* ── Lockup ── */
.ytlr-ad-avatar-lockup { display: flex; align-items: center; gap: clamp(12px, 1vw, 16px); max-width: 55vw; }
.ad-avatar {
  width: clamp(36px, 2.8vw, 44px); height: clamp(36px, 2.8vw, 44px);
  border-radius: 50%; background-size: cover; background-position: center;
  background-color: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.2);
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: clamp(14px, 1.1vw, 18px); font-weight: 700;
}
.ad-info-texts { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ad-domain { color: #fff; font-size: clamp(14px, 1vw, 16px); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ad-meta-row { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.7); font-size: clamp(11px, 0.85vw, 13px); }
.yt-badge { background: rgba(255,255,255,0.2); color: #fff; border-radius: 4px; padding: 2px 6px; font-size: clamp(10px, 0.75vw, 12px); font-weight: 600; }

/* ── Actions ── */
.ytlr-actions-row { display: flex; align-items: center; gap: clamp(10px, 0.8vw, 12px); }
.circle-btn {
  width: clamp(40px, 3.2vw, 48px); height: clamp(40px, 3.2vw, 48px);
  border-radius: 50%; background: rgba(20,20,20,0.85);
  border: 1px solid rgba(255,255,255,0.15); color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  transition: transform 150ms ease, background-color 150ms ease;
}
.circle-btn[data-focused="true"] { background: #f1f1f1 !important; color: #0f0f0f !important; transform: scale(1.08); outline: 3px solid #fff; }
.ytlr-skip-ad-timer { padding: clamp(8px, 0.7vw, 10px) clamp(16px, 1.2vw, 20px); border-radius: 9999px; background: rgba(0,0,0,0.8); border: 1px solid rgba(255,255,255,0.18); color: #fff; font-size: clamp(13px, 0.9vw, 15px); font-weight: 500; font-variant-numeric: tabular-nums; }
.ytlr-skip-button { padding: clamp(8px, 0.7vw, 10px) clamp(18px, 1.5vw, 24px); border-radius: 9999px; background: rgba(255,255,255,0.18); color: #fff; border: none; font-size: clamp(13px, 0.9vw, 15px); font-weight: 600; display: inline-flex; align-items: center; gap: 8px; }
.ytlr-skip-button[data-focused="true"] { background: #f1f1f1 !important; color: #0f0f0f !important; transform: scale(1.04); outline: 3px solid #fff; }
.skip-icon { width: clamp(16px, 1.2vw, 18px); height: clamp(16px, 1.2vw, 18px); }

/* ── PANEL LATERAL - FIX ANTI-SOLAPAMIENTO ── */
.companion-side-panel {
  position: absolute;
  right: var(--gutter);
  top: 50%;
  transform: translateY(-50%) translateX(32px);
  width: var(--panel-w);
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 1.5vh, 20px);
  opacity: 0;
  pointer-events: none;
  z-index: 10;
  max-height: calc(100vh - var(--gutter) * 2);
  transition: opacity 450ms cubic-bezier(0.16, 1, 0.3, 1), transform 450ms cubic-bezier(0.16, 1, 0.3, 1);
}
.companion-side-panel.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(-50%) translateX(0);
}

.qr-card-container {
  background: #fff; border-radius: clamp(12px, 1vw, 16px);
  padding: clamp(12px, 1vw, 16px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.85);
  display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%;
}
.qr-svg-wrapper { display: flex; align-items: center; justify-content: center; width: 100%; }
.qr-svg-wrapper svg { width: clamp(120px, 11vw, 160px) !important; height: clamp(120px, 11vw, 160px) !important; }
.qr-hint-row { display: flex; align-items: center; gap: 8px; color: #202020; font-size: clamp(11px, 0.8vw, 13px); font-weight: 600; text-align: center; }

.ad-spinner { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 20; pointer-events: none; }
.ad-spinner-dot { width: clamp(32px, 2.8vw, 44px); height: clamp(32px, 2.8vw, 44px); border: 3px solid rgba(255,255,255,0.25); border-top-color: #fabb05; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 1280x720 - asegurar respiración */
@media (max-width: 1366px) {
  :host { --panel-w: clamp(280px, 25vw, 340px); --gap: 24px; }
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

  @property({ type: Object, attribute: false })
  set ad(value: VastAd | null) {
    const prev = this._ad;
    this._ad = value;
    pdbg('ad-overlay.set-ad', value ? 'ad assigned' : 'ad cleared');
    if (value && value !== prev) {
      this._canSkip = false;
      this._shrunk = false;
      this._quartiles = { q1: false, q2: false, q3: false };
      this._isMuted = false;
      this._currentTime = 0;
      this._duration = value.duration || 0;
      this._skipOffset = value.skipOffset > 0 ? value.skipOffset : (this._skipOffsetAttr || 5);
      this._qrData = value.clickThroughUrl ? generateQrDataModel(value.clickThroughUrl) : null;
      requestAnimationFrame(() => this.startPlayback());
    } else if (!value) {
      this.teardown();
    }
  }
  get ad(): VastAd | null {
    return this._ad;
  }

  @property({ type: Number, attribute: 'skip-offset' })
  skipOffsetAttr = 5;

  @state() private _ad: VastAd | null = null;
  @state() private _skipOffset = 5;
  @state() private _skipOffsetAttr = 5;
  @state() private _canSkip = false;
  @state() private _shrunk = false;
  @state() private _isMuted = false;
  @state() private _buffering = false;
  @state() private _currentTime = 0;
  @state() private _duration = 0;
  @state() private _qrData: QrDataModel | null = null;

  private _videoEl: HTMLVideoElement | null = null;
  private _progressFillEl: HTMLDivElement | null = null;
  private _registrar = new FocusableRegistrar();
  private _keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private _quartiles = { q1: false, q2: false, q3: false };
  private _rafId: number | null = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.teardown();
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('skipOffsetAttr')) {
      this._skipOffsetAttr = this.skipOffsetAttr;
      if (this._ad && this._ad.skipOffset <= 0) {
        this._skipOffset = this.skipOffsetAttr;
      }
    }
    if (changedProperties.has('_shrunk') || changedProperties.has('_ad')) {
      if (this._ad) {
        this._syncFocusables();
      }
    }
  }

  private teardown() {
    if (this._videoEl) {
      this._videoEl.pause();
      this._videoEl.removeAttribute('src');
      this._videoEl.load();
      this._videoEl = null;
    }
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._registrar.unregisterAll();
    try {
      SpatialNavigation.removeFocusable({ focusKey: FOCUS_KEY_ROOT });
    } catch {
      // noop
    }
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler, true);
      this._keyHandler = null;
    }
  }

  private startPlayback() {
    const video = this.renderRoot.querySelector('video') as HTMLVideoElement | null;
    this._videoEl = video;
    if (!video || !this._ad) return;

    const mediaFile = selectMediaFile(this._ad);
    if (!mediaFile) {
      trackError(this._ad);
      this.finishAd();
      return;
    }

    pdbg('ad-overlay.startPlayback', { url: mediaFile.url, type: mediaFile.type, dur: this._ad.duration });
    video.src = mediaFile.url;
    video.load();

    video.onplay = () => this.onAdPlay();
    video.onwaiting = () => { this._buffering = true; };
    video.onplaying = () => { this._buffering = false; };
    video.onended = () => this.finishAd();
    video.onerror = () => this.onAdError();
    video.ontimeupdate = () => this.onTimeUpdate();

    video.play().then(() => {
      pdbg('ad-overlay.play', 'ok');
    }).catch((e: any) => {
      pdbg('ad-overlay.play', 'rejected', e?.message);
      this._buffering = false;
    });

    this._syncFocusables();
    this.installKeyHandler();
  }

  private onAdPlay() {
    this._buffering = false;
    if (this._ad) {
      trackImpression(this._ad);
      trackEvent(this._ad, 'start');
      trackEvent(this._ad, 'creativeView');
    }
  }

  private onTimeUpdate() {
    const video = this._videoEl;
    if (!video) return;

    const ct = video.currentTime;
    const dur = video.duration || this._duration || 0;
    this._currentTime = ct;
    if (dur > 0 && dur !== this._duration) this._duration = dur;

    // Actualizar barra amarilla directamente vía ref para 60fps sin re-render
    if (this._progressFillEl && dur > 0) {
      this._progressFillEl.style.width = `${Math.min(100, (ct / dur) * 100)}%`;
    }

    // Verificar si se alcanzó el Skip Offset
    if (!this._canSkip && ct >= this._skipOffset) {
      this._canSkip = true;
      this._shrunk = true; // Activar transformación PiP + panel lateral
      if (this._ad) trackEvent(this._ad, 'acceptInvitation');
    }

    // Seguimiento de cuartiles
    if (dur > 0 && this._ad) {
      if (!this._quartiles.q1 && ct >= dur * 0.25) {
        this._quartiles.q1 = true;
        trackEvent(this._ad, 'firstQuartile');
      }
      if (!this._quartiles.q2 && ct >= dur * 0.5) {
        this._quartiles.q2 = true;
        trackEvent(this._ad, 'midpoint');
      }
      if (!this._quartiles.q3 && ct >= dur * 0.75) {
        this._quartiles.q3 = true;
        trackEvent(this._ad, 'thirdQuartile');
      }
    }
  }

  private handleSkip = () => {
    if (!this._canSkip || !this._ad) return;
    trackEvent(this._ad, 'skip');
    this.finishAd();
  };

  private handleMute = () => {
    if (!this._videoEl) return;
    this._videoEl.muted = !this._videoEl.muted;
    this._isMuted = this._videoEl.muted;
    if (this._ad) {
      trackEvent(this._ad, this._isMuted ? 'mute' : 'unmute');
    }
    this.requestUpdate();
  };

  private finishAd() {
    pdbg('ad-overlay.finishAd', 'dispatching ad-complete');
    if (this._ad) trackEvent(this._ad, 'complete');
    this.teardown();
    this.dispatchEvent(new CustomEvent('ad-complete', { bubbles: true, composed: true }));
  }

  private onAdError() {
    const code = this._videoEl?.error?.code ?? 'unknown';
    pdbg('ad-overlay.error', `media error code=${code}`);
    if (this._ad) trackError(this._ad, String(code));
    this.finishAd();
  }

  private installKeyHandler() {
    this._keyHandler = (e: KeyboardEvent) => {
      if (!this._ad) return;
      if (e.key === 'm' || e.key === 'M') {
        this.handleMute();
      }
    };
    window.addEventListener('keydown', this._keyHandler, true);
  }

  private _syncFocusables() {
    // 1. Asegurar contenedor raíz registrado como boundary en SpatialNavigation
    try {
      SpatialNavigation.addFocusable({
        focusKey: FOCUS_KEY_ROOT,
        parentFocusKey: PARENT_FOCUS_KEY,
        isFocusBoundary: true,
        trackChildren: true,
        autoRestoreFocus: true,
      });
    } catch {
      // Si ya está registrado
    }

    // 2. Limpiar focusables previos
    this._registrar.unregisterAll();

    // 3. Registrar focusables activos según si está encogido o en fullscreen
    if (!this._shrunk) {
      const muteBtn = this.renderRoot.querySelector('[data-ad-mute-fs]') as HTMLElement | null;
      if (muteBtn) {
        this._registrar.register([{
          focusKey: `${FOCUS_KEY_ROOT}-mute`,
          node: muteBtn,
          parentFocusKey: FOCUS_KEY_ROOT,
          onEnterPress: () => this.handleMute(),
          onArrowPress: () => false, // No permitir escape a elementos del player de fondo
          onFocus: () => muteBtn.setAttribute('data-focused', 'true'),
          onBlur: () => muteBtn.setAttribute('data-focused', 'false'),
        }]);

        requestAnimationFrame(() => {
          SpatialNavigation.setFocus(`${FOCUS_KEY_ROOT}-mute`);
        });
      }
    } else {
      const skipBtn = this.renderRoot.querySelector('[data-ad-skip]') as HTMLElement | null;
      const muteBtn = this.renderRoot.querySelector('[data-ad-mute-side]') as HTMLElement | null;

      const items = [];
      if (skipBtn) {
        items.push({
          focusKey: `${FOCUS_KEY_ROOT}-skip`,
          node: skipBtn,
          parentFocusKey: FOCUS_KEY_ROOT,
          onEnterPress: () => this.handleSkip(),
          onArrowPress: (direction: string) => {
            // Navegar de Saltar hacia el botón de Silencio
            if (direction === 'down' || direction === 'right') {
              SpatialNavigation.setFocus(`${FOCUS_KEY_ROOT}-mute`);
              return false;
            }
            return false;
          },
          onFocus: () => skipBtn.setAttribute('data-focused', 'true'),
          onBlur: () => skipBtn.setAttribute('data-focused', 'false'),
        });
      }

      if (muteBtn) {
        items.push({
          focusKey: `${FOCUS_KEY_ROOT}-mute`,
          node: muteBtn,
          parentFocusKey: FOCUS_KEY_ROOT,
          onEnterPress: () => this.handleMute(),
          onArrowPress: (direction: string) => {
            // Navegar de Silencio hacia el botón de Saltar
            if (direction === 'up' || direction === 'left') {
              SpatialNavigation.setFocus(`${FOCUS_KEY_ROOT}-skip`);
              return false;
            }
            return false;
          },
          onFocus: () => muteBtn.setAttribute('data-focused', 'true'),
          onBlur: () => muteBtn.setAttribute('data-focused', 'false'),
        });
      }

      this._registrar.register(items);

      requestAnimationFrame(() => {
        SpatialNavigation.setFocus(`${FOCUS_KEY_ROOT}-skip`);
      });
    }
  }

  private getDomain(url?: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.split('/')[0] || '';
    }
  }

  render() {
    if (!this._ad) return html``;

    const remainingToSkip = Math.max(0, Math.ceil(this._skipOffset - this._currentTime));
    const domain = this.getDomain(this._ad.clickThroughUrl) || this._ad.advertiser || 'Anuncio';
    const title = this._ad.title || this._ad.description || 'Más información';
    const avatarLetter = (domain[0] || 'A').toUpperCase();

    return html`
      <!-- Ambient Backdrop cuando el video está encogido (sin blur) -->
      <div class="shrunk-ambient-bg ${this._shrunk ? 'visible' : ''}"></div>

      <!-- Video Principal (Pantalla completa o PiP encogido 16:9) -->
      <div class="video-stage ${this._shrunk ? 'shrunk' : ''}">
        <video playsinline autoplay disableRemotePlayback></video>
      </div>

      <!-- Spinner de Buffering -->
      ${this._buffering ? html`
        <div class="ad-spinner">
          <div class="ad-spinner-dot"></div>
        </div>
      ` : ''}

      <!-- Scrim Inferior Original YouTube TV (Visible solo en Fullscreen) -->
      <div class="wR7gVc gkU4db o5D4td ${this._shrunk ? 'hidden' : ''}">
        <!-- Lockup del Anunciante -->
        <div class="ytlr-ad-avatar-lockup">
          <div
            class="ad-avatar ${this._ad.iconUrl ? '' : 'default-icon'}"
            style="${this._ad.iconUrl ? `background-image: url('${this._ad.iconUrl}');` : ''}"
          >
            ${!this._ad.iconUrl ? avatarLetter : ''}
          </div>
          <div class="ad-info-texts">
            <div class="ad-domain">${domain}</div>
            <div class="ad-meta-row">
              <span class="yt-badge">Patrocinado</span>
              <span class="dot-separator">•</span>
              <span class="ad-title">${title}</span>
            </div>
          </div>
        </div>

        <!-- Acciones Inferiores (Mute + Countdown) -->
        <div class="ytlr-actions-row">
          <button
            class="circle-btn"
            data-ad-mute-fs
            @click=${this.handleMute}
            aria-label="${this._isMuted ? 'Desactivar silencio' : 'Silenciar'}"
          >
            ${this._isMuted ? html`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            ` : html`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            `}
          </button>

          <div class="ytlr-skip-ad-timer">
            <span>Saltar en ${remainingToSkip}s</span>
          </div>
        </div>
      </div>

      <!-- Panel Lateral Acompañante con Código QR (Desplegado a partir de Skip Offset) -->
      <div class="companion-side-panel ${this._shrunk ? 'visible' : ''}">
        <!-- Lockup Anunciante -->
        <div class="ytlr-ad-avatar-lockup">
          <div
            class="ad-avatar ${this._ad.iconUrl ? '' : 'default-icon'}"
            style="${this._ad.iconUrl ? `background-image: url('${this._ad.iconUrl}');` : ''}"
          >
            ${!this._ad.iconUrl ? avatarLetter : ''}
          </div>
          <div class="ad-info-texts">
            <div class="ad-domain">${domain}</div>
            <div class="ad-meta-row">
              <span class="yt-badge">Patrocinado</span>
              <span class="dot-separator">•</span>
              <span class="ad-title">${title}</span>
            </div>
          </div>
        </div>

        <!-- Tarjeta QR Blanca para Móvil (si hay clickThroughUrl) -->
        ${this._qrData ? html`
          <div class="qr-card-container" @click=${() => { if (this._ad) trackClick(this._ad); }}>
            <div class="qr-svg-wrapper">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 ${this._qrData.totalModules} ${this._qrData.totalModules}"
                width="160"
                height="160"
                shape-rendering="crispEdges"
              >
                <rect width="100%" height="100%" fill="#ffffff" />
                <path d="${this._qrData.path}" fill="#000000" />
              </svg>
            </div>
            <div class="qr-hint-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              <span>Escaneá con tu celular para abrir</span>
            </div>
          </div>
        ` : ''}

        <!-- Botonera de Acción Lateral (Saltar + Mute) -->
        <div class="ytlr-actions-row">
          <button
            class="ytlr-skip-button"
            data-ad-skip
            @click=${this.handleSkip}
          >
            <span>Saltar</span>
            <svg class="skip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <line x1="19" y1="5" x2="19" y2="19"></line>
            </svg>
          </button>

          <button
            class="circle-btn"
            data-ad-mute-side
            @click=${this.handleMute}
            aria-label="${this._isMuted ? 'Desactivar silencio' : 'Silenciar'}"
          >
            ${this._isMuted ? html`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            ` : html`
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
              </svg>
            `}
          </button>
        </div>
      </div>

      <!-- Barra de Progreso Amarilla en la Base -->
      <div class="ad-progress-track">
        <div
          class="ad-progress-fill"
          ${(el: Element | null) => { this._progressFillEl = el as HTMLDivElement | null; }}
        ></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tv-ad-overlay': AdOverlayElement;
  }
}