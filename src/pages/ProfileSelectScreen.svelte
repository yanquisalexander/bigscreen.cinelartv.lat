<script lang="ts">
  import { replace } from 'svelte-spa-router';
  import { authStore, svelteAuthStore } from '@/stores/authStore';
  import { svelteConfigStore } from '@/stores/configStore';
  import { selectProfile, getCurrentSession } from '@/features/auth/session';
  import { getExplore } from '@/features/content/explore';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { resolveBackdrop, resolveLogo, isBackKey } from '@/utils/helpers';
  import { exitApp } from '@/services/NativeBridge';
  import ExitDialog from '@/components/ui/ExitDialog.svelte';
  import { setFocus, getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation-core';
  import { LogOut } from '@lucide/svelte';
  import type { Profile } from '@/types/api';
  import type { ContentItem } from '@/types/content';
  import CinelarLogo from '@/components/ui/CinelarLogo.svelte';

  const ROTATION_INTERVAL = 8000;
  const FADE_MS = 800;

  let selecting = $state<string | null>(null);
  let showExitDialog = $state(false);
  let lastFocusKey: string | null = null;
  let banners = $state<ContentItem[]>([]);
  let bannerIndex = $state(0);
  let currentUrl = $state<string | null>(null);
  let blackOverlayOpacity = $state(0);
  let panDirection = $state<'left' | 'right'>('right');
  let panKey = $state(0); // Force re-render to restart animation

  let rotationTimer: ReturnType<typeof setInterval> | null = null;

  const tokens = $derived($svelteAuthStore.tokens);
  const session = $derived($svelteAuthStore.session);
  const clientEndpoint = $derived($svelteConfigStore.config.CLIENT_ENDPOINT);
  const accessToken = $derived(tokens?.accessToken ?? null);

  function resolveBannerUrl(item: ContentItem | undefined | null): string | null {
    if (!item) return null;
    return resolveBackdrop(
      item.images,
      item.banner_resized ?? item.banner ?? item.cover_resized ?? item.cover,
      clientEndpoint,
      'xlarge',
    );
  }

  let exploreRequested = false;

  $effect(() => {
    if (!accessToken || exploreRequested) return;
    exploreRequested = true;
    let cancelled = false;
    getExplore(accessToken, { img_variants: ['xlarge', 'large'] })
      .then((res) => {
        if (cancelled) return;
        const items = res.banner_content;
        if (items?.length) {
          banners = items;
          const firstUrl = resolveBannerUrl(items[0]);
          if (firstUrl) {
            currentUrl = firstUrl;
            panDirection = 'right';
          }
        }
      })
      .catch(() => {
        exploreRequested = false;
      });
    return () => {
      cancelled = true;
    };
  });

  const featuredItem = $derived(banners[bannerIndex] ?? null);

  const logoUrl = $derived.by(() => {
    if (!featuredItem) return null;
    return resolveLogo(featuredItem.images, clientEndpoint);
  });

  const genreTags = $derived.by(() => {
    if (!featuredItem) return [];
    const cats = (featuredItem as Record<string, unknown>).categories;
    if (Array.isArray(cats)) {
      return cats.slice(0, 3).map((c: { name?: string }) => c.name ?? '').filter(Boolean);
    }
    return [];
  });

  // Rotación con fade-to-black y black-to-fade
  $effect(() => {
    const count = banners.length;
    if (count <= 1) return;

    rotationTimer = setInterval(() => {
      const nextIndex = (bannerIndex + 1) % count;
      const nextUrl = resolveBannerUrl(banners[nextIndex]);

      if (!nextUrl) {
        bannerIndex = nextIndex;
        return;
      }

      // 1. Fade to black
      blackOverlayOpacity = 1;

      // 2. Después del fade out, cambiar imagen
      setTimeout(() => {
        currentUrl = nextUrl;
        panDirection = nextIndex % 2 === 0 ? 'right' : 'left';
        panKey++; // Reiniciar animación del pan
        bannerIndex = nextIndex;

        // 3. Fade from black
        setTimeout(() => {
          blackOverlayOpacity = 0;
        }, 100);
      }, FADE_MS);
    }, ROTATION_INTERVAL);

    return () => {
      if (rotationTimer) clearInterval(rotationTimer);
      rotationTimer = null;
    };
  });

  $effect(() => {
    if (!accessToken) {
      replace('/auth');
      return;
    }
    if (!session) {
      getCurrentSession(accessToken)
        .then((s) => authStore.getState().setSession(s))
        .catch(() => replace('/auth'));
    }
  });

  async function handleSelectProfile(profile: Profile) {
    if (!tokens || selecting) return;
    selecting = profile.id;
    try {
      await selectProfile(tokens.accessToken, profile.id);
      authStore.getState().setProfile(profile);
      replace('/home');
    } catch {
      selecting = null;
    }
  }

  function handleLogout() {
    authStore.getState().logout();
    replace('/auth');
  }

  function handleCancelExit() {
    showExitDialog = false;
    // Restaurar foco al elemento que lo tenía antes del diálogo
    const restoreKey = lastFocusKey;
    lastFocusKey = null;
    if (restoreKey) {
      setTimeout(() => setFocus(restoreKey), 50);
    } else if (profiles.length > 0) {
      setTimeout(() => setFocus(`profile-${profiles[0].id}`), 50);
    }
  }

  // Atrás en /select-profile → cerrar la app (si la plataforma lo permite).
  // Igual que en HomeScreen: muestra confirmación y llama a exitApp().
  $effect(() => {
    const handleBack = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (showExitDialog) {
        handleCancelExit();
        return;
      }
      lastFocusKey = getCurrentFocusKey() ?? null;
      showExitDialog = true;
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  });

  const profiles = $derived(session?.current_user?.profiles ?? []);
</script>

<div class="relative w-screen h-screen overflow-hidden bg-black flex items-center">
  <CinelarLogo class="fixed top-[clamp(1rem,3vh,1.5rem)] right-[clamp(1.5rem,4vw,2rem)] text-white h-[clamp(1.5rem,2vw,2rem)] z-[999]" />

  <!-- Capa de imagen con pan -->
  <div class="absolute inset-0 z-0 overflow-hidden bg-black">
    {#if currentUrl}
      <div
        key={panKey}
        class="absolute inset-0 {panDirection === 'right' ? 'pan-right' : 'pan-left'}"
      >
        <img
          src={currentUrl}
          alt=""
          aria-hidden="true"
          class="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    {/if}
  </div>

  <!-- Overlay negro para fade-to-black y black-to-fade -->
  <div
    class="absolute inset-0 z-[1] bg-black transition-opacity duration-[800ms] ease-in-out pointer-events-none"
    style="opacity: {blackOverlayOpacity}"
  ></div>

  <!-- Gradientes encima del overlay -->
  <div class="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10"></div>
  <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 z-10"></div>

  <!-- Layer 2: Left column profiles -->
  <div class="relative z-20 pl-[clamp(3rem,6vw,6rem)] flex flex-col justify-center gap-5 max-h-screen py-10">
    <div class="flex flex-col gap-4">
      {#each profiles as profile, index (profile.id)}
        {@const avatarUrl = `${clientEndpoint}/assets/default/avatars/${profile.avatar_id ?? 'coolCat'}.png`}
        {@const isSelecting = selecting === profile.id}

        <Focusable
          focusKey="profile-{profile.id}"
          onEnterPress={() => handleSelectProfile(profile)}
          autoFocus={index === 0}
          focusedClass="[&_img]:ring-4 [&_img]:ring-white [&_img]:opacity-100 [&_span]:text-white [&_span]:font-bold"
          class="flex items-center gap-5 transition-colors cursor-pointer group {isSelecting ? 'opacity-50' : ''}"
          playSound={true}
        >
          {#snippet children()}
            <div class="relative w-16 h-16 rounded-full shrink-0">
              <img
                src={avatarUrl}
                alt={profile.name}
                class="w-full h-full rounded-full object-cover opacity-60 transition-all ring-2 ring-transparent"
                onerror={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              {#if isSelecting}
                <div class="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                  <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
              {/if}
            </div>

            <span class="text-white/60 text-lg font-medium tracking-wide transition-colors group-hover:text-white">
              {profile.name}
            </span>
          {/snippet}
        </Focusable>
      {/each}
    </div>

    <!-- Separator & Logout -->
    <div class="pt-4 border-t border-white/10">
      <Focusable
        focusKey="logout-btn"
        onEnterPress={handleLogout}
        focusedClass="[&_div]:ring-4 [&_div]:ring-white [&_div]:bg-white/30 [&_span]:text-white [&_span]:font-bold"
        class="flex items-center gap-5 transition-colors cursor-pointer group"
        playSound={true}
      >
        {#snippet children()}
          <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center shrink-0 transition-all ring-2 ring-transparent">
            <LogOut class="w-6 h-6 text-white/40" />
          </div>
          <span class="text-white/40 text-sm font-medium tracking-wide">
            Cerrar sesión
          </span>
        {/snippet}
      </Focusable>
    </div>
  </div>

  <!-- Layer 3: Cinematic metadata (right) -->
  {#if featuredItem}
    <div class="absolute right-[clamp(3rem,6vw,6rem)] bottom-[clamp(4rem,10vh,8rem)] z-20 max-w-[clamp(20rem,30vw,32rem)] text-right">
      {#key featuredItem.id}
        <div class="animate-fade-in">
          {#if logoUrl}
            <img
              src={logoUrl}
              alt={featuredItem.title}
              class="h-[clamp(2.5rem,5vh,4rem)] max-w-[100%] object-contain object-right ml-auto mb-3 drop-shadow-2xl"
            />
          {:else}
            <h2 class="text-[clamp(1.5rem,2.5vw,2.2rem)] font-black text-white leading-tight mb-3 drop-shadow-lg tracking-tight">
              {featuredItem.title}
            </h2>
          {/if}

          <div class="flex items-center justify-end gap-2 mb-2 text-xs">
            {#if featuredItem.year}
              <span class="px-2 py-0.5 rounded bg-white/10 text-white/90 backdrop-blur-sm font-semibold">
                {featuredItem.year}
              </span>
            {/if}
            {#if featuredItem.duration}
              <span class="text-white/60">{featuredItem.duration} min</span>
            {/if}
          </div>

          {#if genreTags.length > 0}
            <p class="text-[clamp(0.75rem,1vw,0.875rem)] text-white/50 font-medium tracking-wide">
              {genreTags.join(' · ')}
            </p>
          {/if}

          {#if featuredItem.description}
            <p class="text-[clamp(0.8rem,1vw,0.9rem)] text-white/40 mt-2 line-clamp-2 leading-relaxed">
              {featuredItem.description}
            </p>
          {/if}
        </div>
      {/key}
    </div>
  {/if}
</div>

{#if showExitDialog}
  <ExitDialog
    onConfirm={() => exitApp()}
    onCancel={handleCancelExit}
  />
{/if}