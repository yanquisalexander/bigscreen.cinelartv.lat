<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { settingsStore, svelteSettingsStore } from '@/stores/settingsStore';
  import { authStore, svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { toastStore } from '@/stores/toastStore';
  import { getDeviceInfo } from '@/services/NativeBridge';
  import { detectDeviceCertification } from '@/services/deviceCertification';
  import type { DeviceCertification } from '@/services/deviceCertification';
  import { getRuntimeConfig } from '@/runtime';
  import { inputManager } from '@/services/InputManager';
  import { showPanel, buttonItem } from '@/services/overlayPanel';
  import { deassignProfile } from '@/features/auth/session';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import type { DeviceInfo } from '@/platform';
  import {
    Play, Volume2, Palette, Shield, Info, RotateCcw,
    User, Users, ChevronRight, Tv, RefreshCw, Trash2,
    HelpCircle, FileText, Server, Settings, ChevronDown,
    ShieldCheck, MonitorPlay, Sparkles
  } from '@lucide/svelte';

  const profile = $derived($svelteAuthStore.selectedProfile);
  const isGuest = $derived($svelteAuthStore.isGuest);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);
  const avatarUrl = $derived(
    profile ? `${clientEndpoint}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'}.png` : ''
  );

  const prefersModernPlayback = $derived($svelteSettingsStore.prefersModernPlayback);
  const navigationSoundEnabled = $derived($svelteSettingsStore.navigationSoundEnabled);
  const debugMode = $derived($svelteSettingsStore.debugMode);
  const runtimeConfig = $derived(getRuntimeConfig());

  let deviceInfo = $state<Partial<DeviceInfo>>({});
  let certification = $state<DeviceCertification | null>(null);
  let signingOut = $state(false);
  let changingProfile = $state(false);
  let contentPanelEl = $state<HTMLDivElement | null>(null);
  let _scrollObserver: MutationObserver | null = null;

  function scrollToFocused() {
    const container = contentPanelEl;
    if (!container) return;
    if (_scrollObserver) { _scrollObserver.disconnect(); _scrollObserver = null; }
    const tryScroll = () => {
      const focused = container.querySelector('[data-focused="true"]') as HTMLElement | null;
      if (focused) {
        focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };
    if (tryScroll()) return;
    const observer = new MutationObserver(() => {
      if (tryScroll()) { observer.disconnect(); _scrollObserver = null; }
    });
    _scrollObserver = observer;
    observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });
    setTimeout(() => { observer.disconnect(); _scrollObserver = null; }, 1000);
  }

  $effect(() => {
    async function loadDeviceInfo() {
      try {
        const info = await getDeviceInfo();
        deviceInfo = info;
      } catch { /* fallback */ }
    }
    loadDeviceInfo();
  });

  $effect(() => {
    async function loadCertification() {
      try {
        certification = await detectDeviceCertification();
      } catch { /* fallback */ }
    }
    loadCertification();
  });

  function handleBack() {
    push('/home');
  }

  $effect(() => {
    inputManager.on('back', handleBack);
    return () => inputManager.off('back', handleBack);
  });

  $effect(() => {
    setTimeout(() => {
      setFocus('settings-nav-reproduccion');
    }, 50);
  });

  $effect(() => {
    if (!contentPanelEl) return;
    const observer = new MutationObserver(() => {
      const focused = contentPanelEl?.querySelector('[data-focused="true"]') as HTMLElement | null;
      if (focused) {
        focused.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    observer.observe(contentPanelEl, { attributes: true, subtree: true, attributeFilter: ['data-focused'] });
    return () => observer.disconnect();
  });

  function handleFactoryReset() {
    toastStore.getState().show('Restableciendo la app...', 'info', 3000);
    window.localStorage.clear();
    window.sessionStorage.clear();
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  }

  async function handleSignOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      authStore.getState().logout();
      push('/auth');
    } catch (err) {
      console.warn(err);
    } finally {
      signingOut = false;
    }
  }

  async function handleChangeProfile() {
    if (changingProfile) return;
    changingProfile = true;
    try {
      const token = authStore.getState().tokens?.accessToken;
      if (token) await deassignProfile(token);
    } catch (err) {
      console.warn('deassignProfile failed', err);
    }
    changingProfile = false;
    push('/select-profile');
  }

  const SECTIONS = [
    { key: 'reproduccion', label: 'Reproducción', icon: Play },
    { key: 'audio', label: 'Audio', icon: Volume2 },
    { key: 'apariencia', label: 'Apariencia', icon: Palette },
    { key: 'privacidad', label: 'Privacidad', icon: Shield },
    { key: 'informacion', label: 'Información', icon: Info },
    { key: 'reiniciar', label: 'Reiniciar', icon: RotateCcw },
    { key: 'factory-reset', label: 'Restablecer app', icon: Trash2 },
  ] as const;

  type SectionKey = (typeof SECTIONS)[number]['key'];

  let activeSection = $state<SectionKey>('reproduccion');

  function focusFirstItem(sectionKey: string) {
    const firstItem = document.querySelector(
      `[data-settings-section="${sectionKey}"] [data-focus-key]`
    ) as HTMLElement | null;
    if (firstItem) {
      const fk = firstItem.getAttribute('data-focus-key');
      if (fk) setFocus(fk);
    }
  }

  const infoRows = $derived([
    { label: 'Versión', value: deviceInfo.appVersion ?? 'Cargando...' },
    { label: 'Dispositivo', value: deviceInfo.deviceName ?? '—' },
    { label: 'Modelo', value: deviceInfo.model ?? 'Cargando...' },
    { label: 'Plataforma', value: deviceInfo.platform ?? 'Cargando...' },
    {
      label: 'Versión Nativa',
      value: deviceInfo.nativeVersionName
        ? `${deviceInfo.nativeVersionName} (${deviceInfo.nativeVersion ?? '0'})`
        : '—',
    },
  ]);
</script>

<FocusContainer
  focusKey="settings-root"
  focusable={false}
  preferredChildFocusKey="settings-nav-reproduccion"
  trackChildren={true}
  saveLastFocusedChild={true}
  class="w-full h-dvh bg-bg flex overflow-hidden"
>
  <!-- Left panel sidebar -->
  <nav class="flex-shrink-0 min-w-[clamp(140px,25vw,300px)] pt-[calc(var(--topnav-h)+1.5rem)] pb-[clamp(3rem,8vh,4rem)] pl-[clamp(4rem,8vw,6rem)] pr-[clamp(2rem,4vw,3rem)] flex flex-col gap-[clamp(0.25rem,0.4vh,0.35rem)] overflow-y-auto scrollbar-none">
    <!-- Profile card -->
    <Focusable
      focusKey="settings-profile"
      onEnterPress={handleChangeProfile}
      onArrowPress={(direction) => {
        if (direction === 'down') {
          setFocus('settings-nav-reproduccion');
          return false;
        }
        return true;
      }}
      focusedClass="!bg-white/10"
      class="flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.625rem,1vh,0.875rem)] rounded-2xl mb-[clamp(1rem,2vh,1.5rem)] cursor-pointer"
      playSound={true}
    >
      {#snippet children()}
        <div class="w-[clamp(2.5rem,4vw,3.25rem)] h-[clamp(2.5rem,4vw,3.25rem)] rounded-full overflow-hidden bg-surface flex-shrink-0">
          {#if avatarUrl}
            <img src={avatarUrl} alt={profile?.name ?? ''} class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full flex items-center justify-center text-text-secondary">
              <User class="w-5 h-5" />
            </div>
          {/if}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-white text-[clamp(0.85rem,1.2vw,1rem)] font-semibold truncate">
            {profile?.name ?? 'Usuario'}
          </div>
          {#if !isGuest}
            <div class="text-text-secondary text-[clamp(0.65rem,0.85vw,0.75rem)] truncate mt-0.5">
              Cambiar perfil
            </div>
          {/if}
        </div>
        {#if changingProfile}
          <div class="w-4 h-4 border-2 border-text-secondary border-t-transparent rounded-full animate-spin"></div>
        {:else}
          <ChevronRight class="w-4 h-4 text-text-secondary flex-shrink-0" />
        {/if}
      {/snippet}
    </Focusable>

    <div class="h-px bg-white/5 mx-[clamp(0.5rem,1vw,0.75rem)] mb-[clamp(0.5rem,1vh,0.75rem)]"></div>

    {#each SECTIONS as section, idx (section.key)}
      {@const isActive = activeSection === section.key}
      {@const IconComponent = (section as any).icon}

      <Focusable
        focusKey="settings-nav-{section.key}"
        onFocus={() => { activeSection = section.key; }}
        onEnterPress={() => focusFirstItem(section.key)}
        onArrowPress={(direction) => {
          if (direction === 'up' && idx === 0) {
            setFocus('settings-profile');
            return false;
          }
          if (direction === 'right') {
            focusFirstItem(section.key);
            return false;
          }
          return true;
        }}
        focusedClass="!bg-white/10"
        class="flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.5rem,0.8vh,0.65rem)] rounded-xl text-[clamp(0.85rem,1.1vw,0.95rem)] font-medium cursor-pointer {isActive ? 'text-white bg-white/5' : 'text-text-secondary hover:text-white'}"
        playSound={true}
      >
        {#snippet children()}
          <IconComponent class="w-5 h-5 {isActive ? 'text-accent-light' : ''}" />
          <span class="whitespace-nowrap">{section.label}</span>
        {/snippet}
      </Focusable>
    {/each}

    <div class="flex-1"></div>

    <!-- Server info at bottom -->
    <div class="flex items-center gap-[clamp(0.5rem,1vw,0.75rem)] px-[clamp(0.75rem,1.2vw,1rem)] mt-[clamp(1rem,2vh,1.5rem)]">
      <div class="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
        <Server class="w-4 h-4 text-text-tertiary" />
      </div>
      <div class="min-w-0">
        <div class="text-text-secondary text-[clamp(0.7rem,0.9vw,0.8rem)] font-medium truncate">CinelarTV</div>
      </div>
    </div>
  </nav>

  <!-- Right content panel -->
  <div bind:this={contentPanelEl} class="flex-1 overflow-y-auto hide-scrollbar pt-[calc(var(--topnav-h)+1.5rem)] pb-[clamp(3rem,8vh,4rem)] px-[clamp(3rem,7.5vw,6rem)]">

    {#if activeSection === 'reproduccion'}
      <div data-settings-section="reproduccion">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Reproducción
        </h3>
        <div class="bg-surface rounded-2xl overflow-hidden">
          <!-- Modern Player -->
          <Focusable
            focusKey="settings-toggle-modern"
            onEnterPress={() => settingsStore.getState().setPrefersModernPlayback(!prefersModernPlayback)}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-reproduccion');
                return false;
              }
              if (direction === 'down') {
                setFocus('settings-toggle-debug');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.875rem,1.5vh,1.125rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <div class="flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] flex-1 min-w-0">
                <Play class="w-[clamp(1.1rem,1.6vw,1.35rem)] h-[clamp(1.1rem,1.6vw,1.35rem)] text-text-secondary" />
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
                    Reproductor moderno
                  </span>
                  <span class="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
                    Usa el reproductor web en lugar del nativo del dispositivo.
                  </span>
                </div>
              </div>
              <div class="relative inline-flex items-center w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 {prefersModernPlayback ? 'bg-accent-light' : 'bg-white/20'}">
                <div
                  class="absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-white transition-all duration-200 shadow-md {prefersModernPlayback ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]'}"
                ></div>
              </div>
            {/snippet}
          </Focusable>

          <div class="h-px bg-white/5 ml-[clamp(3rem,5.5vw,4.5rem)]"></div>

          <!-- Debug Mode -->
          <Focusable
            focusKey="settings-toggle-debug"
            onEnterPress={() => settingsStore.getState().setDebugMode(!debugMode)}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-reproduccion');
                return false;
              }
              if (direction === 'up') {
                setFocus('settings-toggle-modern');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.875rem,1.5vh,1.125rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <div class="flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] flex-1 min-w-0">
                <Info class="w-[clamp(1.1rem,1.6vw,1.35rem)] h-[clamp(1.1rem,1.6vw,1.35rem)] text-text-secondary" />
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
                    Habilitar depuración
                  </span>
                  <span class="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
                    Muestra información técnica del reproductor durante la reproducción.
                  </span>
                </div>
              </div>
              <div class="relative inline-flex items-center w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 {debugMode ? 'bg-accent-light' : 'bg-white/20'}">
                <div
                  class="absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-white transition-all duration-200 shadow-md {debugMode ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]'}"
                ></div>
              </div>
            {/snippet}
          </Focusable>
        </div>
      </div>

    {:else if activeSection === 'audio'}
      <div data-settings-section="audio">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Audio
        </h3>
        <div class="bg-surface rounded-2xl overflow-hidden">
          <Focusable
            focusKey="settings-toggle-nav-sound"
            onEnterPress={() => settingsStore.getState().setNavigationSoundEnabled(!navigationSoundEnabled)}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-audio');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.875rem,1.5vh,1.125rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <div class="flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] flex-1 min-w-0">
                <Volume2 class="w-[clamp(1.1rem,1.6vw,1.35rem)] h-[clamp(1.1rem,1.6vw,1.35rem)] text-text-secondary" />
                <div class="flex flex-col flex-1 min-w-0">
                  <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
                    Sonido de navegación
                  </span>
                  <span class="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
                    Reproduce un sonido al cambiar el foco entre elementos.
                  </span>
                </div>
              </div>
              <div class="relative inline-flex items-center w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 {navigationSoundEnabled ? 'bg-accent-light' : 'bg-white/20'}">
                <div
                  class="absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-white transition-all duration-200 shadow-md {navigationSoundEnabled ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]'}"
                ></div>
              </div>
            {/snippet}
          </Focusable>
        </div>
      </div>

    {:else if activeSection === 'apariencia'}
      <div data-settings-section="apariencia">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Apariencia
        </h3>
        <div class="bg-surface rounded-2xl p-[clamp(1rem,2vw,1.5rem)]">
          <p class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-[clamp(1rem,2vh,1.25rem)]">
            Próximamente
          </p>
        </div>
      </div>

    {:else if activeSection === 'privacidad'}
      <div data-settings-section="privacidad">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Privacidad
        </h3>
        <div class="bg-surface rounded-2xl p-[clamp(1rem,2vw,1.5rem)]">
          <p class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-[clamp(1rem,2vh,1.25rem)]">
            Próximamente
          </p>
        </div>
      </div>

    {:else if activeSection === 'informacion'}
      <div data-settings-section="informacion">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Información
        </h3>
        <div class="bg-surface rounded-2xl overflow-hidden">
          {#each infoRows as row, i (i)}
            <Focusable
              focusKey="settings-info-{i}"
              onEnterPress={() => {}}
              onArrowPress={(direction) => {
                if (direction === 'left') {
                  setFocus('settings-nav-informacion');
                  return false;
                }
                return true;
              }}
              focusedClass="!bg-white/5"
              class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.625rem,1vh,0.875rem)] cursor-pointer"
              playSound={true}
            >
              {#snippet children()}
                <span class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)]">
                  {row.label}
                </span>
                <span class="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium text-right max-w-[clamp(10rem,22vw,18rem)] overflow-hidden text-ellipsis">
                  {row.value}
                </span>
              {/snippet}
            </Focusable>
            {#if i < infoRows.length - 1}
              <div class="h-px bg-white/5 ml-[clamp(3rem,5.5vw,4.5rem)]"></div>
            {/if}
          {/each}
        </div>

        <!-- Certificación de dispositivo -->
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mt-[clamp(1.5rem,3vh,2.5rem)] mb-[clamp(0.75rem,1.2vh,1rem)]">
          Certificación de dispositivo
        </h3>

        <!-- App Quality -->
        <div class="bg-surface rounded-2xl overflow-hidden mb-[clamp(0.75rem,1.5vh,1rem)]">
          <Focusable
            focusKey="settings-cert-quality"
            onEnterPress={() => {}}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-informacion');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.875rem,1.5vh,1.125rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <div class="flex items-center gap-[clamp(0.75rem,1.2vw,1rem)]">
                <MonitorPlay class="w-[clamp(1.1rem,1.6vw,1.35rem)] h-[clamp(1.1rem,1.6vw,1.35rem)] text-accent-light" />
                <div class="flex flex-col">
                  <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
                    App Quality
                  </span>
                  <span class="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
                    Esto no afecta la reproducción del contenido en CinelarTV; simplemente optimizamos el rendimiento para adaptarlo mejor a tu TV.
                  </span>
                </div>
              </div>
              <div class="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-semibold mt-2 ml-[clamp(1.85rem,2.85rem,2.35rem)]">
                {runtimeConfig.appQuality}
              </div>
            {/snippet}
          </Focusable>
        </div>

        <!-- Nivel de certificación + features -->
        <div class="bg-surface rounded-2xl overflow-hidden">
          <!-- Nivel de certificación -->
          <Focusable
            focusKey="settings-cert-level"
            onEnterPress={() => {}}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-informacion');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.875rem,1.5vh,1.125rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <div class="flex items-center gap-[clamp(0.75rem,1.2vw,1rem)]">
                <ShieldCheck class="w-[clamp(1.1rem,1.6vw,1.35rem)] h-[clamp(1.1rem,1.6vw,1.35rem)] {certification?.level === 'certified' ? 'text-green-400' : certification?.level === 'standard' ? 'text-yellow-400' : 'text-text-secondary'}" />
                <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
                  Nivel de certificación
                </span>
              </div>
              <span class="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-semibold">
                {certification?.label ?? 'Cargando...'}
              </span>
            {/snippet}
          </Focusable>

          <div class="h-px bg-white/5 ml-[clamp(3rem,5.5vw,4.5rem)]"></div>

          <!-- 4K -->
          <Focusable
            focusKey="settings-cert-4k"
            onEnterPress={() => {}}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-informacion');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.625rem,1vh,0.875rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <span class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)]">4K</span>
              <span class="text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium {certification?.supports4K ? 'text-green-400' : 'text-red-400'}">
                {certification?.supports4K ? 'Soportado' : 'No soportado'}
              </span>
            {/snippet}
          </Focusable>

          <div class="h-px bg-white/5 ml-[clamp(3rem,5.5vw,4.5rem)]"></div>

          <!-- 4K HDR -->
          <Focusable
            focusKey="settings-cert-hdr"
            onEnterPress={() => {}}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-informacion');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.625rem,1vh,0.875rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <span class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)]">4K HDR</span>
              <span class="text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium {certification?.supportsHDR ? 'text-green-400' : 'text-red-400'}">
                {certification?.supportsHDR ? 'Soportado' : 'No soportado'}
              </span>
            {/snippet}
          </Focusable>

          <div class="h-px bg-white/5 ml-[clamp(3rem,5.5vw,4.5rem)]"></div>

          <!-- Codecs -->
          <Focusable
            focusKey="settings-cert-codecs"
            onEnterPress={() => {}}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-informacion');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.625rem,1vh,0.875rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <span class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)]">Codecs</span>
              <div class="flex gap-[clamp(0.35rem,0.6vw,0.5rem)]">
                {#each Object.entries(certification?.codecs ?? {}) as [codec, supported]}
                  <span class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-medium px-[clamp(0.35rem,0.6vw,0.5rem)] py-0.5 rounded {supported ? 'bg-green-400/15 text-green-400' : 'bg-white/5 text-text-secondary'}">
                    {codec.toUpperCase()}
                  </span>
                {/each}
              </div>
            {/snippet}
          </Focusable>

          <div class="h-px bg-white/5 ml-[clamp(3rem,5.5vw,4.5rem)]"></div>

          <!-- Widevine -->
          <Focusable
            focusKey="settings-cert-widevine"
            onEnterPress={() => {}}
            onArrowPress={(direction) => {
              if (direction === 'left') {
                setFocus('settings-nav-informacion');
                return false;
              }
              return true;
            }}
            focusedClass="!bg-white/5"
            class="flex items-center justify-between px-[clamp(1.25rem,2.5vw,2rem)] py-[clamp(0.625rem,1vh,0.875rem)] cursor-pointer"
            playSound={true}
          >
            {#snippet children()}
              <span class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)]">Widevine DRM</span>
              <div class="flex items-center gap-[clamp(0.35rem,0.6vw,0.5rem)]">
                {#if certification?.widevine.supported}
                  <span class="text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium text-green-400">
                    {certification.widevine.level}
                  </span>
                {:else}
                  <span class="text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium text-red-400">
                    No soportado
                  </span>
                {/if}
              </div>
            {/snippet}
          </Focusable>
        </div>
      </div>

    {:else if activeSection === 'reiniciar'}
      <div data-settings-section="reiniciar" class="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div class="w-[clamp(4rem,7vw,5.5rem)] h-[clamp(4rem,7vw,5.5rem)] rounded-2xl bg-accent/20 flex items-center justify-center mb-[clamp(1.5rem,3vh,2.5rem)]">
          <RotateCcw class="w-[clamp(2rem,3.5vw,3rem)] h-[clamp(2rem,3.5vw,3rem)] text-accent-light" />
        </div>
        <h2 class="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-bold mb-[clamp(0.75rem,1.5vh,1rem)]">
          Reiniciar app
        </h2>
        <p class="text-text-secondary text-[clamp(0.85rem,1.2vw,1.05rem)] leading-relaxed max-w-[clamp(300px,40vw,500px)] mb-[clamp(2rem,4vh,3rem)]">
          Vuelve a cargar la aplicación y regresa a la pantalla de inicio. Esto puede ayudar a corregir problemas temporales.
        </p>
        <Focusable
          focusKey="settings-reiniciar-btn"
          onEnterPress={() => { window.location.href = '/'; }}
          onArrowPress={(direction) => {
            if (direction === 'up' || direction === 'left') {
              setFocus('settings-nav-reiniciar');
              return false;
            }
            return true;
          }}
          focusedClass="!bg-white !text-black"
          class="inline-flex items-center justify-center px-[clamp(2rem,4vw,3rem)] py-[clamp(0.625rem,1.4vh,0.875rem)] rounded-full bg-surface text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-semibold border border-white/10 cursor-pointer"
          playSound={true}
        >
          {#snippet children()}
            Reiniciar app
          {/snippet}
        </Focusable>
      </div>

    {:else if activeSection === 'factory-reset'}
      <div data-settings-section="factory-reset" class="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div class="w-[clamp(4rem,7vw,5.5rem)] h-[clamp(4rem,7vw,5.5rem)] rounded-2xl bg-red-500/20 flex items-center justify-center mb-[clamp(1.5rem,3vh,2.5rem)]">
          <Trash2 class="w-[clamp(2rem,3.5vw,3rem)] h-[clamp(2rem,3.5vw,3rem)] text-red-500" />
        </div>
        <h2 class="text-white text-[clamp(1.5rem,3vw,2.25rem)] font-bold mb-[clamp(0.75rem,1.5vh,1rem)]">
          Restablecer app
        </h2>
        <p class="text-text-secondary text-[clamp(0.85rem,1.2vw,1.05rem)] leading-relaxed max-w-[clamp(300px,40vw,500px)] mb-[clamp(2rem,4vh,3rem)]">
          Esto borrará todos los datos de la aplicación y la devolverá a su estado original. Úsalo solo si es necesario.
        </p>
        <Focusable
          focusKey="settings-factory-reset-btn"
          onEnterPress={() => {
            showPanel({
              id: 'panel-factory-reset',
              title: 'Restablecer app',
              subtitle: '¿Estás seguro de que quieres borrar todos los datos y restablecer la aplicación? Esta acción no se puede deshacer.',
              items: [
                buttonItem({ title: 'Restablecer app', subtitle: 'Borrar todos los datos y volver a la pantalla de inicio', icon: 'trash' }, () => {
                  handleFactoryReset();
                }),
                buttonItem({ title: 'Volver', subtitle: 'Cancelar y regresar a la configuración', icon: 'x' }),
              ],
            });
          }}
          onArrowPress={(direction) => {
            if (direction === 'up' || direction === 'left') {
              setFocus('settings-nav-factory-reset');
              return false;
            }
            return true;
          }}
          focusedClass="!bg-white !text-black"
          class="inline-flex items-center justify-center px-[clamp(2rem,4vw,3rem)] py-[clamp(0.625rem,1.4vh,0.875rem)] rounded-full bg-red-500 text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-semibold border border-red-500/50 cursor-pointer"
          playSound={true}
        >
          {#snippet children()}
            Restablecer app
          {/snippet}
        </Focusable>
      </div>
    {/if}
  </div>
</FocusContainer>
