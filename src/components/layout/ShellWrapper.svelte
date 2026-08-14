<script lang="ts">
  import type { Component } from 'svelte';
  import AppShell from './AppShell.svelte';

  interface Props {
    component: Component<any>;
    params?: Record<string, string>;
  }

  let { component: PageComponent, params }: Props = $props();
</script>

<AppShell>
  <PageComponent {params} />
</AppShell>
