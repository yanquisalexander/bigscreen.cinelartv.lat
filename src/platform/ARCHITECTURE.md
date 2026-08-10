# CinelarTV Bridge Architecture

## Overview

The CinelarTV platform abstraction provides a versioned, backward-compatible bridge between the React web application and native TV runtimes (Android TV, Cobalt/Starboard, browsers).

```
                         CinelarTV React
                               |
                               v
                     Cinelar Platform API
                               |
                    +----------+----------+
                    |                     |
                Bridge v0             Bridge v1
                 adapter               adapter
                    |                     |
              Existing apps        New native apps
                                          |
                         +----------------+----------------+
                         |                                 |
                      Android                           Cobalt
```

## Bridge v0 Contract (Frozen)

Bridge v0 is the legacy protocol currently used by production native applications. It is **frozen and immutable**.

### V0 Interface

```ts
interface CinelarNative {
  getPlatform?: () => string;
  getAppVersion?: () => string;
  getDeviceModel?: () => string;
  getDeviceName?: () => string;
  getModel?: () => string;
  getNativeVersion?: () => string;
  getNativeVersionName?: () => string;
  exitApp?: () => void;
  openUrl?: (url: string) => void;
  syncContinueWatching?: (itemsJson: string) => boolean;
  addContinueWatching?: (itemJson: string) => boolean;
  clearContinueWatching?: () => boolean;
  syncRecommendations?: (itemsJson: string) => boolean;
  syncGenericRecommendations?: () => boolean;
  onProfileChanged?: () => boolean;
  onLogout?: () => boolean;
  supportsLiveTV?: () => boolean;
  playLiveChannel?: (channelJson: string) => boolean;
  prefersNative?: () => boolean;
  launchNativePlayer?: (json: string) => void;
  onNativePlayerFinished?: () => void;
  hasNativeUpdates?: () => boolean;
  performNativeUpdate?: () => void;
}
```

### Why v0 is frozen

- Production Android TV native apps inject this exact interface into the WebView.
- Changing any method signature, argument type, or return value breaks those apps.
- JSON payloads (e.g., `JSON.stringify(items)`) must remain exactly as-is.
- We cannot assume all installed native apps can be updated simultaneously.

### Absolutely forbidden changes to v0

- Renaming existing methods
- Changing argument types
- Changing JSON payload shapes
- Changing the meaning of existing fields
- Requiring new methods from existing native apps
- Replacing v0 methods with new ones
- Removing v0 methods
- Making v0 depend on v1
- Changing return value semantics
- Introducing mandatory handshakes that old apps cannot answer

## Version Negotiation

The platform detects which bridge is available at startup:

```ts
function detectBridgeVersion(): 'v1' | 'v0' | 'none' {
  if (window.__CINELAR_V1_BRIDGE__) return 'v1';
  if (window.CinelarNative) return 'v0';
  return 'none';
}
```

Decision flow:

```
No bridge
    → WebAdapter (browser fallback)

Bridge v0 only (window.CinelarNative)
    → V0Adapter

Bridge v1 (window.__CINELAR_V1_BRIDGE__)
    → V1Adapter

Future Bridge v2
    → Compatible capabilities / fallback
```

Version negotiation itself is never a breaking change. Old native apps that only expose `window.CinelarNative` continue to work through the V0 adapter.

## Capability Discovery

Each adapter reports its capabilities:

```ts
interface PlatformCapabilities {
  version: number;
  platform: string;
  device: DeviceCapabilities;
  navigation: NavigationCapabilities;
  media: MediaCapabilities;
  tv: TVCapabilities;
  account: AccountCapabilities;
  updates: UpdateCapabilities;
}
```

Example:

```ts
const platform = getPlatformInstance();

if (platform.capabilities.media.liveTV) {
  // Live TV is available
}

if (platform.capabilities.tv.continueWatching) {
  // Continue watching sync is supported
}
```

Capabilities degrade gracefully:

| Bridge Version | Capabilities |
|----------------|-------------|
| V0 (Android TV) | Full v0 capabilities based on method presence |
| V1 | All capabilities enabled |
| Web (no bridge) | Only navigation.openUrl |

## Platform API

The application-facing API is organized by domain:

```ts
interface Platform {
  version: number;
  capabilities: PlatformCapabilities;
  device: PlatformDevice;
  navigation: PlatformNavigation;
  media: PlatformMedia;
  tv: PlatformTV;
  account: PlatformAccount;
  updates: PlatformUpdates;
}
```

