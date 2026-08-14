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
    secondary: 'bg-white/[0.08] text-white font-semibold ring-1 ring-white/10',
    ghost: 'bg-transparent text-white/80 font-semibold ring-1 ring-white/15',
  };

  const focusedVariantClasses = {
    primary: 'scale-[1.06] !bg-accent !text-white ring-2 ring-white',
    secondary: 'scale-[1.06] !bg-white !text-black ring-2 ring-white',
    ghost: 'scale-[1.06] !bg-white/20 !text-white ring-2 ring-white',
  };
</script>

<Focusable
  {focusKey}
  {autoFocus}
  {onEnterPress}
  onArrowPress={onArrowPress ? (dir) => onArrowPress(dir) : undefined}
  {onFocus}
  focusedClass={focusedVariantClasses[variant]}
  class="tv-no-select inline-flex items-center justify-center gap-[clamp(0.5rem,1vw,0.75rem)] rounded-full cursor-pointer {variant === 'primary' ? 'px-[clamp(2rem,4vw,3.25rem)] py-[clamp(0.75rem,1.7vh,1.0625rem)] text-[clamp(0.9375rem,1.35vw,1.125rem)]' : 'px-[clamp(1.375rem,2.6vw,2rem)] py-[clamp(0.625rem,1.4vh,0.875rem)] text-[clamp(0.8125rem,1.15vw,0.9375rem)]'} {variantClasses[variant]} {className}"
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
