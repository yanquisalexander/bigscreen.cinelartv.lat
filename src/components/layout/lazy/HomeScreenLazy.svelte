<script lang="ts">
  import type { Component } from 'svelte';
  import AppShell from '../AppShell.svelte';
  import AmbientBackground from '@/components/home/AmbientBackground.svelte';
  import Page from '@/pages/HomeScreen.svelte';

  interface Props {
    params?: Record<string, string>;
  }

  let { params }: Props = $props();
</script>

<AmbientBackground />
<AppShell>
  <Page {params} />
</AppShell>
