<script lang="ts">
  import Focusable from '@/components/tv/Focusable.svelte';
  import { useAmbientStore } from '@/stores/ambientStore';

  interface Props {
    title: string;
    image?: string | null;
    bannerImage?: string | null;
    ambientImageUrl?: string | null;
    description?: string;
    year?: number;
    subtitle?: string;
    progress?: number;
    onEnterPress: () => void;
    onArrowPress?: (direction: string) => boolean;
    onFocus?: () => void;
    class?: string;
    focusKey?: string;
    autoFocus?: boolean;
    variant?: 'row' | 'episode';
    playSound?: boolean;
  }

  let {
    title,
    image,
    bannerImage,
    ambientImageUrl,
    description,
    year,
    subtitle,
    progress,
    onEnterPress,
    onArrowPress,
    onFocus,
    class: className = '',
    focusKey,
    autoFocus = false,
    variant = 'row',
    playSound = false,
  }: Props = $props();

  let bannerPreloaded = false;
  const isRowVariant = $derived(variant === 'row');

  function handleCardFocus() {
    if (!bannerPreloaded && bannerImage) {
      bannerPreloaded = true;
      const img = new Image();
      img.src = bannerImage;
    }
    useAmbientStore.getState().setBackdropUrl(ambientImageUrl ?? bannerImage ?? null);
    onFocus?.();
  }
</script>

<Focusable
  {focusKey}
  {autoFocus}
  {onEnterPress}
  onArrowPress={onArrowPress ? (dir) => onArrowPress(dir) : undefined}
  onFocus={handleCardFocus}
  {playSound}
  class="relative rounded-xl overflow-hidden border-2 transition-all duration-300 ease-out shrink-0 focus:outline-none snap-start {isRowVariant ? 'w-[clamp(130px,10vw,192px)] h-[clamp(195px,15vw,288px)] border-transparent opacity-80 z-0 scale-100' : 'w-[230px] h-[130px] border-transparent opacity-80 z-0 scale-100'} {className}"
  focusedClass={isRowVariant
    ? 'w-[clamp(340px,26vw,500px)] h-[clamp(195px,15vw,288px)] border-white z-20 shadow-xl shadow-black/60 scale-[1.02] opacity-100'
    : 'w-[280px] h-[158px] border-white z-20 shadow-xl scale-[1.02] opacity-100'}
>
  {#snippet children({ focused })}
    <div
      class="w-full h-full"
      style="will-change: width, transform; contain: layout paint;"
    >
      {#if isRowVariant && focused && bannerImage}
        <div class="relative w-full h-full bg-surface">
          <img
            src={bannerImage}
            alt={title}
            class="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div class="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 right-0 p-4 max-w-[80%] z-10">
            <h3 class="text-white font-bold text-base truncate">{title}</h3>
            <div class="flex gap-2 text-[11px] text-white/80 my-1">
              {#if year}<span>{year}</span>{/if}
              {#if subtitle}<span>• {subtitle}</span>{/if}
            </div>
            {#if description}
              <p class="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                {description}
              </p>
            {/if}
          </div>
        </div>
      {:else}
        <div class="relative w-full h-full bg-surface">
          {#if image}
            <img
              src={image}
              alt={title}
              class="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          {:else}
            <div class="w-full h-full flex items-center justify-center bg-surface-elevated">
              <span class="text-text-secondary text-xl font-bold">
                {title.charAt(0)}
              </span>
            </div>
          {/if}
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
          <div class="absolute bottom-0 left-0 right-0 p-2 z-10">
            <p class="text-white text-xs font-semibold truncate">{title}</p>
            {#if subtitle}
              <p class="text-text-secondary text-[10px] mt-0.5 truncate">
                {subtitle}
              </p>
            {/if}
          </div>
        </div>
      {/if}

      {#if progress != null && progress > 0}
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-20">
          <div
            class="h-full bg-primary"
            style="width: {Math.min(progress, 100)}%;"
          ></div>
        </div>
      {/if}
    </div>
  {/snippet}
</Focusable>
