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
    primary: 'bg-white !text-black font-bold',
    secondary: 'bg-surface-elevated text-white font-semibold border border-white/10',
    ghost: 'bg-transparent text-white/80 font-semibold border border-white/15',
  };

  const focusedVariantClasses = {
    primary: 'scale-[1.05] !bg-white ring-2 ring-white/40',
    secondary: 'scale-[1.05] !bg-white !text-black ring-2 ring-white/40',
    ghost: 'scale-[1.05] !bg-white/10 !text-white ring-2 ring-white/40',
  };
</script>

<Focusable
  {focusKey}
  {autoFocus}
  {onEnterPress}
  onArrowPress={onArrowPress ? (dir) => onArrowPress(dir) : undefined}
  {onFocus}
  focusedClass={focusedVariantClasses[variant]}
  class="tv-no-select inline-flex items-center justify-center gap-[clamp(0.625rem,1.2vw,0.875rem)] rounded-full cursor-pointer {variant === 'primary' ? 'px-[clamp(2.5rem,5vw,4rem)] py-[clamp(0.875rem,2vh,1.25rem)] text-[clamp(1rem,1.5vw,1.25rem)]' : 'px-[clamp(1.5rem,3vw,2.25rem)] py-[clamp(0.625rem,1.4vh,0.875rem)] text-[clamp(0.875rem,1.2vw,1rem)]'} {variantClasses[variant]} {className}"
  playSound={true}
>
  {#snippet children()}
    {#if icon}
      <span class="inline-flex text-[1.1em] leading-none">
        {@render icon()}
      </span>
    {/if}
    <span>{label}</span>
  {/snippet}
</Focusable>
