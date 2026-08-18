<script lang="ts">
  import type { Component } from 'svelte';
  import AppShell from '../AppShell.svelte';
  import Page from '@/pages/HomeScreen.svelte';

  interface Props {
    params?: Record<string, string>;
  }

  let { params }: Props = $props();
</script>

<AppShell>
  <Page {params} />
</AppShell>
