<script lang="ts">
  import type { Snippet } from 'svelte';
  import Focusable from './Focusable.svelte';

  interface Props {
    onEnterPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'hero';
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
    focusedClass,
    autoFocus = false,
    focusKey,
    onArrowPress,
    onFocus,
    playSound = true,
    children,
  }: Props = $props();

  let pressing = $state(false);
  let pressTimer: ReturnType<typeof setTimeout> | undefined;

  function handleEnter() {
    pressing = false;
    clearTimeout(pressTimer);
    // Doble frame para reiniciar la animación en pulsaciones consecutivas.
    requestAnimationFrame(() => requestAnimationFrame(() => { pressing = true; }));
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { pressing = false; }, 200);
    onEnterPress();
  }

  const variantStyles = {
    primary: 'bg-white text-black',
    secondary: 'glass text-white',
    ghost: 'bg-transparent text-white border border-white/20',
    icon: 'glass text-white rounded-full',
    hero: 'bg-white text-black gap-[clamp(0.5rem,1vw,0.75rem)]',
  };

  /* Inversión de relleno: la señal de foco es el color, nunca un borde. */
  const focusedStyles = {
    primary: '!bg-white !text-black',
    secondary: '!bg-white !text-black',
    ghost: '!bg-white !text-black !border-transparent',
    icon: '!bg-white !text-black',
    hero: '!bg-white !text-black',
  };

  const sizeStyles = {
    sm: 'px-[clamp(0.875rem,1.6vw,1rem)] py-[clamp(0.375rem,1vh,0.5rem)] text-[0.75rem]',
    md: 'px-[clamp(1.25rem,2.5vw,1.5rem)] py-[clamp(0.5rem,1.2vh,0.625rem)] text-[0.875rem]',
    lg: 'px-[clamp(1.5rem,3vw,2rem)] py-[clamp(0.625rem,1.4vh,0.75rem)] text-[1rem]',
  };

  const iconSize = 'w-[clamp(2.25rem,4vw,2.75rem)] h-[clamp(2.25rem,4vw,2.75rem)] p-0';
</script>

<Focusable
  onEnterPress={handleEnter}
  {onArrowPress}
  {onFocus}
  {autoFocus}
  {focusKey}
  {playSound}
  focusedClass={focusedClass ?? focusedStyles[variant]}
  class="tv-button-surface inline-flex items-center justify-center rounded-full font-semibold {variant === 'icon' ? iconSize : sizeStyles[size]} {variantStyles[variant]} {pressing ? 'tv-press-pop' : ''} {className}"
>
  {#snippet children()}
    {@render children?.()}
  {/snippet}
</Focusable>

<style>
  :global(.tv-button-surface) {
    transition:
      background-color var(--motion-fast) ease-out,
      color var(--motion-fast) ease-out,
      border-color var(--motion-fast) ease-out;
  }
</style>
