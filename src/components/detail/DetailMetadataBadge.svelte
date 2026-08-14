<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    accent?: boolean;
    class?: string;
    children?: Snippet;
  }

  let { accent = false, class: className = '', children }: Props = $props();
</script>

<span
  class="inline-flex items-center px-[clamp(0.5rem,1vw,0.75rem)] py-[clamp(0.125rem,0.4vh,0.25rem)] rounded text-[clamp(0.75rem,1.1vw,0.875rem)] font-medium {accent ? 'bg-accent-light/20 text-accent-light' : 'bg-white/10 text-text-secondary'} {className}"
>
  {@render children?.()}
</span>
