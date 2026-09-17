<script lang="ts">
  let videoEl: HTMLVideoElement | null = $bindable(null);
</script>

<div
  class="player-stage-root"
  style="position: absolute; inset: 0; z-index: 1; contain: strict; transform: translateX(0px) translateY(0px) scaleX(1) scaleY(1); aria-hidden: true; data-layer: 0;"
>
  <video
    bind:this={videoEl}
    class="player-stage-video"
    style="width: 100%; height: 100%; object-fit: contain; object-position: center; display: block;"
    tabindex="-1"
    autoplay
    playsinline
    preload="metadata"
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
