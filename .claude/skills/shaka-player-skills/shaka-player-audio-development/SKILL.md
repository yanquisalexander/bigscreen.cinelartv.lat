---
name: "shaka-player-audio-development"
description: "Comprehensive guide for Shaka Player audio development including multi-track audio switching, ABR control, language preferences, and audio property customization. Invoke when user needs to implement or customize audio functionality."
---

# Shaka Player Audio Development

This skill provides a comprehensive guide for implementing, controlling, and optimizing audio tracks in Shaka Player, covering multi-language audio switching, adaptive bitrate (ABR) control, and audio property customization.

## When to Use

Invoke this skill when:
- User needs to implement multi-language audio track switching
- User wants to control audio quality and bandwidth
- User needs to configure audio language preferences
- User wants to handle audio events and state management
- User asks about audio channel configuration (stereo, 5.1, 7.1)
- User needs to troubleshoot audio-related issues
- User wants to implement custom audio selection UI

## Core API Overview

| Function | Method/Property | Description |
|----------|-----------------|-------------|
| Get Audio Tracks | `player.getVariantTracks()` | Get all Variant tracks (audio+video combinations) |
| Select Track | `player.selectVariantTrack(track, clearBuffer)` | Manually switch to a specific audio/video combination |
| Select Language | `player.selectAudioLanguage(lang)` | Auto-switch audio track by language code (e.g., 'en', 'zh') |
| Get Languages | `player.getAudioLanguages()` | Return all available language codes in current manifest |
| Get Current Language | `player.getAudioLanguagesAndRoles()` | Get detailed audio language and role information |
| Mute Control | `video.muted = true/false` | Direct control via native HTML5 Video element |
| Volume Control | `video.volume = 0.0-1.0` | Direct control via native HTML5 Video element |

## Audio Track Object Properties

When working with `getVariantTracks()`, each track object contains:

```javascript
{
  id: 0,                          // Unique track identifier
  active: true,                   // Whether this track is currently active
  type: 'variant',                // Track type (always 'variant' for audio+video)
  bandwidth: 2000000,             // Total bandwidth (audio + video)
  language: 'en',                 // Audio language code (BCP 47)
  label: 'English',               // Display label
  kind: 'main',                   // Track kind ('main', 'alternative', 'commentary')
  audioBandwidth: 128000,         // Audio-only bandwidth
  videoBandwidth: 1872000,        // Video-only bandwidth
  width: 1920,                    // Video width
  height: 1080,                   // Video height
  frameRate: 30,                  // Video frame rate
  pixelAspectRatio: '1:1',        // Pixel aspect ratio
  mimeType: 'video/mp4',          // Container MIME type
  audioMimeType: 'audio/mp4',     // Audio MIME type
  videoMimeType: 'video/mp4',     // Video MIME type
  codecs: 'avc1.640028, mp4a.40.2', // Codec string
  audioCodec: 'mp4a.40.2',        // Audio codec
  videoCodec: 'avc1.640028',      // Video codec
  primary: true,                  // Whether this is the primary track
  roles: ['main'],                // DASH role values
  audioRoles: ['main'],           // Audio-specific roles
  audioSamplingRate: 48000,       // Audio sample rate (Hz)
  audioChannelsCount: 2,          // Number of audio channels
  hdrLevel: 'SDR',                // HDR level
  videoId: 1,                     // Video stream ID
  audioId: 1                      // Audio stream ID
}
```

## Multi-Track Audio Switching

Shaka Player automatically parses audio tracks from the Manifest (MPD/M3U8).

### Automatic Language Preference

Configure preferred language before loading content:

```javascript
player.configure({
  preferredAudioLanguage: 'zh-HK',    // Prefer Traditional Chinese/Cantonese
  preferredAudioChannelCount: 2       // Prefer stereo (2) or surround (6)
});

await player.load(manifestUri);
```

### Runtime Language Switching

```javascript
async function switchAudioLanguage(player, languageCode) {
  try {
    await player.selectAudioLanguage(languageCode);
    console.log(`Switched to audio language: ${languageCode}`);
  } catch (e) {
    console.error('Failed to switch audio language:', e);
  }
}

switchAudioLanguage(player, 'en');
```

### Advanced Track Selection

For fine-grained control over audio quality within the same language:

```javascript
function selectHighQualityAudioTrack(player, language) {
  const tracks = player.getVariantTracks();
  
  const languageTracks = tracks.filter(t => t.language === language);
  
  if (languageTracks.length === 0) {
    console.warn(`No tracks found for language: ${language}`);
    return;
  }
  
  const highQualityTrack = languageTracks.reduce((best, current) => {
    return (!best || current.audioBandwidth > best.audioBandwidth) ? current : best;
  }, null);
  
  if (highQualityTrack) {
    player.selectVariantTrack(highQualityTrack, true);
    console.log(`Selected high quality audio: ${highQualityTrack.audioBandwidth} bps`);
  }
}
```

### Select by Audio Properties

```javascript
function selectTrackByChannels(player, language, channelCount) {
  const tracks = player.getVariantTracks();
  
  const targetTrack = tracks.find(t => 
    t.language === language && 
    t.audioChannelsCount === channelCount
  );
  
  if (targetTrack) {
    player.selectVariantTrack(targetTrack, true);
    console.log(`Selected ${channelCount}-channel audio for ${language}`);
  } else {
    console.warn(`No ${channelCount}-channel track found for ${language}`);
  }
}

selectTrackByChannels(player, 'en', 6);
```

## Audio ABR Configuration

Shaka Player automatically switches audio quality based on network conditions.

### Disable Automatic ABR

For manual track control, disable ABR first:

```javascript
player.configure({
  abr: {
    enabled: false
  }
});
```

### Bandwidth Restrictions

Limit maximum audio bandwidth:

```javascript
player.configure({
  abr: {
    enabled: true,
    restrictions: {
      maxAudioBandwidth: 192000
    }
  }
});
```

### ABR Configuration Options

```javascript
player.configure({
  abr: {
    enabled: true,
    defaultBandwidthEstimate: 500000,
    bandwidthUpgradeTarget: 0.85,
    bandwidthDowngradeTarget: 0.95,
    switchInterval: 8,
    restrictions: {
      minWidth: 0,
      maxWidth: Infinity,
      minHeight: 0,
      maxHeight: Infinity,
      minPixels: 0,
      maxPixels: Infinity,
      minBandwidth: 0,
      maxBandwidth: Infinity,
      minAudioBandwidth: 0,
      maxAudioBandwidth: Infinity,
      minVideoBandwidth: 0,
      maxVideoBandwidth: Infinity
    }
  }
});
```

### Custom ABR Manager

Implement custom ABR logic for audio:

```javascript
class CustomAudioABRManager {
  constructor() {
    this.defaultEstimate = 500000;
  }

  configure(config) {
    this.config = config;
  }

  chooseVariant(variants) {
    const audioOnlyVariants = variants.filter(v => v.audioBandwidth > 0);
    
    audioOnlyVariants.sort((a, b) => a.audioBandwidth - b.audioBandwidth);
    
    const midIndex = Math.floor(audioOnlyVariants.length / 2);
    return audioOnlyVariants[midIndex];
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  resize(width, height) {}

  setVariants(variants) {
    this.variants = variants;
  }

  playbackRateChanged(rate) {}

  getBandwidthEstimate() {
    return this.defaultEstimate;
  }

  segmentDownloaded(deltaTimeMs, numBytes) {}

  getConfiguration() {
    return this.config;
  }
}

player.configure({
  abr: {
    enabled: true,
    factory: () => new CustomAudioABRManager()
  }
});
```

## Audio Event Listening

### Track Change Events

Monitor audio track changes for UI updates:

```javascript
player.addEventListener('variantchanged', (event) => {
  const currentTrack = event.track;
  
  console.log('Audio track changed:');
  console.log('  Language:', currentTrack.language);
  console.log('  Label:', currentTrack.label);
  console.log('  Audio Bandwidth:', currentTrack.audioBandwidth);
  console.log('  Sample Rate:', currentTrack.audioSamplingRate);
  console.log('  Channels:', currentTrack.audioChannelsCount);
  
  updateAudioTrackUI(currentTrack);
});
```

### Streaming Events

```javascript
player.addEventListener('streaming', (event) => {
  console.log('Streaming event:', event.type);
});

player.addEventListener('trackschanged', () => {
  const tracks = player.getVariantTracks();
  console.log('Available tracks updated:', tracks.length);
  
  updateTrackSelector(tracks);
});
```

### Complete Event Handler Setup

