<script lang="ts">
  import { replace } from 'svelte-spa-router';
  import { authStore, svelteAuthStore } from '@/stores/authStore';
  import CinelarLogo from '@/components/ui/CinelarLogo.svelte';

  const MIN_BOOT_DURATION = 700;
  const bootStartedAt = performance.now();

  $effect(() => {
    if (!$svelteAuthStore.isReady) return;

    const elapsed = performance.now() - bootStartedAt;
    const remaining = Math.max(0, MIN_BOOT_DURATION - elapsed);

    const timer = setTimeout(() => {
      if (!$svelteAuthStore.isAuthenticated) {
        authStore.getState().enterGuestMode();
        replace('/home');
      } else if (!$svelteAuthStore.selectedProfile) {
        replace('/select-profile');
      } else {
        replace('/home');
      }
    }, remaining);

    return () => clearTimeout(timer);
  });
</script>

<div class="relative w-full h-full overflow-hidden bg-bg">
  <!-- Logo -->
  <div class="absolute inset-0 flex items-center justify-center">
    <CinelarLogo class="w-[clamp(180px,32vw,280px)] h-auto text-white" />
  </div>

  <!-- Loading indicator -->
  <div class="animate-fade-in absolute bottom-[clamp(32px,6vh,72px)] left-0 w-full flex justify-center">
    <div class="w-[clamp(28px,3vw,48px)] aspect-square rounded-full border-[clamp(3px,0.35vw,5px)] border-white/20 border-t-white animate-spin"></div>
  </div>
</div>
