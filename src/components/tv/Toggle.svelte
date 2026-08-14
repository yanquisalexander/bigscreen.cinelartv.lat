<script lang="ts">
  import Focusable from '@/components/tv/Focusable.svelte';

  interface Props {
    checked: boolean;
    onChange: (value: boolean) => void;
    focusKey: string;
    label: string;
    description?: string;
    onArrowPress?: (direction: string) => boolean;
  }

  let { checked, onChange, focusKey, label, description, onArrowPress }: Props = $props();
</script>

<Focusable
  {focusKey}
  onEnterPress={() => onChange(!checked)}
  onArrowPress={onArrowPress ? (dir) => onArrowPress(dir) : undefined}
  focusedClass="bg-white/10"
  class="flex items-center justify-between py-[clamp(0.75rem,1.5vh,1rem)] px-[clamp(0.75rem,1.5vw,1rem)] rounded-xl transition-colors cursor-pointer"
  playSound={true}
>
  {#snippet children()}
    <div class="flex flex-col pr-4">
      <span class="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">{label}</span>
      {#if description}
        <span class="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">{description}</span>
      {/if}
    </div>

    <div
      class="relative w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 transition-colors duration-200 {checked ? 'bg-accent' : 'bg-white/20'}"
    >
      <div
        class="absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-white shadow-md transition-all duration-200 {checked ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]'}"
      ></div>
    </div>
  {/snippet}
</Focusable>
