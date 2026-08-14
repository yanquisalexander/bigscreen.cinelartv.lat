import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core';
import { FocusableRegistrar } from './spatialFocus';

const ICONS: Record<string, string> = {
  home: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  search: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  live: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  settings: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  login: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
};

interface NavItem {
  key: string;
  label: string;
  icon: string;
  path: string;
}

class TVSidebarElement extends HTMLElement {
  static get observedAttributes() {
    return ['expanded'];
  }

  private registrar = new FocusableRegistrar();
  private _expanded = false;
  private _items: NavItem[] = [];
  private _currentPath = '/home';
  private _profile: any = null;
  private _isGuest = false;
  private _clientEndpoint = '';

  set items(value: NavItem[]) {
    this._items = value;
    this._render();
    this._register();
  }

  get items(): NavItem[] {
    return this._items;
  }

  set currentPath(value: string) {
    this._currentPath = value;
    this._updateActiveStates();
  }

  set profile(value: any) {
    this._profile = value;
    this._render();
    this._register();
  }

  set isGuest(value: boolean) {
    this._isGuest = value;
    this._render();
    this._register();
  }

  set clientEndpoint(value: string) {
    this._clientEndpoint = value;
    this._render();
    this._register();
  }

  attributeChangedCallback(name: string, _old: string | null, newValue: string | null) {
    if (name === 'expanded') {
      this._expanded = newValue === 'true';
      this._updateExpanded();
    }
  }

  connectedCallback() {
    this._render();
    this._register();
    this._setupFocusListener();
  }

  disconnectedCallback() {
    this.registrar.unregisterAll();
  }

  private _render() {
    const navItems = this._items
      .map((item) => {
        const itemKey = item.key.startsWith('nav-') ? item.key : `nav-${item.key}`;
        const isActive = this._currentPath.startsWith(item.path);
        const iconHtml = ICONS[item.key] ?? ICONS.settings;
        return `
          <div data-nav-item="${itemKey}" data-path="${item.path}"
            style="
              display: flex;
              align-items: center;
              gap: clamp(0.75rem, 1.2vw, 1rem);
              padding: 0 clamp(0.75rem, 1.2vw, 1rem);
              height: clamp(2.5rem, 4vh, 3rem);
              border-radius: 0.75rem;
              font-size: clamp(0.85rem, 1.1vw, 0.95rem);
              font-weight: 500;
              color: ${isActive ? '#ffffff' : '#8e8e93'};
              background: transparent;
              cursor: pointer;
              outline: none;
            "
          >
            <span data-nav-icon style="display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem;">${iconHtml}</span>
            <span data-nav-label style="white-space: nowrap; opacity: 0;">${item.label}</span>
          </div>
        `;
      })
      .join('');

    const avatarSrc = this._profile
      ? (this._profile.avatar_url ?? `${this._clientEndpoint}/assets/default/avatars/${this._profile.avatar_id ?? 'coolCat'}.png`)
      : '';

    const profileHtml = this._isGuest
      ? `<div data-nav-item="nav-login" data-path="/auth"
          style="
            display: flex;
            align-items: center;
            gap: clamp(0.75rem, 1.2vw, 1rem);
            padding: 0 clamp(0.75rem, 1.2vw, 1rem);
            height: clamp(2.5rem, 4vh, 3rem);
            border-radius: 0.75rem;
            font-size: clamp(0.85rem, 1.1vw, 0.95rem);
            font-weight: 500;
            color: #8e8e93;
            background: transparent;
            cursor: pointer;
            outline: none;
          ">
          <span data-nav-icon style="display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem;">${ICONS.login}</span>
          <span data-nav-label style="white-space: nowrap; opacity: 0;">Iniciar sesión</span>
        </div>`
      : this._profile
        ? `<div data-nav-item="nav-profile" data-path="/select-profile"
            style="
              display: flex;
              align-items: center;
              gap: clamp(0.75rem, 1.2vw, 1rem);
              padding: 0 clamp(0.75rem, 1.2vw, 1rem);
              height: clamp(2.5rem, 4vh, 3rem);
              border-radius: 0.75rem;
              font-size: clamp(0.85rem, 1.1vw, 0.95rem);
              font-weight: 500;
              color: #ffffff;
              background: transparent;
              cursor: pointer;
              outline: none;
            ">
            <img src="${avatarSrc}" alt="${this._profile.name}"
              style="width: 2.25rem; height: 2.25rem; border-radius: 9999px; object-fit: cover; flex-shrink: 0;"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div style="width: 2.25rem; height: 2.25rem; border-radius: 9999px; background: #1c1c1e; display: none; align-items: center; justify-content: center; color: #ffffff; font-weight: 600; font-size: 0.875rem; flex-shrink: 0;">
              ${this._profile.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <span data-nav-label style="white-space: nowrap; opacity: 0;">${this._profile.name}</span>
          </div>`
        : '';

    const settingsHtml = `
      <div data-nav-item="nav-settings" data-path="/settings"
        style="
          display: flex;
          align-items: center;
          gap: clamp(0.75rem, 1.2vw, 1rem);
          padding: 0 clamp(0.75rem, 1.2vw, 1rem);
          height: clamp(2.5rem, 4vh, 3rem);
          border-radius: 0.75rem;
          font-size: clamp(0.85rem, 1.1vw, 0.95rem);
          font-weight: 500;
          color: #8e8e93;
          background: transparent;
          cursor: pointer;
          outline: none;
        ">
        <span data-nav-icon style="display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem;">${ICONS.settings}</span>
        <span data-nav-label style="white-space: nowrap; opacity: 0;">Ajustes</span>
      </div>
    `;

    this.innerHTML = `
      <aside data-tv-sidebar style="
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        padding: 1.5rem 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: linear-gradient(to right, #000000 20%, rgba(0,0,0,0.3), rgba(0,0,0,0));
        z-index: 50;
      ">
        <div style="height: 2rem; margin-bottom: 3rem;"></div>
        <nav data-tv-sidebar-nav style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem; padding: 0 clamp(1rem, 2vw, 1.5rem);">
          ${navItems}
        </nav>
        ${settingsHtml}
        ${profileHtml}
      </aside>
      <style>
        [data-nav-item]:focus { outline: none; }
        [data-nav-item][data-focused="true"] {
          background: #ffffff !important;
          color: #000000 !important;
        }
        [data-nav-item][data-focused="true"] [data-nav-label] {
          opacity: 1 !important;
        }
        [data-nav-item][data-focused="true"] [data-nav-icon] svg {
          stroke: #000000 !important;
        }
      </style>
    `;
  }