```javascript
function setupAudioEventHandlers(player) {
  player.addEventListener('variantchanged', (event) => {
    const track = event.track;
    
    document.dispatchEvent(new CustomEvent('audioTrackChanged', {
      detail: {
        language: track.language,
        label: track.label,
        bandwidth: track.audioBandwidth,
        channels: track.audioChannelsCount,
        sampleRate: track.audioSamplingRate
      }
    }));
  });
  
  player.addEventListener('trackschanged', () => {
    const tracks = player.getVariantTracks();
    const languages = [...new Set(tracks.map(t => t.language))];
    
    document.dispatchEvent(new CustomEvent('audioTracksUpdated', {
      detail: {
        tracks: tracks,
        languages: languages
      }
    }));
  });
  
  player.addEventListener('error', (event) => {
    const error = event.detail;
    if (error.category === shaka.util.Error.Category.MEDIA) {
      console.error('Media/Audio error:', error);
      handleAudioError(error);
    }
  });
}

function handleAudioError(error) {
  switch (error.code) {
    case shaka.util.Error.Code.AUDIO_CODEC_NOT_SUPPORTED:
      console.error('Audio codec not supported');
      break;
    case shaka.util.Error.Code.CONTENT_UNSUPPORTED_BY_BROWSER:
      console.error('Content not supported by browser');
      break;
    default:
      console.error('Unknown audio error:', error.code);
  }
}
```

## Audio Language and Role Management

### Get Available Languages

```javascript
function getAudioLanguageInfo(player) {
  const languages = player.getAudioLanguages();
  const languagesAndRoles = player.getAudioLanguagesAndRoles();
  
  console.log('Available languages:', languages);
  
  languagesAndRoles.forEach(item => {
    console.log(`Language: ${item.language}`);
    console.log(`  Roles: ${item.roles.join(', ')}`);
    console.log(`  Label: ${item.label}`);
  });
  
  return { languages, languagesAndRoles };
}
```

### Select by Language and Role

```javascript
function selectAudioByRole(player, language, role) {
  const tracks = player.getVariantTracks();
  
  const targetTrack = tracks.find(t => 
    t.language === language && 
    t.audioRoles && 
    t.audioRoles.includes(role)
  );
  
  if (targetTrack) {
    player.selectVariantTrack(targetTrack, true);
    console.log(`Selected ${language} audio with role: ${role}`);
  } else {
    console.warn(`No track found for ${language} with role ${role}`);
  }
}

selectAudioByRole(player, 'en', 'commentary');
selectAudioByRole(player, 'en', 'main');
```

### Language Preference Configuration

```javascript
player.configure({
  preferredAudioLanguage: 'en',
  preferredAudioLabel: 'English',
  preferredAudioChannelCount: 2,
  preferSpatialAudio: false
});
```

## Building an Audio Track Selector UI

### Basic Language Selector

```javascript
function createAudioLanguageSelector(player) {
  const languages = player.getAudioLanguages();
  const selector = document.createElement('select');
  selector.id = 'audio-language-selector';
  
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = getLanguageDisplayName(lang);
    
    const currentTracks = player.getVariantTracks();
    const currentActive = currentTracks.find(t => t.active);
    if (currentActive && currentActive.language === lang) {
      option.selected = true;
    }
    
    selector.appendChild(option);
  });
  
  selector.addEventListener('change', (e) => {
    player.selectAudioLanguage(e.target.value);
  });
  
  return selector;
}

function getLanguageDisplayName(langCode) {
  const displayNames = {
    'en': 'English',
    'zh': 'Chinese',
    'zh-Hans': 'Simplified Chinese',
    'zh-Hant': 'Traditional Chinese',
    'zh-HK': 'Cantonese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German'
  };
  return displayNames[langCode] || langCode;
}
```

### Advanced Track Selector with Quality Info

```javascript
function createAdvancedAudioSelector(player) {
  const container = document.createElement('div');
  container.className = 'audio-selector-container';
  
  const tracks = player.getVariantTracks();
  const groupedByLanguage = {};
  
  tracks.forEach(track => {
    const lang = track.language || 'unknown';
    if (!groupedByLanguage[lang]) {
      groupedByLanguage[lang] = [];
    }
    groupedByLanguage[lang].push(track);
  });
  
  Object.entries(groupedByLanguage).forEach(([lang, langTracks]) => {
    const langGroup = document.createElement('div');
    langGroup.className = 'language-group';
    
    const langLabel = document.createElement('div');
    langLabel.className = 'language-label';
    langLabel.textContent = getLanguageDisplayName(lang);
    langGroup.appendChild(langLabel);
    
    langTracks.forEach(track => {
      const trackOption = document.createElement('div');
      trackOption.className = 'track-option';
      if (track.active) {
        trackOption.classList.add('active');
      }
      
      const qualityInfo = document.createElement('span');
      qualityInfo.textContent = `${Math.round(track.audioBandwidth / 1000)}kbps`;
      if (track.audioChannelsCount > 2) {
        qualityInfo.textContent += ` (${track.audioChannelsCount}ch)`;
      }
      
      trackOption.appendChild(qualityInfo);
      
      trackOption.addEventListener('click', () => {
        player.selectVariantTrack(track, true);
        
        container.querySelectorAll('.track-option').forEach(opt => {
          opt.classList.remove('active');
        });
        trackOption.classList.add('active');
      });
      
      langGroup.appendChild(trackOption);
    });
    
    container.appendChild(langGroup);
  });
  
  return container;
}
```

