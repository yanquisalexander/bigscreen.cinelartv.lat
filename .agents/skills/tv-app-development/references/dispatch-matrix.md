# Dispatch Matrix

## Common Request Bundles

### Build new catalog screen
1. ten-foot-information-architecture
2. spatial-navigation-engineering
3. leanback-data-layer-robustness
4. tv-performance-profiling
5. certification-aware-qa

### Fix Back button bugs
1. input-abstraction-layer
2. spatial-navigation-engineering
3. certification-aware-qa

### Launch TV search improvements
1. tv-search-ux
2. input-abstraction-layer
3. spatial-navigation-engineering
4. leanback-data-layer-robustness
5. certification-aware-qa

### Implement TV login hardening
1. auth-session-resilience
2. input-abstraction-layer
3. spatial-navigation-engineering
4. certification-aware-qa

### Add monetization surface
1. personalization-upsell-decisioning
2. ten-foot-information-architecture
3. spatial-navigation-engineering
4. certification-aware-qa

## Platform Guardrails
- Samsung/LG/Hisense: validate remote key mapping and OSK transitions.
- Xbox/PS5: validate gamepad parity, repeat rate, and Back semantics.
- All platforms: verify suspend/resume focus restore and route continuity.

## Release Readiness Gate
- Focus traversal pass on all required screens.
- Back behavior pass for modal, route, and app-level exit rules.
- Auth and session recovery pass for expiry and timeout conditions.
- Search flow pass for keyboard transitions and stale request handling.
- Performance budget check for TTI, focus latency, and rail FPS.