  private _register() {
    this.registrar.unregisterAll();

    const items = Array.from(this.querySelectorAll('[data-nav-item]'));
    items.forEach((el) => {
      const key = el.getAttribute('data-nav-item')!;
      const path = el.getAttribute('data-path')!;
      this.registrar.register([{
        focusKey: key,
        node: el as HTMLElement,
        parentFocusKey: 'sidebar',
        onEnterPress: () => {
          this.dispatchEvent(new CustomEvent('nav-select', {
            bubbles: true,
            composed: true,
            detail: { path },
          }));
        },
        onArrowPress: (direction: string) => {
          if (direction === 'right') {
            this.dispatchEvent(new CustomEvent('sidebar-focus-content', {
              bubbles: true,
              composed: true,
              detail: { path },
            }));
            return false;
          }
          return true;
        },
        onFocus: () => {
          this._expanded = true;
          this.setAttribute('expanded', 'true');
          this._updateExpanded();
        },
        onUpdateFocus: (focused: boolean) => {
          el.setAttribute('data-focused', focused ? 'true' : 'false');
        },
      }]);
    });
  }

  private _setupFocusListener() {
    this.addEventListener('focusin', () => {
      this._expanded = true;
      this.setAttribute('expanded', 'true');
      this._updateExpanded();
    });
    this.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!this.contains(document.activeElement)) {
          this._expanded = false;
          this.setAttribute('expanded', 'false');
          this._updateExpanded();
        }
      }, 50);
    });
  }

  private _updateExpanded() {
    const sidebar = this.querySelector('[data-tv-sidebar]') as HTMLElement | null;
    const labels = this.querySelectorAll('[data-nav-label]') as NodeListOf<HTMLElement>;

    if (sidebar) {
      if (this._expanded) {
        sidebar.style.width = 'clamp(220px, 25vw, 300px)';
        sidebar.style.padding = '1.5rem clamp(1rem, 2vw, 1.5rem)';
      } else {
        sidebar.style.width = 'clamp(60px, 6vw, 80px)';
        sidebar.style.padding = '1.5rem 0.75rem';
      }
    }

    labels.forEach((el) => {
      el.style.opacity = this._expanded ? '1' : '0';
    });
  }

  private _updateActiveStates() {
    this.querySelectorAll('[data-nav-item]').forEach((el) => {
      const path = el.getAttribute('data-path') ?? '';
      const isActive = this._currentPath.startsWith(path);
      (el as HTMLElement).style.color = isActive ? '#ffffff' : '#8e8e93';
      (el as HTMLElement).style.background = isActive ? 'rgba(255,255,255,0.1)' : 'transparent';
    });
  }

  setFocus(key: string) {
    SpatialNavigation.setFocus(key);
  }
}

customElements.define('tv-sidebar', TVSidebarElement);

export { TVSidebarElement };
