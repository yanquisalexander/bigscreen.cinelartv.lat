<script lang="ts">
  import { push, router } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { authStore, svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { deassignProfile } from '@/features/auth/session';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import { House, Search, Tv, Settings, LogIn } from '@lucide/svelte';

  interface Props {
    onFocusChange?: (focused: boolean) => void;
  }

  let { onFocusChange }: Props = $props();

  let hasFocusedChild = $state(false);

  const NAV_ITEMS = [
    { key: 'home', label: 'Inicio', icon: House, path: '/home' },
    { key: 'search', label: 'Buscar', icon: Search, path: '/search' },
    { key: 'live', label: 'TV en Vivo', icon: Tv, path: '/live' },
  ];

  function focusKeyForPath(path: string): string {
    if (path.startsWith('/content/')) return 'detail-hero';
    if (path.startsWith('/search')) return 'search-root';
    if (path.startsWith('/live')) return 'livetv-root';
    if (path.startsWith('/settings')) return 'settings-root';
    return 'home-root';
  }

  function focusContent(direction: string) {
    if (direction !== 'right') return true;
    setFocus(focusKeyForPath(router.location));
    return false;
  }

  function handleLogin() {
    authStore.getState().exitGuestMode();
    push('/auth');
  }

  function handleProfile() {
    const token = authStore.getState().tokens?.accessToken;
    if (token) deassignProfile(token).catch(() => {});
    push('/select-profile');
  }

  function onUpdateHasFocusedChild(focused: boolean) {
    hasFocusedChild = focused;
    onFocusChange?.(focused);
  }

  const profile = $derived($svelteAuthStore.selectedProfile);
  const isGuest = $derived($svelteAuthStore.isGuest);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);

  const avatarUrl = $derived(
    profile ? `${clientEndpoint}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'}.png` : ''
  );

  const collapsed = $derived(!hasFocusedChild);

  const itemBaseClasses = 'flex h-11 items-center gap-3 rounded-md text-sm font-medium';
</script>

<FocusContainer
  focusKey="sidebar"
  preferredChildFocusKey="nav-home"
  trackChildren={true}
  saveLastFocusedChild={true}
  {onUpdateHasFocusedChild}
  class="relative h-full w-full flex flex-col py-4 bg-bg {collapsed ? 'px-0' : 'px-2'}"
>
  <aside style="grid-area: sidebar;" class="h-full w-full flex flex-col">
    <nav class="flex-1 flex flex-col gap-1 justify-center">
      {#each NAV_ITEMS as item (item.key)}
        {@const isActive = router.location.startsWith(item.path)}
        {@const IconComponent = item.icon}
        <Focusable
          focusKey="nav-{item.key}"
          onEnterPress={() => push(item.path)}
          onArrowPress={focusContent}
          focusedClass="!bg-white !text-black border-transparent"
          class="{itemBaseClasses} {collapsed ? 'justify-center px-0' : 'justify-start px-3'} {isActive ? 'text-white border-l-2 border-accent' : 'text-white/55 border-l-2 border-transparent'}"
          playSound={true}
        >
          {#snippet children()}
            <span class="w-6 flex items-center justify-center flex-shrink-0">
              <IconComponent class="w-5 h-5" />
            </span>
            <span
              class="truncate whitespace-nowrap"
              style="display: {hasFocusedChild ? 'block' : 'none'};"
            >
              {item.label}
            </span>
          {/snippet}
        </Focusable>
      {/each}
    </nav>

    <div class="flex flex-col gap-1 pt-2 mt-2 border-t border-white/10">
      <Focusable
        focusKey="nav-settings"
        onEnterPress={() => push('/settings')}
        onArrowPress={focusContent}
        focusedClass="!bg-white !text-black border-transparent"
        class="{itemBaseClasses} {collapsed ? 'justify-center px-0' : 'justify-start px-3'} text-white/55 border-l-2 border-transparent"
        playSound={true}
      >
        {#snippet children()}
          <span class="w-6 flex items-center justify-center flex-shrink-0">
            <Settings class="w-5 h-5" />
          </span>
          <span
            class="truncate whitespace-nowrap"
            style="display: {hasFocusedChild ? 'block' : 'none'};"
          >
            Ajustes
          </span>
        {/snippet}
      </Focusable>

      {#if isGuest}
        <Focusable
          focusKey="nav-login"
          onEnterPress={handleLogin}
          onArrowPress={focusContent}
          focusedClass="!bg-white !text-black border-transparent"
          class="{itemBaseClasses} {collapsed ? 'justify-center px-0' : 'justify-start px-3'} text-white/55 border-l-2 border-transparent"
          playSound={true}
        >
          {#snippet children()}
            <span class="w-6 flex items-center justify-center flex-shrink-0">
              <LogIn class="w-5 h-5" />
            </span>
            <span
              class="truncate whitespace-nowrap"
              style="display: {hasFocusedChild ? 'block' : 'none'};"
            >
              Iniciar sesión
            </span>
          {/snippet}
        </Focusable>
      {:else if profile}
        <Focusable
          focusKey="nav-profile"
          onEnterPress={handleProfile}
          onArrowPress={focusContent}
          focusedClass="!bg-white !text-black border-transparent [&_span]:text-black"
          class="{itemBaseClasses} {collapsed ? 'justify-center px-0' : 'justify-start px-3'} text-white border-l-2 border-transparent"
          playSound={true}
        >
          {#snippet children()}
            <span class="w-6 flex items-center justify-center flex-shrink-0">
              <img
                src={avatarUrl}
                alt={profile.name}
                class="w-6 h-6 rounded-full object-cover"
                onerror={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </span>
            <span
              class="truncate whitespace-nowrap"
              style="display: {hasFocusedChild ? 'block' : 'none'};"
            >
              {profile.name}
            </span>
          {/snippet}
        </Focusable>
      {/if}
    </div>
  </aside>
</FocusContainer>
