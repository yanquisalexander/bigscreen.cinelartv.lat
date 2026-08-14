<script lang="ts">
  interface Props {
    description?: string;
    class?: string;
  }

  let { description, class: className = '' }: Props = $props();
</script>

{#if description}
  <section class={className}>
    <p class="text-[clamp(0.9375rem,1.3vw,1.125rem)] text-white/60 leading-[1.7] max-w-[clamp(40rem,55vw,64rem)]">
      {description}
    </p>
  </section>
{/if}
