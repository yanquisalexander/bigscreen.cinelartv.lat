<script lang="ts">
  let { videoEl = $bindable(null) }: { videoEl: HTMLVideoElement | null } = $props();
</script>

<!--
  YouTube TV Architecture: Player container rendered as a SIBLING of the UI,
  not a CHILD. This prevents FocusContainer re-renders from affecting the video.
  Layer is stable via fixed transform values that never change.
-->
<div
  class="player-stage-root"
  aria-hidden="true"
  data-layer="0"
  tabindex="-1"
  inert
>
  <video
    bind:this={videoEl}
    class="player-stage-video"
    tabindex="-1"
    autoplay
    playsinline
    preload="none"
  ></video>
</div>

<style>
  .player-stage-root {
    position: absolute;
    inset: 0;
    z-index: 1;
    contain: strict;
    transform: translateX(0px) translateY(0px) scaleX(1) scaleY(1);
    pointer-events: none;
  }

  .player-stage-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    display: block;
    pointer-events: none;
  }
</style>