## Volume and Mute Control

### Basic Volume Control

```javascript
class AudioManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.previousVolume = 1;
  }
  
  getVolume() {
    return this.video.volume;
  }
  
  setVolume(value) {
    this.video.volume = Math.max(0, Math.min(1, value));
  }
  
  mute() {
    this.previousVolume = this.video.volume;
    this.video.muted = true;
  }
  
  unmute() {
    this.video.muted = false;
    if (this.video.volume === 0) {
      this.video.volume = this.previousVolume || 0.5;
    }
  }
  
  toggleMute() {
    if (this.video.muted) {
      this.unmute();
    } else {
      this.mute();
    }
    return this.video.muted;
  }
  
  isMuted() {
    return this.video.muted;
  }
  
  fadeIn(duration = 500) {
    const steps = 20;
    const stepDuration = duration / steps;
    const targetVolume = this.previousVolume || 1;
    let currentStep = 0;
    
    this.video.volume = 0;
    this.video.muted = false;
    
    const interval = setInterval(() => {
      currentStep++;
      this.video.volume = (currentStep / steps) * targetVolume;
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);
  }
  
  fadeOut(duration = 500) {
    const steps = 20;
    const stepDuration = duration / steps;
    const startVolume = this.video.volume;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      this.video.volume = startVolume * (1 - currentStep / steps);
      
      if (currentStep >= steps) {
        clearInterval(interval);
        this.mute();
      }
    }, stepDuration);
  }
}
```

### Volume Event Handling

```javascript
function setupVolumeEvents(video, player) {
  video.addEventListener('volumechange', () => {
    const volumeInfo = {
      volume: video.volume,
      muted: video.muted
    };
    
    document.dispatchEvent(new CustomEvent('audioVolumeChanged', {
      detail: volumeInfo
    }));
    
    saveVolumePreference(volumeInfo);
  });
}

function saveVolumePreference(info) {
  try {
    localStorage.setItem('playerVolume', JSON.stringify(info));
  } catch (e) {
    console.warn('Failed to save volume preference:', e);
  }
}

function restoreVolumePreference(video) {
  try {
    const saved = localStorage.getItem('playerVolume');
    if (saved) {
      const info = JSON.parse(saved);
      video.volume = info.volume;
      video.muted = info.muted;
    }
  } catch (e) {
    console.warn('Failed to restore volume preference:', e);
  }
}
```

## Audio Channel Configuration

### Detect Audio Channel Support

```javascript
async function checkAudioSupport() {
  const support = await shaka.Player.probeSupport();
  
  console.log('Audio codec support:');
  Object.entries(support).forEach(([codec, supported]) => {
    if (codec.startsWith('audio/')) {
      console.log(`  ${codec}: ${supported ? 'Supported' : 'Not supported'}`);
    }
  });
  
  return support;
}
```

### Multi-Channel Audio Configuration

```javascript
function configureMultiChannelAudio(player, preferSurround = true) {
  player.configure({
    preferredAudioChannelCount: preferSurround ? 6 : 2
  });
}
```

### Channel Count Detection

```javascript
function getAudioChannelInfo(player) {
  const tracks = player.getVariantTracks();
  const activeTrack = tracks.find(t => t.active);
  
  if (activeTrack) {
    return {
      channels: activeTrack.audioChannelsCount || 2,
      sampleRate: activeTrack.audioSamplingRate || 48000,
      bandwidth: activeTrack.audioBandwidth
    };
  }
  return null;
}
```

## Error Handling and Recovery

### Audio-Specific Error Handling

