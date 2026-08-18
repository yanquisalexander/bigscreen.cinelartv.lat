<script lang="ts">
  import { push, router } from 'svelte-spa-router';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { authStore, svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { deassignProfile } from '@/features/auth/session';
  import { setFocus } from '@noriginmedia/norigin-spatial-navigation-core';
  import { subscribeScrolled } from '@/stores/scrollStore';
  import CinelarLogo from '@/components/ui/CinelarLogo.svelte';

  interface Props {
    onFocusChange?: (focused: boolean) => void;
  }

  let { onFocusChange }: Props = $props();

  let hasFocusedChild = $state(false);

  const NAV_ITEMS: { key: string; label: string; path: string }[] = [
    { key: 'home', label: 'Explorar', path: '/home' },
    { key: 'search', label: 'Búsqueda', path: '/search' },
    { key: 'live', label: 'Live TV', path: '/live' },
  ];

  function focusKeyForPath(path: string): string {
    if (path.startsWith('/content/')) return 'detail-hero';
    if (path.startsWith('/search')) return 'search-root';
    if (path.startsWith('/live')) return 'livetv-root';
    if (path.startsWith('/settings')) return 'settings-root';
    return 'home-root';
  }

  function focusContent(direction: string) {
    if (direction !== 'down') return true;
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

  let scrolled = $state(false);

  $effect(() => {
    return subscribeScrolled((v) => { scrolled = v; });
  });
</script>

<FocusContainer
  focusKey="topnav"
  preferredChildFocusKey="nav-home"
  trackChildren={true}
  saveLastFocusedChild={true}
  {onUpdateHasFocusedChild}
  class="absolute top-0 left-0 right-0 w-full flex items-center justify-between px-[clamp(2.5rem,5vw,4rem)] h-[var(--topnav-h)] pt-[clamp(1rem,2vh,1.75rem)] pb-[clamp(0.5rem,1vh,0.75rem)] z-50 transition-colors duration-300 {scrolled ? 'bg-gradient-to-b from-black/80 via-black/50 to-transparent' : ''}"
>
  <!-- Left: Logo + Search -->
  <div class="topnav-actions flex items-center gap-[clamp(0.75rem,1.5vw,1.25rem)] transition-opacity duration-500">
    {#if isGuest}
      <Focusable
        focusKey="nav-login"
        onEnterPress={handleLogin}
        onArrowPress={focusContent}
        focusedClass="scale-110"
        class="h-[clamp(1.75rem,2.5vh,2.25rem)] w-auto shrink-0 flex items-center justify-center"
        playSound={true}
      >
        {#snippet children()}
          <CinelarLogo class="h-full w-auto" />
        {/snippet}
      </Focusable>
    {:else if profile}
      <Focusable
        focusKey="nav-profile"
        onEnterPress={handleProfile}
        onArrowPress={focusContent}
        focusedClass="ring-2 ring-white/60"
        class="w-[clamp(2rem,3vh,2.75rem)] h-[clamp(2rem,3vh,2.75rem)] rounded-full overflow-hidden shrink-0"
        playSound={true}
      >
        {#snippet children()}
          <img
            src={avatarUrl}
            alt={profile.name}
            class="w-full h-full object-cover"
            onerror={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        {/snippet}
      </Focusable>
    {:else}
      <div class="h-[clamp(1.75rem,2.5vh,2.25rem)] w-auto">
        <CinelarLogo class="h-full w-auto" />
      </div>
    {/if}

  
  </div>

  <!-- Center: Nav items -->
  <nav class="flex items-center gap-[clamp(0.5rem,1vw,0.75rem)]">
    {#each NAV_ITEMS as item (item.key)}
      {@const isActive = router.location.startsWith(item.path)}
      <Focusable
        focusKey="nav-{item.key}"
        onEnterPress={() => push(item.path)}
        onArrowPress={focusContent}
        focusedClass="!bg-white !text-black !scale-105"
        class="topnav-item px-[clamp(1rem,1.8vw,1.5rem)] py-[clamp(0.3rem,0.6vh,0.5rem)] rounded-full text-[clamp(0.8rem,1vw,0.9rem)] font-medium transition-all duration-200 {isActive ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'}"
        playSound={true}
      >
        {#snippet children()}
          <span>{item.label}</span>
        {/snippet}
      </Focusable>
    {/each}
  </nav>

  <!-- Right: Settings -->
  <div class="topnav-actions flex items-center transition-opacity duration-500">
      <Focusable
        focusKey="nav-settings"
        onEnterPress={() => push('/settings')}
        onArrowPress={focusContent}
        focusedClass="!bg-white !text-black !scale-105"
        class="w-[clamp(2rem,3vh,2.75rem)] h-[clamp(2rem,3vh,2.75rem)] rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors"
        playSound={true}
      >
      {#snippet children()}
        <i class="ctv-settings text-[clamp(0.9rem,1.2vw,1.05rem)]"></i>
      {/snippet}
    </Focusable>
  </div>
</FocusContainer>
