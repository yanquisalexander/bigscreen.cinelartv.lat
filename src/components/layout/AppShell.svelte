<script lang="ts">
  import type { Snippet } from 'svelte';
  import TVSidebar from './TVSidebar.svelte';
  import AmbientBackground from '@/components/home/AmbientBackground.svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
  let sidebarFocused = $state(false);
</script>

<AmbientBackground />

<div
  class="grid h-dvh overflow-hidden relative z-10"
  style="grid-template-columns: {sidebarFocused ? 'var(--sidebar-w, 200px) 1fr' : 'var(--sidebar-w-collapsed, 72px) 1fr'}; grid-template-areas: 'sidebar main';"
>
  <TVSidebar onFocusChange={(f) => { sidebarFocused = f; }} />
  <main class="h-full w-full overflow-hidden" style="grid-area: main;">
    {@render children?.()}
  </main>
</div>
