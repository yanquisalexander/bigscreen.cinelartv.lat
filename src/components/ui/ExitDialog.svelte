<script lang="ts">
  import { onMount, tick } from 'svelte';
  import FocusContainer from '@/components/tv/FocusContainer.svelte';
  import Focusable from '@/components/tv/Focusable.svelte';
  import { setFocus, getCurrentFocusKey, doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation-core';

  interface Props {
    onConfirm: () => void;
    onCancel: () => void;
    fallbackFocusKey?: string;
  }

  let { onConfirm, onCancel, fallbackFocusKey = 'nav-home' }: Props = $props();
  const previousFocusKey = getCurrentFocusKey();
  const openedOnRoute = window.location.hash;
  let restoreOnClose = true;

  onMount(() => {
    let disposed = false;
    void tick().then(() => {
      if (!disposed && doesFocusableExist('exit-cancel')) setFocus('exit-cancel');
    });

    return () => {
      disposed = true;
      if (!restoreOnClose) return;
      // Let Svelte unregister the dialog and Norigin finish its queued removals.
      void tick().then(() => requestAnimationFrame(() => {
        if (window.location.hash !== openedOnRoute || doesFocusableExist('exit-dialog')) return;
        const current = getCurrentFocusKey();
        if (current && !current.startsWith('exit-') && doesFocusableExist(current)) return;
        const target = [previousFocusKey, fallbackFocusKey].find(key => key && doesFocusableExist(key));
        if (target) setFocus(target);
      }));
    };
  });
</script>

<div role="dialog" aria-modal="true" aria-labelledby="exit-dialog-title" class="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-bg">
  <FocusContainer
    focusKey="exit-dialog"
    preferredChildFocusKey="exit-cancel"
    focusable={false}
    isFocusBoundary={true}
    autoRestoreFocus={false}
    trackChildren={true}
    class="flex flex-col items-center text-center w-[clamp(420px,55vw,720px)]"
  >
    <h2 id="exit-dialog-title" class="text-white text-[3rem] font-semibold leading-tight">
      Salir de CinelarTV
    </h2>
    <p class="text-text-secondary text-[1.25rem] mt-[clamp(1rem,2vh,1.5rem)] max-w-[clamp(420px,50vw,600px)] leading-relaxed">
      ¿Quieres cerrar la aplicación? Se detendrá cualquier reproducción en curso.
    </p>
    <div class="flex items-center gap-[clamp(1rem,2vw,1.5rem)] mt-[clamp(2.5rem,6vh,4rem)]">
      <Focusable
        onEnterPress={onCancel}
        focusKey="exit-cancel"
        focusedClass="!bg-white !text-black scale-105"
        class="h-[clamp(3rem,5.5vh,3.75rem)] px-[clamp(2.5rem,5vw,4rem)] rounded-full bg-white/10 text-white text-[1.25rem] font-medium transition-all duration-200 cursor-pointer inline-flex items-center"
        playSound={true}
      >
        Cancelar
      </Focusable>
      <Focusable
        onEnterPress={() => { restoreOnClose = false; onConfirm(); }}
        focusKey="exit-confirm"
        focusedClass="!bg-white !text-black scale-105"
        class="h-[clamp(3rem,5.5vh,3.75rem)] px-[clamp(2.5rem,5vw,4rem)] rounded-full bg-live text-white text-[1.25rem] font-medium transition-all duration-200 cursor-pointer inline-flex items-center"
        playSound={true}
      >
        Salir
      </Focusable>
    </div>
    <p class="text-text-tertiary text-[0.95rem] mt-[clamp(2rem,4vh,3rem)]">
      Pulsa ATRÁS para seguir viendo CinelarTV
    </p>
  </FocusContainer>
</div>
