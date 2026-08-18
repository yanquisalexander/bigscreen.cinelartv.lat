<script lang="ts">
  import AppShell from '../AppShell.svelte';
  import Page from '@/pages/LiveTVScreen.svelte';

  interface Props {
    params?: Record<string, string>;
  }

  let { params }: Props = $props();
</script>

<AppShell>
  <Page {params} />
</AppShell>
