## 2025-03-30 - Canvas Backdrop Pipeline Optimization on Smart TV

**Learning:** Svelte 5 canvas backdrop rendering without URL deduplication and request cancellation triggers parallel image decoding during fast D-pad navigation, causing GPU thrashing, race conditions, and frame drops on Smart TVs.

**Action:** Always cache the active backdrop URL to skip redundant draw calls, and explicitly cancel/invalidate pending `HTMLImageElement` `onload` callbacks when target URLs change rapidly during TV remote navigation.
