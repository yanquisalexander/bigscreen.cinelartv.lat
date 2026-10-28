<script lang="ts">
  import { Play, ListVideo } from '@lucide/svelte';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import ContentPresentation from '@/components/home/ContentPresentation.svelte';
  import DetailActionButton from './DetailActionButton.svelte';
  import type { ContentDetail } from '@/types/content';
  import { isTVShow } from '@/types/content';

  let {
    content,
    clientEndpoint,
    canPlay,
    onPlay,
    onNavigateDown,
    onNavigateLeft,
    onNavigateUp,
    onPlayFocus,
  }: {
    content: ContentDetail;
    clientEndpoint?: string;
    canPlay: boolean;
    onPlay: () => void;
    onNavigateDown: (direction: string) => boolean;
    onNavigateLeft: (direction: string) => boolean;
    onNavigateUp: (direction: string) => boolean;
    onPlayFocus: () => void;
  } = $props();

  const hasEpisodes = $derived((content.seasons?.length ?? 0) > 0);

  const resumeTag = $derived.by(() => {
    const id = content.continue_watching?.episode_id;
    if (!id) return '';
    for (const [si, season] of (content.seasons ?? []).entries()) {
      const ei = season.episodes.findIndex((episode) => episode.id === id);
      if (ei >= 0) {
        return `T${si + 1} E${(season.episodes[ei].position ?? ei) + 1}`;
      }
    }
    return '';
  });

  const playLabel = $derived(
    content.continue_watching
      ? `Continuar${resumeTag ? ` · ${resumeTag}` : ''}`
      : 'Reproducir'
  );

  const progress = $derived(
    content.continue_watching?.duration
      ? Math.max(0, Math.min(100, (content.continue_watching.progress / content.continue_watching.duration) * 100))
      : 0
  );

  function handleArrow(direction: string) {
    if (direction === 'left') return onNavigateLeft(direction);
    if (direction === 'up') return onNavigateUp(direction);
    if (direction === 'down') return onNavigateDown(direction);
    return true;
  }
</script>

<FocusContainer
  focusKey="detail-hero"
  focusable={false}
  preferredChildFocusKey={canPlay ? 'detail-hero-play' : 'detail-hero-episodes'}
  saveLastFocusedChild={true}
>
  <ContentPresentation item={content} {clientEndpoint}>
    {#if canPlay}
      <div class="resume-action">
        <DetailActionButton
          focusKey="detail-hero-play"
          variant="primary"
          label={playLabel}
          onEnterPress={onPlay}
          onFocus={onPlayFocus}
          onArrowPress={handleArrow}
        >
          {#snippet icon()}
            <Play size="1.375rem" class="fill-current" />
          {/snippet}
        </DetailActionButton>
        {#if progress > 0}
          <div
            class="resume-progress"
            role="progressbar"
            aria-label="Progreso de reproducción"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style="width: {progress}%;"></span>
          </div>
        {/if}
      </div>
    {/if}

    {#if hasEpisodes}
      <DetailActionButton
        focusKey="detail-hero-episodes"
        variant="secondary"
        label="Episodios"
        onEnterPress={() => onNavigateDown('down')}
        onArrowPress={(dir) => (dir === 'left' ? onNavigateLeft(dir) : handleArrow(dir))}
      >
        {#snippet icon()}
          <ListVideo size="1.375rem" />
        {/snippet}
      </DetailActionButton>
    {/if}
  </ContentPresentation>
</FocusContainer>

<style>
  .resume-action {
    position: relative;
    display: inline-flex;
    flex-direction: column;
  }

  .resume-progress {
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    bottom: -0.5rem;
    height: 0.1875rem;
    background: rgba(255, 255, 255, 0.22);
    border-radius: 0.125rem;
    overflow: hidden;
  }

  .resume-progress span {
    display: block;
    height: 100%;
    background: #FFFFFF;
    border-radius: 0.125rem;
  }
</style>