### Usage

```ts
import { getPlatformInstance } from '@/platform';

const platform = getPlatformInstance();

// Device info
const info = platform.device.getInfo();

// Navigation
platform.navigation.openUrl('https://example.com');
platform.navigation.exitApp();

// Media
platform.media.playContent({ contentId, episodeId, accessToken, clientEndpoint });
platform.media.playLive(channelInfo);
platform.media.onFinished(() => { /* navigate home */ });

// TV integrations
platform.tv.continueWatching.sync(items);
platform.tv.recommendations.sync(items);

// Account
platform.account.notifyLogout();
platform.account.notifyProfileChanged();

// Updates
if (platform.updates.hasUpdates()) {
  platform.updates.performUpdate();
}
```

## V0 Adapter

The V0 adapter wraps `window.CinelarNative` and translates the modern Platform API into legacy calls.

### Example: Continue Watching

```ts
// Modern API
platform.tv.continueWatching.sync(items);

// V0 Adapter internally does:
window.CinelarNative?.syncContinueWatching(JSON.stringify(items));
```

The V0 adapter preserves the exact JSON payload format expected by existing native apps. No versioned wrapper is added around v0 payloads.

### Example: Native Player

```ts
// Modern API
platform.media.playContent(data);

// V0 Adapter internally does:
window.CinelarNative?.launchNativePlayer(JSON.stringify(data));
```

### Example: Events

```ts
// V0 Adapter registers onNativePlayerFinished callback
// and re-emits through the typed event system
platformEvents.emit('media.finished', undefined);
```

## V1 Protocol

Bridge v1 uses structured, versioned messages:

```ts
interface BridgeMessage<T = unknown> {
  version: 1;
  type: string;
  requestId?: string;
  payload?: T;
}
```

Example:

```json
{
  "version": 1,
  "type": "media.play",
  "requestId": "r-abc123",
  "payload": {
    "contentId": "movie-123",
    "episodeId": "episode-4",
    "accessToken": "...",
    "clientEndpoint": "..."
  }
}
```

### Message Types

| Category | Message Type | Description |
|----------|-------------|-------------|
| Media | `media.play` | Launch native player |
| Media | `media.playLive` | Play live channel |
| Media | `media.prefersNative` | Query native preference |
| Media | `media.supportsLiveTV` | Query live TV support |
| TV | `tv.continueWatching.sync` | Sync continue watching items |
| TV | `tv.continueWatching.add` | Add single continue watching item |
| TV | `tv.continueWatching.clear` | Clear continue watching data |
| TV | `tv.recommendations.sync` | Sync recommendation items |
| TV | `tv.recommendations.syncGeneric` | Trigger generic recommendations |
| Account | `account.profileChanged` | Notify profile change |
| Account | `account.logout` | Notify logout |
| Device | `device.info` | Get device information |
| Device | `device.platform` | Get platform identifier |
| Navigation | `navigation.openUrl` | Open URL |
| Navigation | `navigation.exitApp` | Exit application |
| Updates | `updates.has` | Check for updates |
| Updates | `updates.perform` | Trigger update |

### V1 Bridge Interface

New native apps implement this interface:

```ts
interface V1Bridge {
  send(message: BridgeMessage): void;
  onRequest(handler: (message: BridgeMessage) => void): void;
}
```

The bridge is injected as:

```ts
window.__CINELAR_V1_BRIDGE__ = { send, onRequest };
```

## Event System

The platform uses a typed event emitter:

```ts
import { platformEvents } from '@/platform';

// Subscribe to events
const unsubscribe = platformEvents.on('media.finished', () => {
  navigate('/home');
});

// One-time subscription
platformEvents.once('bridge.connected', ({ version }) => {
  console.log(`Bridge v${version} connected`);
});

// Cleanup
unsubscribe();
```

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `media.finished` | `void` | Native player finished playback |
| `media.error` | `{ code?, message? }` | Player error |
| `account.profileChanged` | `void` | Profile changed |
| `account.loggedOut` | `void` | User logged out |
| `bridge.connected` | `{ version: number }` | Bridge connected |
| `bridge.disconnected` | `void` | Bridge disconnected |

## Error Model

Bridge v1 uses structured results:

```ts
type BridgeResult<T = void> =
  | { ok: true; value?: T }
  | { ok: false; code: BridgeErrorCode; message?: string };

type BridgeErrorCode =
  | 'UNSUPPORTED'
  | 'NOT_AVAILABLE'
  | 'INVALID_ARGUMENT'
  | 'TIMEOUT'
  | 'NATIVE_ERROR'
  | 'PROTOCOL_ERROR';
```

V0 adapter wraps boolean/void returns as `BridgeResult` where appropriate.

## Backward Compatibility Matrix

| WebApp | Native | Expected Behavior |
|--------|--------|-------------------|
| old | v0 | Unchanged (v0 contract) |
| **new** | **v0** | **V0 adapter — identical behavior** |
| old | v1 | Old WebApp ignores `__CINELAR_V1_BRIDGE__` |
| **new** | **v1** | **V1 adapter — structured protocol** |
| **new** | **none** | **WebAdapter — browser fallback** |
| **new** | **partial v1** | **Capability fallback** |
| future | old v0 | V0 adapter still works |

### Key property

> A new WebApp continues working with old native apps.

## Migration Strategy

### Phase 0 (current)
```
Existing production apps
        ↓
Bridge v0
        ↓
UNCHANGED
```

### Phase 1 (this change)
```
New WebApp
        ↓
Platform API
        ↓
V0 Adapter
        ↓
Existing apps
```

### Phase 2
```
New native apps
        ↓
Bridge v1
        ↓
Platform API
```

### Phase 3
```
Cobalt / other runtimes
        ↓
Bridge v1 implementation
        ↓
Same Platform API
```

## Adding a New Capability

1. Add the capability type to `PlatformCapabilities` in `src/platform/types.ts`
2. Add the method to the relevant domain interface (e.g., `PlatformMedia`)
3. Implement in `V0Adapter` (may be a no-op if v0 doesn't support it)
4. Implement in `V1Adapter` with proper message type
5. Implement in `WebAdapter` (usually no-op or browser fallback)
6. Use in React via `getPlatformInstance().domain.method()`

## Deprecation Policy

- v0 methods are never removed while production native apps depend on them
- v0 is deprecated when all production native apps have migrated to v1
- Deprecated methods remain functional but log console warnings in development
- Breaking changes only happen in new bridge versions (v2, v3, etc.)

## Cobalt / Starboard Readiness

The architecture is ready for Cobalt integration:

```ts
// Future: src/platform/adapter/cobalt.ts
export function createCobaltAdapter(): Platform {
  return {
    version: 1,
    capabilities: { /* Cobalt-specific capabilities */ },
    device: { /* Cobalt device info */ },
    navigation: { /* Cobalt navigation */ },
    media: { /* Cobalt media playback */ },
    tv: { /* Cobalt TV integrations */ },
    account: { /* Cobalt account management */ },
    updates: { /* Cobalt update mechanism */ },
  };
}
```

### What's platform-agnostic

- All domain interfaces (device, navigation, media, tv, account, updates)
- Event system
- Capability discovery
- Error model
- V1 protocol

### What remains platform-specific

- V0 adapter implementation (wraps Android-specific `window.CinelarNative`)
- V1 adapter implementation (protocol transport)
- Cobalt adapter implementation (Cobalt-specific APIs)

### Integration point

```ts
// Detection would extend to:
function detectBridgeVersion(): 'v1' | 'v0' | 'cobalt' | 'none' {
  if (window.__CINELAR_V1_BRIDGE__) return 'v1';
  if (window.__CINELAR_COBALT__) return 'cobalt';
  if (window.CinelarNative) return 'v0';
  return 'none';
}
```

## File Structure

```
src/platform/
├── index.ts              # Platform singleton, version detection
├── types.ts              # All TypeScript interfaces
├── events.ts             # Typed event emitter
├── protocol/
│   └── v1.ts             # V1 message types and bridge interface
└── adapter/
    ├── v0.ts             # V0 adapter (wraps window.CinelarNative)
    ├── v1.ts             # V1 adapter (structured protocol)
    └── web.ts            # Web fallback adapter

src/services/
└── NativeBridge.ts       # Backward-compatible re-exports
```

## Security Considerations

- V1 protocol uses structured messages with explicit types, making validation easier
- Request IDs prevent message replay within a session
- `openUrl` validates URLs in the V1 adapter (future: allowlist)
- `launchNativePlayer` payload is typed and validated
- Bridge methods are only accessible through the platform API, not directly from React
- Origin restrictions apply at the WebView level
