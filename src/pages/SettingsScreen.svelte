<script lang="ts">
  import { push } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { settingsStore, svelteSettingsStore } from '@/stores/settingsStore';
  import { toastStore } from '@/stores/toastStore';
  import { getDeviceInfo } from '@/services/NativeBridge';
  import { inputManager } from '@/services/InputManager';
  import { showPanel, buttonItem } from '@/services/overlayPanel';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import type { DeviceInfo } from '@/platform';
  import { Play, Volume2, Palette, Shield, Info, RotateCcw } from '@lucide/svelte';

  const SECTIONS = [
    { key: 'reproduccion', label: 'Reproducción', icon: Play },
    { key: 'audio', label: 'Audio', icon: Volume2 },
    { key: 'apariencia', label: 'Apariencia', icon: Palette },
    { key: 'privacidad', label: 'Privacidad', icon: Shield },
    { key: 'informacion', label: 'Información', icon: Info },
    { key: 'reiniciar', label: 'Reiniciar', icon: RotateCcw },
    { key: 'factory-reset', label: 'Restablecer app' },
  ] as const;

  type SectionKey = (typeof SECTIONS)[number]['key'];

  let activeSection = $state<SectionKey>('reproduccion');
  let deviceInfo = $state<Partial<DeviceInfo>>({});

  $effect(() => {
    async function loadDeviceInfo() {
      try {
        const info = await getDeviceInfo();
        deviceInfo = info;
      } catch {
        // fallback
      }
    }
    loadDeviceInfo();
  });

  const prefersModernPlayback = $derived($svelteSettingsStore.prefersModernPlayback);
  const navigationSoundEnabled = $derived($svelteSettingsStore.navigationSoundEnabled);
  const debugMode = $derived($svelteSettingsStore.debugMode);

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

  function handleFactoryReset() {
    toastStore.getState().show('Restableciendo la app...', 'info', 3000);
    window.localStorage.clear();
    window.sessionStorage.clear();
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
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
    <div class="flex items-center gap-[clamp(0.75rem,1.5vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] mb-[clamp(1.5rem,4vh,2rem)]">
      <div class="w-[clamp(2.25rem,3.5vw,3rem)] h-[clamp(2.25rem,3.5vw,3rem)] rounded-full bg-surface flex items-center justify-center text-text-secondary text-[clamp(1.15rem,1.8vw,1.5rem)]">
        ⚙
      </div>
      <h1 class="text-[clamp(1.35rem,2.6vw,2rem)] font-semibold text-white">
        Configuración
      </h1>
    </div>

    {#each SECTIONS as section, idx (section.key)}
      {@const isActive = activeSection === section.key}
      {@const IconComponent = (section as any).icon}

      <Focusable
        focusKey="settings-nav-{section.key}"
        onFocus={() => { activeSection = section.key; }}
        onEnterPress={() => {
          const firstItem = document.querySelector(
            `[data-settings-section="${section.key}"] [data-focus-key]`
          ) as HTMLElement | null;
          if (firstItem) {
            const fk = firstItem.getAttribute('data-focus-key');
            if (fk) setFocus(fk);
          }
        }}
        onArrowPress={(direction) => {
          if (direction === 'up' && idx === 0) {
            setFocus('topnav');
            return false;
          }
          if (direction === 'right') {
            const firstItem = document.querySelector(
              `[data-settings-section="${section.key}"] [data-focus-key]`
            ) as HTMLElement | null;
            if (firstItem) {
              const fk = firstItem.getAttribute('data-focus-key');
              if (fk) setFocus(fk);
              return false;
            }
          }
          return true;
        }}
        focusedClass="!bg-white !text-black"
        class="flex items-center gap-[clamp(0.75rem,1.2vw,1rem)] px-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.5rem,0.8vh,0.65rem)] rounded-xl text-[clamp(0.85rem,1.1vw,0.95rem)] font-medium cursor-pointer {isActive ? 'text-white bg-white/10' : 'text-text-secondary'}"
        playSound={true}
      >
        {#snippet children()}
          {#if IconComponent}
            <IconComponent class="w-5 h-5" />
          {/if}
          <span class="whitespace-nowrap">{section.label}</span>
        {/snippet}
      </Focusable>
    {/each}
  </nav>

  <!-- Right content panel -->
  <div class="flex-1 overflow-y-auto hide-scrollbar pt-[calc(var(--topnav-h)+1.5rem)] pb-[clamp(3rem,8vh,4rem)] px-[clamp(3rem,7.5vw,6rem)]">
    {#if activeSection === 'reproduccion'}
      <div data-settings-section="reproduccion">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Reproducción
        </h3>
        <div class="bg-surface rounded-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(1rem,2vw,1.5rem)]">
          <div class="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)]">
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
                Reproductor moderno
              </span>
              <span class="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
                Usa el reproductor web en lugar del nativo del dispositivo.
              </span>
            </div>
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
              class="relative inline-flex items-center w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 cursor-pointer {prefersModernPlayback ? 'bg-white' : 'bg-white/20'}"
              focusedClass="!ring-2 !ring-white/80 !ring-offset-2 !ring-offset-surface"
              playSound={true}
            >
              {#snippet children()}
                <div
                  class="absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-black transition-all {prefersModernPlayback ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]'}"
                ></div>
              {/snippet}
            </Focusable>
          </div>

          <div class="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)] border-t border-white/5">
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
                Habilitar depuración
              </span>
              <span class="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
                Muestra información técnica del reproductor durante la reproducción.
              </span>
            </div>
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
              class="relative inline-flex items-center w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 cursor-pointer {debugMode ? 'bg-white' : 'bg-white/20'}"
              focusedClass="!ring-2 !ring-white/80 !ring-offset-2 !ring-offset-surface"
              playSound={true}
            >
              {#snippet children()}
                <div
                  class="absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-black transition-all {debugMode ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]'}"
                ></div>
              {/snippet}
            </Focusable>
          </div>
        </div>
      </div>
    {:else if activeSection === 'audio'}
      <div data-settings-section="audio">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Audio
        </h3>
        <div class="bg-surface rounded-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(1rem,2vw,1.5rem)]">
          <div class="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)]">
            <div class="flex flex-col flex-1 min-w-0">
              <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">
                Sonido de navegación
              </span>
              <span class="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">
                Reproduce un sonido al cambiar el foco entre elementos.
              </span>
            </div>
            <Focusable
              focusKey="settings-toggle-nav-sound"
              onEnterPress={() => settingsStore.getState().setNavigationSoundEnabled(!navigationSoundEnabled)}
              onArrowPress={(direction) => {
                if (direction === 'up' || 'left') {
                  setFocus('settings-nav-audio');
                  return false;
                }
                return true;
              }}
              class="relative inline-flex items-center w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 cursor-pointer {navigationSoundEnabled ? 'bg-white' : 'bg-white/20'}"
              focusedClass="!ring-2 !ring-white/80 !ring-offset-2 !ring-offset-surface"
              playSound={true}
            >
              {#snippet children()}
                <div
                  class="absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-black transition-all {navigationSoundEnabled ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]'}"
                ></div>
              {/snippet}
            </Focusable>
          </div>
        </div>
      </div>
    {:else if activeSection === 'apariencia'}
      <div data-settings-section="apariencia">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Apariencia
        </h3>
        <div class="bg-surface rounded-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(1rem,2vw,1.5rem)]">
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
        <div class="bg-surface rounded-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(1rem,2vw,1.5rem)]">
          <p class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)] text-center py-[clamp(1rem,2vh,1.25rem)]">
            Próximamente
          </p>
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
          <RotateCcw class="w-[clamp(2rem,3.5vw,3rem)] h-[clamp(2rem,3.5vw,3rem)] text-red-500" />
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
    {:else if activeSection === 'informacion'}
      <div data-settings-section="informacion">
        <h3 class="text-[clamp(0.65rem,0.85vw,0.75rem)] font-bold uppercase tracking-wider text-text-secondary mb-[clamp(0.75rem,1.2vh,1rem)]">
          Información
        </h3>
        <div class="bg-surface rounded-[clamp(0.75rem,1.5vw,1rem)] p-[clamp(1rem,2vw,1.5rem)]">
          {#each infoRows as row, i (i)}
            <div class="flex items-center justify-between py-[clamp(0.5rem,1vh,0.75rem)] border-b border-white/5 last:border-b-0">
              <span class="text-text-secondary text-[clamp(0.8rem,1.1vw,0.95rem)]">
                {row.label}
              </span>
              <span class="text-white text-[clamp(0.8rem,1.1vw,0.95rem)] font-medium text-right max-w-[clamp(10rem,22vw,18rem)] overflow-hidden text-ellipsis">
                {row.value}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</FocusContainer>
