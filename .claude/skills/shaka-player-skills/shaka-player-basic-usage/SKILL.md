---
name: "shaka-player-basic-usage"
description: "Helps set up and initialize Shaka Player for adaptive media streaming. Invoke when user needs to integrate Shaka Player into a web application or set up basic video playback."
---

# Shaka Player Basic Usage

This skill helps you set up and initialize Shaka Player for adaptive media streaming (DASH, HLS, MSF) in web applications.

## When to Use

Invoke this skill when:
- User wants to integrate Shaka Player into a web application
- User needs help with basic player initialization
- User asks about setting up video playback with Shaka
- User needs to configure polyfills and browser support checks

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `manifestUri` | string | Yes | URL of the DASH/HLS manifest file |
| `videoElementId` | string | No | ID of the video element (default: 'video') |
| `autoplay` | boolean | No | Enable autoplay (default: true) |
| `poster` | string | No | URL to poster image |

## Output Format

Returns a complete setup including:
- HTML structure with video element
- JavaScript initialization code
- Error handling setup
- Browser support check

## Implementation Steps

### Step 1: HTML Setup

Create an HTML page with a video element:

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- Shaka Player compiled library -->
    <script src="dist/shaka-player.compiled.js"></script>
    <!-- Your application source -->
    <script src="myapp.js"></script>
  </head>
  <body>
    <video id="video"
           width="640"
           poster="//shaka-player-demo.appspot.com/assets/poster.jpg"
           controls autoplay></video>
  </body>
</html>
```

### Step 2: JavaScript Initialization

Initialize the player with proper error handling:

```javascript
// myapp.js

const manifestUri = 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd';

function initApp() {
  // Install built-in polyfills to patch browser incompatibilities
  shaka.polyfill.installAll();

  // Check if browser supports basic APIs Shaka needs
  if (shaka.Player.isBrowserSupported()) {
    initPlayer();
  } else {
    console.error('Browser not supported!');
  }
}

async function initPlayer() {
  // Create a Player instance
  const video = document.getElementById('video');
  const player = new shaka.Player();
  await player.attach(video);

  // Attach player to window for easy console access
  window.player = player;

  // Listen for error events
  player.addEventListener('error', onErrorEvent);

  // Try to load a manifest
  try {
    await player.load(manifestUri);
    console.log('The video has now been loaded!');
  } catch (e) {
    onError(e);
  }
}

function onErrorEvent(event) {
  onError(event.detail);
}

function onError(error) {
  console.error('Error code', error.code, 'object', error);
}

document.addEventListener('DOMContentLoaded', initApp);
```

## Error Handling

Shaka Player uses a structured error system with:
- **Category**: Error category (NETWORK, TEXT, MEDIA, etc.)
- **Code**: Specific error code
- **Severity**: CRITICAL or RECOVERABLE
- **Data**: Additional error context

Always implement error listeners to handle:
- Network failures
- DRM issues
- Manifest parsing errors
- Playback errors

## Browser Support

Shaka requires:
- MediaSource Extensions (MSE)
- Encrypted Media Extensions (EME) for DRM content
- Modern browser with ES6+ support

Use `shaka.Player.isBrowserSupported()` to check compatibility before initialization.

## Common Issues

1. **Mixed Content**: Use HTTPS for manifest and segments when page is HTTPS
2. **CORS**: Ensure proper CORS headers on media servers
3. **Autoplay**: Browser policies may block autoplay without user interaction

## Related Skills

- `shaka-player-configuration`: For advanced player configuration
- `shaka-player-drm-setup`: For DRM-protected content
- `shaka-player-error-handling`: For detailed error handling strategies