```javascript
function handleAudioErrors(player) {
  player.addEventListener('error', (event) => {
    const error = event.detail;
    
    switch (error.code) {
      case shaka.util.Error.Code.AUDIO_CODEC_NOT_SUPPORTED:
        console.error('Audio codec not supported by browser');
        fallbackToSupportedCodec(player);
        break;
        
      case shaka.util.Error.Code.CONTENT_UNSUPPORTED_BY_BROWSER:
        console.error('Audio content not supported');
        showUserMessage('This audio format is not supported');
        break;
        
      case shaka.util.Error.Code.NO_AUDIO_TRACKS:
        console.error('No audio tracks available');
        showUserMessage('No audio available for this content');
        break;
        
      case shaka.util.Error.Code.RESTRICTIONS_CANNOT_BE_MET:
        console.error('Audio restrictions cannot be met');
        relaxAudioRestrictions(player);
        break;
    }
  });
}

function fallbackToSupportedCodec(player) {
  const tracks = player.getVariantTracks();
  const supportedTrack = tracks.find(t => 
    t.audioCodec && isCodecSupported(t.audioCodec)
  );
  
  if (supportedTrack) {
    player.selectVariantTrack(supportedTrack, true);
  }
}

function relaxAudioRestrictions(player) {
  player.configure({
    abr: {
      restrictions: {
        maxAudioBandwidth: Infinity
      }
    }
  });
}
```

### Retry Mechanism for Audio

```javascript
async function switchAudioWithRetry(player, language, maxRetries = 3) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      await player.selectAudioLanguage(language);
      console.log(`Successfully switched to ${language}`);
      return true;
    } catch (e) {
      attempts++;
      console.warn(`Attempt ${attempts} failed:`, e.message);
      
      if (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }
  
  console.error(`Failed to switch audio after ${maxRetries} attempts`);
  return false;
}
```

## Performance Optimization

### Audio Buffer Optimization

```javascript
function optimizeAudioBuffering(player, networkCondition) {
  const configs = {
    highSpeed: {
      streaming: {
        bufferingGoal: 60,
        rebufferingGoal: 5
      },
      abr: {
        restrictions: {
          minAudioBandwidth: 128000
        }
      }
    },
    mediumSpeed: {
      streaming: {
        bufferingGoal: 30,
        rebufferingGoal: 3
      },
      abr: {
        restrictions: {
          maxAudioBandwidth: 192000
        }
      }
    },
    lowSpeed: {
      streaming: {
        bufferingGoal: 15,
        rebufferingGoal: 2
      },
      abr: {
        restrictions: {
          maxAudioBandwidth: 96000
        }
      }
    }
  };
  
  player.configure(configs[networkCondition] || configs.mediumSpeed);
}
```

### Prefetch Audio Segments

```javascript
player.configure({
  streaming: {
    segmentPrefetchLimit: 3
  }
});
```

## Troubleshooting

### 1. Track Switch Stuttering

**Symptom**: Video stutters or shows black screen when switching audio tracks.

**Solution**: Control buffer clearing behavior:

```javascript
player.selectVariantTrack(track, true);

player.selectVariantTrack(track, false);
```

### 2. Low Volume Issues

**Symptom**: Audio volume is too low.

**Solution**: Shaka is a streaming parser; volume control is via the video element:

```javascript
const video = document.querySelector('video');
video.volume = 1.0;

if (video.muted) {
  video.muted = false;
}
```

### 3. Multi-Channel Audio Not Working (5.1/7.1)

**Symptom**: Surround sound not playing correctly.

**Solution**: Check browser and device support:

```javascript
async function checkSurroundSupport() {
  const support = await shaka.Player.probeSupport();
  
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const channelCount = audioContext.destination.maxChannelCount;
  
  console.log(`System supports up to ${channelCount} audio channels`);
  console.log('Dolby Digital Plus support:', support['audio/mp4; codecs="ec-3"'] || false);
  
  return channelCount >= 6;
}
```

### 4. Audio-Video Mismatch

**Symptom**: Selected audio language doesn't match video content.

**Solution**: Verify track associations:

```javascript
function validateTrackAssociations(player) {
  const tracks = player.getVariantTracks();
  
  tracks.forEach(track => {
    if (track.audioId && track.videoId) {
      console.log(`Track ${track.id}: Audio ${track.audioId} + Video ${track.videoId}`);
    } else {
      console.warn(`Track ${track.id} has incomplete A/V association`);
    }
  });
}
```

### 5. Language Code Mismatch

**Symptom**: Audio language selection doesn't work.

**Solution**: Use correct BCP 47 language codes:

