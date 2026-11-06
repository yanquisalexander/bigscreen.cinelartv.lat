<script lang="ts">
  let {
    videoEl = $bindable(null),
    settingsMode = false,
  }: { videoEl: HTMLVideoElement | null; settingsMode?: boolean } = $props();
</script>

<!--
  YouTube TV Architecture: Player container rendered as a SIBLING of the UI,
  not a CHILD. This prevents FocusContainer re-renders from affecting the video.
  The only transform change is settingsMode: the stage shrinks to the left
  (GPU transform, no re-layout/re-decode) while the settings dock occupies
  the right side. In LITE quality there is no transition.
-->
<div
  class="player-stage-root"
  class:settings-mode={settingsMode}
  aria-hidden="true"
  data-layer="0"
  tabindex="-1"
  inert
>
  <div class="player-stage-frame">
    <video
      bind:this={videoEl}
      class="player-stage-video"
      tabindex="-1"
      autoplay
      playsinline
      preload="none"
    ></video>
  </div>
</div>

<style>
  .player-stage-root {
    position: absolute;
    inset: 0;
    z-index: 1;
    contain: strict;
    transform: translateX(0px) translateY(0px) scaleX(1) scaleY(1);
    transform-origin: left center;
    pointer-events: none;
    transition: transform 0.35s cubic-bezier(0.2, 0, 0, 1);
    will-change: transform;
  }

  /* Estilo YouTube TV: video achicado a la izquierda, menú a la derecha.
     Sin anillo: el fondo es el mismo #0a0a0a de toda la app, tanto en el
     área del video como en el dock. */
  .player-stage-root.settings-mode {
    transform: scale(0.58);
    background: #0a0a0a;
  }

  .player-stage-frame {
    position: absolute;
    inset: 0;
  }

  /* El radio va en un contenedor normal con overflow:hidden: sobre el
     <video> (elemento reemplazado) varios WebView de TV no recortan el
     contenido con border-radius y las esquinas se ven cuadradas. */
  .player-stage-root.settings-mode .player-stage-frame {
    border-radius: 1.5rem;
    overflow: hidden;
  }

  .player-stage-root.settings-mode .player-stage-video {
    background: #0a0a0a;
  }

  /* En LITE no hay transición: el cambio es instantáneo */
  :global(body.app-quality-lite) .player-stage-root {
    transition: none;
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
