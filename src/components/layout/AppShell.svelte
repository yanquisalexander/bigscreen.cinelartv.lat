<script lang="ts">
  import type { Snippet } from 'svelte';
  import TopNav from './TopNav.svelte';
  import AmbientBackground from '@/components/home/AmbientBackground.svelte';

  interface Props {
    children?: Snippet;
    hideNav?: boolean;
  }

  let { children, hideNav = false }: Props = $props();
</script>

<AmbientBackground />

{#if hideNav}
  <div class="h-dvh overflow-hidden relative z-10">
    <main class="h-full w-full overflow-hidden">
      {@render children?.()}
    </main>
  </div>
{:else}
  <div class="relative h-dvh overflow-hidden z-10">
    <TopNav />
    <main class="h-full w-full overflow-hidden">
      {@render children?.()}
    </main>
  </div>
{/if}
