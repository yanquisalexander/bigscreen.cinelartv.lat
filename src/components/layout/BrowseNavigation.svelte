<script lang="ts">
  import { push, router } from 'svelte-spa-router';
  import { Home, Search, Tv, Settings, LogIn } from '@lucide/svelte';
  import { setFocus, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { authStore, svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { deassignProfile } from '@/features/auth/session';
  import { homeBrowseMemory } from '@/stores/homeBrowseMemory';

  let expanded = $state(false);

  const entries = [
    { key: 'home', label: 'Inicio', path: '/home', icon: Home },
    { key: 'search', label: 'Buscar', path: '/search', icon: Search },
    { key: 'live', label: 'En vivo', path: '/live', icon: Tv },
    { key: 'settings', label: 'Ajustes', path: '/settings', icon: Settings },
  ];

  const guest = $derived($svelteAuthStore.isGuest);
  const profile = $derived($svelteAuthStore.selectedProfile);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);
  const avatarUrl = $derived(
    profile ? `${clientEndpoint}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'}.png` : ''
  );
  const accountLabel = $derived(
    guest ? 'Vincular cuenta' : profile?.name ?? 'Perfiles'
  );

  function focusContent(direction: string) {
    if (direction !== 'right') return true;

    if (router.location.startsWith('/content/')) {
      if (doesFocusableExist('detail-hero-play')) {
        setFocus('detail-hero-play');
        return false;
      }
      if (doesFocusableExist('detail-hero')) {
        setFocus('detail-hero');
        return false;
      }
    }

    if (router.location === '/home') {
      if (homeBrowseMemory.focusKey && doesFocusableExist(homeBrowseMemory.focusKey)) {
        setFocus(homeBrowseMemory.focusKey);
        return false;
      }
      if (doesFocusableExist('hero-view-more')) {
        setFocus('hero-view-more');
        return false;
      }
      if (doesFocusableExist('home-root')) {
        setFocus('home-root');
        return false;
      }
    }

    if (router.location.startsWith('/search')) {
      if (doesFocusableExist('sk-A')) {
        setFocus('sk-A');
        return false;
      }
      if (doesFocusableExist('search-root')) {
        setFocus('search-root');
        return false;
      }
    }

    if (router.location.startsWith('/live')) {
      if (doesFocusableExist('live-cat-Guía')) {
        setFocus('live-cat-Guía');
        return false;
      }
      if (doesFocusableExist('livetv-root')) {
        setFocus('livetv-root');
        return false;
      }
    }

    if (router.location.startsWith('/settings')) {
      if (doesFocusableExist('settings-profile')) {
        setFocus('settings-profile');
        return false;
      }
      if (doesFocusableExist('settings-nav-reproduccion')) {
        setFocus('settings-nav-reproduccion');
        return false;
      }
    }

    return true;
  }

  function handleAccount() {
    const state = authStore.getState();
    if (state.isGuest || !state.tokens?.accessToken) {
      authStore.getState().exitGuestMode();
      push('/auth');
    } else {
      authStore.getState().clearProfile();
      deassignProfile(state.tokens.accessToken).catch(() => {});
      push('/select-profile');
    }
  }
</script>

<aside class:expanded aria-label="Navegación principal">
  <FocusContainer
    focusKey="topnav"
    preferredChildFocusKey="nav-home"
    saveLastFocusedChild={true}
    onUpdateHasFocusedChild={(value) => {
      expanded = value;
    }}
    class="browse-nav-root"
  >
    <nav>
      {#each entries as entry}
        {@const isActive = router.location.startsWith(entry.path)}
        <Focusable
          focusKey="nav-{entry.key}"
          onEnterPress={() => push(entry.path)}
          onArrowPress={focusContent}
          focusedClass="!bg-white !text-black font-semibold shadow-md"
          class="browse-nav-item {isActive ? 'active' : ''}"
        >
          {#snippet children()}
            <entry.icon size={24} class="shrink-0" />
            <span class="nav-label">{entry.label}</span>
          {/snippet}
        </Focusable>
      {/each}

      <div class="account-divider"></div>

      <Focusable
        focusKey={guest ? 'nav-login' : 'nav-profile'}
        onEnterPress={handleAccount}
        onArrowPress={focusContent}
        focusedClass="!bg-white !text-black font-semibold shadow-md"
        class="browse-nav-item account"
      >
        {#snippet children()}
          {#if guest}
            <LogIn size={24} class="shrink-0" />
          {:else if avatarUrl}
            <div class="avatar-wrap shrink-0">
              <img
                src={avatarUrl}
                alt={profile?.name ?? 'Perfil'}
                class="w-full h-full object-cover"
                onerror={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          {:else}
            <div class="avatar-wrap shrink-0">
              <span class="avatar-letter">{(profile?.name ?? 'P').charAt(0).toUpperCase()}</span>
            </div>
          {/if}
          <span class="nav-label">{accountLabel}</span>
        {/snippet}
      </Focusable>
    </nav>
  </FocusContainer>
</aside>

<style>
  aside {
    position: absolute;
    inset: 0 auto 0 0;
    width: clamp(3.75rem, 4.5vw, 4.75rem);
    z-index: 60;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: linear-gradient(90deg, #0a0a0a 55%, rgba(10, 10, 10, 0));
    transition: width 200ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease;
    will-change: width;
  }

  aside.expanded {
    width: clamp(15rem, 18vw, 18rem);
    background: #1C1C1E;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 6px 0 28px rgba(0, 0, 0, 0.7);
  }

  aside :global(.browse-nav-root) {
    flex: 1;
    display: flex;
    align-items: center;
  }

  nav {
    width: 100%;
    padding: 0 clamp(0.35rem, 0.5vw, 0.6rem);
    display: flex;
    flex-direction: column;
    gap: clamp(0.4rem, 0.8vh, 0.75rem);
  }

  nav :global(.browse-nav-item) {
    display: flex;
    align-items: center;
    gap: 1rem;
    height: clamp(2.75rem, 5.5vh, 3.5rem);
    padding: 0 clamp(0.6rem, 0.9vw, 1rem);
    border-radius: 0.5rem;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.6);
    font-size: clamp(1rem, 1.1vw, 1.15rem);
    font-weight: 500;
    transition: background-color 150ms ease, color 150ms ease;
  }

  nav :global(.browse-nav-item.active) {
    color: rgba(255, 255, 255, 0.9);
    background: rgba(255, 255, 255, 0.08);
  }

  nav :global(svg) {
    flex-shrink: 0;
  }

  .avatar-wrap {
    width: clamp(1.75rem, 2vw, 2.15rem);
    height: clamp(1.75rem, 2vw, 2.15rem);
    border-radius: 9999px;
    overflow: hidden;
    background: #2C2C2E;
    border: 1.5px solid rgba(255, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-letter {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .nav-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .expanded .nav-label {
    position: static;
    width: auto;
    height: auto;
    clip-path: none;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .account-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: clamp(0.6rem, 1.2vh, 1rem) clamp(0.4rem, 0.6vw, 0.8rem);
  }
</style>
