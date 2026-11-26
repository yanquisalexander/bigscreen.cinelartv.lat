<script lang="ts">
  import type { Snippet } from 'svelte';
  import Focusable from '@/components/tv/Focusable.svelte';

  interface Props {
    label: string;
    icon?: Snippet;
    variant?: 'primary' | 'secondary' | 'ghost';
    focusKey?: string;
    autoFocus?: boolean;
    onEnterPress: () => void;
    onArrowPress?: (direction: string) => boolean;
    onFocus?: () => void;
    class?: string;
  }

  let {
    label,
    icon,
    variant = 'primary',
    focusKey,
    autoFocus = false,
    onEnterPress,
    onArrowPress,
    onFocus,
    class: className = '',
  }: Props = $props();

  const variantClasses = {
    primary: 'bg-white !text-black font-bold shadow-md',
    secondary: 'bg-surface text-text-primary font-semibold border border-white/15',
    ghost: 'bg-transparent text-text-secondary font-semibold border border-white/15',
  };

  const focusedVariantClasses = {
    primary: '!bg-white !text-black',
    secondary: '!bg-white !text-black',
    ghost: '!bg-white !text-black',
  };
</script>

<Focusable
  {focusKey}
  {autoFocus}
  {onEnterPress}
  onArrowPress={onArrowPress ? (dir) => onArrowPress(dir) : undefined}
  {onFocus}
  focusedClass={focusedVariantClasses[variant]}
  class="tv-no-select tv-button-surface inline-flex items-center justify-center gap-[clamp(0.5rem,0.9vw,0.75rem)] rounded-full cursor-pointer {variant === 'primary' ? 'px-7 py-2 text-[1rem]' : 'px-6 py-2 text-[1rem]'} {variantClasses[variant]} {className}"
  playSound={true}
>
  {#snippet children()}
    {#if icon}
      <span class="inline-flex text-[1.1em] leading-none shrink-0">
        {@render icon()}
      </span>
    {/if}
    <span class="whitespace-nowrap">{label}</span>
  {/snippet}
</Focusable>
