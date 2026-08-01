---
name: "shaka-player-skills"
description: "A comprehensive skill library for Shaka Player development, providing guidance on basic usage, configuration, DRM, offline storage, plugin development, UI customization, and more. Invoke when working with Shaka Player in any capacity."
---

# Shaka Player Skills Library

A comprehensive skill library for Shaka Player development, providing expert guidance on all aspects of adaptive media streaming.

## Overview

This skill library provides structured guidance for developing with Shaka Player, an open-source JavaScript library for adaptive media playback (DASH, HLS, MSF). It covers everything from basic setup to advanced customization.

## When to Use

Invoke this skill library when:
- Setting up Shaka Player in a web application
- Configuring streaming, buffering, or ABR settings
- Implementing DRM protection (Widevine, PlayReady, FairPlay)
- Developing offline playback capabilities
- Creating custom plugins or extensions
- Customizing the player UI
- Handling errors and implementing retry logic
- Optimizing build size and performance

### 1. Basic Usage
**Skill**: `shaka-player-basic-usage`  
**Path**: `./shaka-player-basic-usage/SKILL.md`

Helps set up and initialize Shaka Player for adaptive media streaming. Covers HTML setup, JavaScript initialization, error handling, and browser support.

**Use when**:
- Integrating Shaka Player into a web application
- Setting up basic video playback
- Configuring polyfills and browser support checks

### 2. Configuration
**Skill**: `shaka-player-configuration`  
**Path**: `./shaka-player-configuration/SKILL.md`

Configures Shaka Player settings for streaming, buffering, ABR, and language preferences.

**Use when**:
- Customizing player behavior
- Optimizing buffering or streaming settings
- Setting language preferences
- Enabling low latency streaming

### 3. DRM Setup
**Skill**: `shaka-player-drm-setup`  
**Path**: `./shaka-player-drm-setup/SKILL.md`

Configures DRM systems (Widevine, PlayReady, FairPlay) for protected content playback.

**Use when**:
- Playing DRM-protected content
- Configuring license servers
- Setting up Clear Key for testing
- Configuring robustness settings

### 4. Error Handling
**Skill**: `shaka-player-error-handling`  
**Path**: `./shaka-player-error-handling/SKILL.md`

Implements comprehensive error handling including error codes, severity levels, and retry mechanisms.

**Use when**:
- Handling player errors
- Implementing error recovery strategies
- Customizing retry behavior
- Handling streaming failures

### 5. Offline Storage
**Skill**: `shaka-player-offline-storage`  
**Path**: `./shaka-player-offline-storage/SKILL.md`

Implements offline storage and playback for DASH/HLS content.

**Use when**:
- Downloading content for offline playback
- Managing stored content
- Implementing offline DRM support

### 6. Plugin Development
**Skill**: `shaka-player-plugin-development`  
**Path**: `./shaka-player-plugin-development/SKILL.md`

Develops custom plugins including manifest parsers, text parsers, networking plugins, and ABR managers.

**Use when**:
- Creating custom manifest parsers
- Developing text/caption parsers
- Implementing custom networking plugins
- Creating custom ABR managers

### 7. UI Customization
**Skill**: `shaka-player-ui-customization`  
**Path**: `./shaka-player-ui-customization/SKILL.md`

Comprehensive guide for Shaka Player UI customization including DOM structure, configuration, custom components, CSS theming, localization, and building custom UI from scratch.

**Use when**:
- Setting up the UI library (declarative or programmatic)
- Customizing player controls and configuration
- Developing custom buttons and controls
- Applying CSS variables and theming
- Enabling Chromecast or VR support
- Localizing the player UI
- Building custom UI from scratch
- Implementing custom seek bar or context menu

### 8. Build Customization
**Skill**: `shaka-player-build-customization`  
**Path**: `./shaka-player-build-customization/SKILL.md`

Customizes Shaka Player builds to optimize bundle size and include only needed features.

**Use when**:
- Reducing bundle size
- Excluding unused features
- Creating custom build configurations
- Adding custom plugins to the build

### 9. Subtitle Development
**Skill**: `shaka-player-subtitle-development`  
**Path**: `./shaka-player-subtitle-development/SKILL.md`

Comprehensive guide for Shaka Player subtitle development including format support, loading, styling, positioning, and multi-language switching.

**Use when**:
- Adding or loading external subtitles
- Customizing subtitle appearance
- Implementing multi-language subtitle switching
- Handling subtitle events and errors
- Understanding supported subtitle formats

### 10. Audio Development
**Skill**: `shaka-player-audio-development`  
**Path**: `./shaka-player-audio-development/SKILL.md`

Comprehensive guide for Shaka Player audio development including multi-track audio switching, ABR control, language preferences, and audio property customization.

**Use when**:
- Implementing multi-language audio track switching
- Controlling audio quality and bandwidth
- Configuring audio language preferences
- Handling audio events and state management
- Building custom audio selection UI

### 11. Video Source Development
**Skill**: `shaka-player-video-source-development`  
**Path**: `./shaka-player-video-source-development/SKILL.md`

Comprehensive guide for video source development including bitrate control, resolution switching, ABR logic, multi-source switching, and quality selection UI.

**Use when**:
- Implementing bitrate control mechanisms
- Adding resolution switching functionality
- Configuring ABR behavior
- Switching between different video sources (HLS, DASH)
- Building quality selection UI

## Quick Start

### Basic Player Setup

```javascript
// Install polyfills
shaka.polyfill.installAll();

// Check browser support
if (shaka.Player.isBrowserSupported()) {
  const video = document.getElementById('video');
  const player = new shaka.Player();
  await player.attach(video);
  
  // Load content
  await player.load('https://example.com/manifest.mpd');
}
```

### With Configuration

```javascript
const player = new shaka.Player();
await player.attach(video);

// Configure player
player.configure({
  streaming: {
    bufferingGoal: 120
  },
  abr: {
    enabled: true
  }
});

await player.load(manifestUri);
```

### With DRM

```javascript
player.configure({
  drm: {
    servers: {
      'com.widevine.alpha': 'https://license.example.com/widevine'
    }
  }
});
```

## Skill Selection Guide

| Task | Recommended Skill |
|------|-------------------|
| Initial setup | `shaka-player-basic-usage` |
| Performance tuning | `shaka-player-configuration` |
| Content protection | `shaka-player-drm-setup` |
| Error management | `shaka-player-error-handling` |
| Offline playback | `shaka-player-offline-storage` |
| Extending functionality | `shaka-player-plugin-development` |
| UI customization | `shaka-player-ui-customization` |
| Bundle optimization | `shaka-player-build-customization` |
| Subtitle integration | `shaka-player-subtitle-development` |
| Audio track management | `shaka-player-audio-development` |
| Quality/resolution control | `shaka-player-video-source-development` |

## Related Resources

- [Shaka Player Documentation](https://shaka-player-demo.appspot.com/docs/api/index.html)
- [Shaka Player GitHub](https://github.com/shaka-project/shaka-player)
- [Shaka Player Demo](https://shaka-player-demo.appspot.com/)

## Best Practices

1. **Always implement error handling** - Never ignore errors
2. **Use debug builds during development** - Get detailed error information
3. **Configure appropriate buffering** - Balance between quality and latency
4. **Test on multiple browsers** - Ensure broad compatibility
5. **Optimize your build** - Exclude unused features to reduce bundle size
6. **Use HTTPS** - Required for EME and secure contexts
