<script lang="ts">
  import type { Snippet } from 'svelte';
  import Focusable from './Focusable.svelte';

  interface Props {
    onEnterPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    class?: string;
    focusedClass?: string;
    autoFocus?: boolean;
    focusKey?: string;
    onArrowPress?: (direction: string) => boolean;
    onFocus?: () => void;
    playSound?: boolean;
    children?: Snippet;
  }

  let {
    onEnterPress,
    variant = 'primary',
    size = 'md',
    class: className = '',
    focusedClass = 'scale-105 shadow-lg shadow-black/40',
    autoFocus = false,
    focusKey,
    onArrowPress,
    onFocus,
    playSound = false,
    children,
  }: Props = $props();

  const variantStyles = {
    primary: 'bg-white text-black',
    secondary: 'glass text-white',
    ghost: 'bg-transparent text-white border border-white/20',
  };

  const sizeStyles = {
    sm: 'px-[clamp(0.875rem,1.6vw,1rem)] py-[clamp(0.375rem,1vh,0.5rem)] text-[clamp(0.6875rem,0.95vw,0.75rem)]',
    md: 'px-[clamp(1.25rem,2.5vw,1.5rem)] py-[clamp(0.5rem,1.2vh,0.625rem)] text-[clamp(0.8125rem,1.1vw,0.875rem)]',
    lg: 'px-[clamp(1.5rem,3vw,2rem)] py-[clamp(0.625rem,1.4vh,0.75rem)] text-[clamp(0.875rem,1.25vw,1rem)]',
  };
</script>

<Focusable
  {onEnterPress}
  {onArrowPress}
  {onFocus}
  {autoFocus}
  {focusKey}
  {playSound}
  {focusedClass}
  class="inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 ease-out {variantStyles[variant]} {sizeStyles[size]} {className}"
>
  {#snippet children()}
    {@render children?.()}
  {/snippet}
</Focusable>
