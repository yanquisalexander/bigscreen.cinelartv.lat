<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';

  interface Props {
    description?: string;
    class?: string;
  }

  let { description, class: className = '' }: Props = $props();
  let expanded = $state(false);
</script>

{#if description}
  <section class={className}>
    <p
      class="text-[clamp(0.9375rem,1.3vw,1.125rem)] text-white/60 leading-[1.7] max-w-[clamp(40rem,55vw,64rem)] transition-all duration-300"
      class:line-clamp-3={!expanded}
    >
      {description}
    </p>
    <button
      class="flex items-center gap-[0.35em] mt-[0.625rem] text-accent text-[clamp(0.75rem,1vw,0.875rem)] font-semibold cursor-pointer bg-transparent border-0 p-0 hover:opacity-80 transition-opacity"
      onclick={() => expanded = !expanded}
    >
      {expanded ? 'Ver menos' : 'Ver más'}
      <ChevronDown
        size={14}
        class="transition-transform duration-300"
        style="transform: {expanded ? 'rotate(180deg)' : 'rotate(0)'};"
      />
    </button>
  </section>
{/if}
