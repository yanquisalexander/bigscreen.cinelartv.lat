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
  focusStyle="subtle"
  focusedClass="bg-white/10"
  class="flex items-center justify-between py-[clamp(0.75rem,1.5vh,1rem)] px-[clamp(0.75rem,1.5vw,1rem)] rounded-xl cursor-pointer"
  playSound={true}
>
  {#snippet children()}
    <div class="flex flex-col pr-4">
      <span class="text-white text-[1.05rem] font-medium">{label}</span>
      {#if description}
        <span class="text-text-secondary text-[0.85rem] mt-0.5">{description}</span>
      {/if}
    </div>

    <div
      class="relative w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 {checked ? 'bg-white' : 'bg-white/25'}"
      style="transition: background-color var(--motion-base) ease-out;"
    >
      <div
        class="absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full shadow-md {checked ? 'left-[clamp(1.4rem,2.3vw,1.7rem)] bg-black' : 'left-[clamp(0.2rem,0.35vw,0.3rem)] bg-white'}"
        style="transition: left var(--motion-base) var(--ease-spring), background-color var(--motion-base) ease-out;"
      ></div>
    </div>
  {/snippet}
</Focusable>