```javascript
const validLanguageCodes = {
  'en': 'English',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'zh': 'Chinese',
  'zh-Hans': 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese',
  'zh-HK': 'Cantonese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'es': 'Spanish',
  'es-ES': 'Spanish (Spain)',
  'es-MX': 'Spanish (Mexico)',
  'fr': 'French',
  'de': 'German'
};

function normalizeLanguageCode(code) {
  const normalized = code.toLowerCase();
  const mapping = {
    'zh-cn': 'zh-Hans',
    'zh-tw': 'zh-Hant',
    'chi': 'zh',
    'eng': 'en',
    'jpn': 'ja',
    'kor': 'ko'
  };
  return mapping[normalized] || code;
}
```

## Complete Implementation Example

```javascript
class AudioTrackManager {
  constructor(player, videoElement) {
    this.player = player;
    this.video = videoElement;
    this.currentLanguage = null;
    this.volumeManager = new AudioManager(videoElement);
  }
  
  async initialize(manifestUri, preferredLanguage = 'en') {
    this.player.configure({
      preferredAudioLanguage: preferredLanguage,
      preferredAudioChannelCount: 2
    });
    
    this.setupEventHandlers();
    
    try {
      await this.player.load(manifestUri);
      this.currentLanguage = preferredLanguage;
      console.log('Audio manager initialized successfully');
      return true;
    } catch (e) {
      console.error('Failed to initialize audio manager:', e);
      return false;
    }
  }
  
  setupEventHandlers() {
    this.player.addEventListener('variantchanged', (event) => {
      this.currentLanguage = event.track.language;
      this.onTrackChanged(event.track);
    });
    
    this.player.addEventListener('trackschanged', () => {
      this.onTracksUpdated();
    });
    
    this.player.addEventListener('error', (event) => {
      this.handleError(event.detail);
    });
  }
  
  getAvailableLanguages() {
    return this.player.getAudioLanguages();
  }
  
  getTracksByLanguage(language) {
    return this.player.getVariantTracks()
      .filter(t => t.language === language);
  }
  
  async selectLanguage(language) {
    try {
      await this.player.selectAudioLanguage(language);
      this.currentLanguage = language;
      return true;
    } catch (e) {
      console.error('Failed to select language:', e);
      return false;
    }
  }
  
  selectTrack(track, clearBuffer = true) {
    this.player.selectVariantTrack(track, clearBuffer);
  }
  
  selectBestQualityForLanguage(language) {
    const tracks = this.getTracksByLanguage(language);
    if (tracks.length === 0) return false;
    
    const best = tracks.reduce((a, b) => 
      a.audioBandwidth > b.audioBandwidth ? a : b
    );
    
    this.selectTrack(best);
    return true;
  }
  
  onTrackChanged(track) {
    console.log(`Audio track changed to: ${track.language} (${track.label})`);
  }
  
  onTracksUpdated() {
    console.log('Available audio tracks updated');
  }
  
  handleError(error) {
    console.error('Audio error:', error);
  }
  
  setVolume(value) {
    this.volumeManager.setVolume(value);
  }
  
  toggleMute() {
    return this.volumeManager.toggleMute();
  }
}

async function initPlayerWithAudioManager() {
  const video = document.getElementById('video');
  const player = new shaka.Player();
  await player.attach(video);
  
  const audioManager = new AudioTrackManager(player, video);
  await audioManager.initialize(
    'https://example.com/manifest.mpd',
    'en'
  );
  
  const languages = audioManager.getAvailableLanguages();
  console.log('Available languages:', languages);
  
  audioManager.selectBestQualityForLanguage('en');
}
```

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Basic Audio | ✓ | ✓ | ✓ | ✓ |
| Multi-track | ✓ | ✓ | ✓ | ✓ |
| AAC | ✓ | ✓ | ✓ | ✓ |
| Opus | ✓ | ✓ | ✓* | ✓ |
| Dolby Digital (AC-3) | ✓* | ✗ | ✓ | ✓ |
| Dolby Digital Plus (E-AC-3) | ✓* | ✗ | ✓ | ✓ |
| 5.1 Surround | ✓* | ✓* | ✓ | ✓ |
| 7.1 Surround | ✓* | ✓* | ✓ | ✓ |

*Requires specific hardware/OS support

## Related Skills

- `shaka-player-basic-usage`: Basic player setup
- `shaka-player-configuration`: Player configuration including audio preferences
- `shaka-player-error-handling`: Error handling strategies
- `shaka-player-ui-customization`: UI customization including audio track selector
