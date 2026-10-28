<script lang="ts">
  import { push, router } from 'svelte-spa-router';
  import { LogIn } from '@lucide/svelte';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import CinelarLogo from '@/components/ui/CinelarLogo.svelte';
  import { authStore, svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { homeBrowseMemory } from '@/stores/homeBrowseMemory';
  import { deassignProfile } from '@/features/auth/session';
  import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';

  let { onFocusChange }: { onFocusChange?: (focused: boolean) => void } = $props();
  const items = [
    { key: 'home', label: 'Explorar', path: '/home' },
    { key: 'search', label: 'Buscar', path: '/search' },
    { key: 'live', label: 'En vivo', path: '/live' },
  ];
  const profile = $derived($svelteAuthStore.selectedProfile);
  const guest = $derived($svelteAuthStore.isGuest);
  const avatar = $derived(profile ? `${$svelteConfigStore.config.CLIENT_ENDPOINT}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'}.png` : '');
  const preferredTab = $derived(router.location.startsWith('/search') ? 'nav-search' : router.location.startsWith('/live') ? 'nav-live' : router.location.startsWith('/settings') ? 'nav-settings' : 'nav-home');

  function focusContent(direction: string) {
    if (direction !== 'down') return true;
    const path = router.location;
    const candidates = path.startsWith('/content/') ? ['detail-hero-play', 'detail-hero', 'content-root']
      : path.startsWith('/search') ? ['sk-A', 'search-root']
      : path.startsWith('/live') ? ['live-cat-Guía', 'livetv-root']
      : path.startsWith('/settings') ? ['settings-profile', 'settings-root']
      : [homeBrowseMemory.focusKey, 'home-root'];
    const key = candidates.find(candidate => candidate && doesFocusableExist(candidate));
    if (!key) return true;
    setFocus(key);
    return false;
  }
  function account() {
    const state = authStore.getState();
    if (state.isGuest || !state.tokens?.accessToken) {
      authStore.getState().exitGuestMode();
      push('/auth');
      return;
    }
    authStore.getState().clearProfile();
    deassignProfile(state.tokens.accessToken).catch(() => {});
    push('/select-profile');
  }
</script>

<FocusContainer focusKey="topnav" focusable={false} preferredChildFocusKey={preferredTab} saveLastFocusedChild={true} onUpdateHasFocusedChild={onFocusChange} class="tv-top-navigation">
  <div class="brand"><CinelarLogo class="h-full w-auto" /></div>
  <nav aria-label="Navegación principal">
    {#each items as item}
      {@const active = router.location.startsWith(item.path) || (item.key === 'home' && router.location.startsWith('/content/'))}
      <Focusable focusKey="nav-{item.key}" onEnterPress={() => push(item.path)} onArrowPress={focusContent} focusedClass="!bg-white !text-black scale-[1.04]" class="navigation-tab {active ? 'selected' : ''}">
        {#snippet children()}<span>{item.label}</span>{/snippet}
      </Focusable>
    {/each}
  </nav>
  <div class="utilities">
    <Focusable focusKey="nav-settings" onEnterPress={() => push('/settings')} onArrowPress={focusContent} class="navigation-utility navigation-settings">
      {#snippet children()}<i class="ctv-settings utility-icon" aria-hidden="true"></i><span class="sr-only">Ajustes</span>{/snippet}
    </Focusable>
    <Focusable focusKey={guest ? 'nav-login' : 'nav-profile'} onEnterPress={account} onArrowPress={focusContent} class="navigation-utility navigation-profile">
      {#snippet children()}
        {#if guest}<LogIn size="1.25rem" />{:else if avatar}<img src={avatar} alt="" />{:else}<i class="ctv-user utility-icon" aria-hidden="true"></i>{/if}
        <span class="sr-only">{guest ? 'Vincular cuenta' : profile?.name ?? 'Perfiles'}</span>
      {/snippet}
    </Focusable>
  </div>
</FocusContainer>

<style>
  :global(.tv-top-navigation) { position: absolute; inset: 0 0 auto; height: var(--topnav-h); display: flex; align-items: center; justify-content: space-between; gap: 1.3333rem; padding: 0 var(--tv-content-inset); z-index: 60; background: none; }
  .brand { height: 1.3333rem; width: 12rem; }
  nav { display: flex; align-items: center; gap: 0.4333rem; }
  :global(.navigation-tab) { position: relative; display: flex; align-items: center; justify-content: center; height: 2.25rem; padding: 0 0.9667rem; border-radius: 666rem; color: #b9b9bd; cursor: pointer; font-size: 1rem; font-weight: 550; transition: transform 120ms ease-out; white-space: nowrap; }
  :global(.navigation-tab.selected) { color: #fff; }
  :global(.navigation-tab.selected)::after { content: ''; position: absolute; bottom: -.30rem; width: 1.1667rem; height: .1250rem; border-radius: 666rem; background: #fff; }
  :global(.navigation-tab[data-focused="true"])::after { opacity: 0; }
  .utilities { display: flex; justify-content: flex-end; gap: .50rem; width: 12rem; }
  :global(.navigation-utility) { box-sizing: border-box; flex: 0 0 2.25rem; width: 2.25rem; min-width: 2.25rem; max-width: 2.25rem; height: 2.25rem; min-height: 2.25rem; max-height: 2.25rem; aspect-ratio: 1 / 1; padding: 0; display: flex; align-items: center; justify-content: center; border: .125rem solid transparent; border-radius: 50%; background: transparent; color: #d0d0d4; cursor: pointer; transition: border-color 120ms ease-out, background-color 120ms ease-out, color 120ms ease-out; }
  :global(.navigation-utility[data-focused="true"]) { border-color: #fff; color: #fff; }
  :global(.navigation-settings[data-focused="true"]) { background: #fff; color: #0a0a0a; border-color: transparent; }
  .utilities img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .utility-icon { font-size: 1.25rem; line-height: 1; }
  @media (max-width: 800px) { :global(.tv-top-navigation) { gap: 0.3333rem; } :global(.navigation-tab) { padding: 0 0.5333rem; font-size: 0.6667rem; } .brand { width: 9.3333rem; } .utilities { width: auto; gap: 0.1667rem; } }
  :global(body.playing-inmersive-trailer .tv-top-navigation) { opacity: .2; transition: opacity 150ms ease-out; }
</style>
