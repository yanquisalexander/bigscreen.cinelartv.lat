<script lang="ts">
  import GeoBlockedLayout from './GeoBlockedLayout.svelte';
  import LiveTVScreen from '@/pages/LiveTVScreen.svelte';
  import { SIDEBAR_FOCUS_KEY } from './geoblockedConstants';
</script>

<GeoBlockedLayout>
  <LiveTVScreen geoblockedSidebarKey={SIDEBAR_FOCUS_KEY} />
</GeoBlockedLayout>
