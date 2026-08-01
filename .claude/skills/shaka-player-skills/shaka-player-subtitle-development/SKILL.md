---
name: "shaka-player-subtitle-development"
description: "Comprehensive guide for Shaka Player subtitle development including format support, loading, styling, positioning, and multi-language switching. Invoke when user needs to implement or customize subtitle functionality."
---

# Shaka Player Subtitle Development

This skill provides a comprehensive guide for implementing, controlling, and optimizing subtitles (Text Tracks) in Shaka Player.

## When to Use

Invoke this skill when:
- User needs to add or load external subtitles
- User wants to customize subtitle appearance (font, size, color, background)
- User needs to implement multi-language subtitle switching
- User wants to handle subtitle events and errors
- User needs to understand supported subtitle formats
- User asks about subtitle positioning and display control

## Supported Subtitle Formats

Shaka Player supports multiple subtitle and caption formats:

| Format | MIME Type | Extension | Description |
|--------|-----------|-----------|-------------|
| WebVTT | `text/vtt` | `.vtt` | Web Video Text Tracks, most common format |
| TTML | `application/ttml+xml` | `.xml`, `.ttml` | Timed Text Markup Language |
| SMPTE-TT | `application/ttml+xml` | `.xml` | SMPTE Timed Text (TTML variant) |
| EBU-TT | `application/ttml+xml` | `.xml` | EBU Timed Text (TTML variant) |
| CEA-608 | N/A (embedded) | N/A | Closed captions embedded in video |
| CEA-708 | N/A (embedded) | N/A | Digital television closed captions |
| WebVTT in MP4 | `application/mp4` | `.mp4` | WebVTT segments in fragmented MP4 |

## Core API Overview

| Function | Method/Property | Description |
|----------|-----------------|-------------|
| External Loading | `player.addTextTrackAsync(uri, lang, kind, mime, ...)` | Dynamically add .vtt or .xml (TTML) subtitles |
| Show/Hide | `player.setTextTrackVisibility(boolean)` | Toggle subtitle visibility globally |
| Switch Language | `player.selectTextLanguage(lang)` | Auto-match track by language code (e.g., 'zh-Hans') |
| Get List | `player.getTextTracks()` | Get all available subtitle track objects |
| Set Default | `player.configure({ preferredTextLanguage: 'zh' })` | Set preferred language at startup |
| Select Track | `player.selectTextTrack(track)` | Select a specific text track |
| Get Current | `player.getTextTracks().find(t => t.active)` | Get currently active subtitle track |

## External Subtitle Loading (Side-loading)

For subtitles not included in the Manifest (MPD/M3U8), you need to manually load them:

### Basic External Subtitle Loading

```javascript
async function loadExternalSubs(player) {
  const subUrl = 'https://example.com/subtitles/zh-Hans.vtt';
  
  try {
    await player.addTextTrackAsync(
      subUrl,
      'zh-Hans',              // BCP 47 language tag
      'subtitle',             // Type: 'subtitle' or 'caption'
      'text/vtt',             // MIME type (use 'application/ttml+xml' for TTML)
      null,                   // codec (usually pass null)
      'Simplified Chinese'    // Label displayed in UI
    );
    console.log('Subtitle loaded successfully');
  } catch (e) {
    console.error('Failed to load subtitle:', e);
  }
}
```

### Loading Multiple Subtitles

```javascript
async function loadMultipleSubtitles(player) {
  const subtitles = [
    { url: 'https://example.com/subs/en.vtt', lang: 'en', label: 'English' },
    { url: 'https://example.com/subs/zh-Hans.vtt', lang: 'zh-Hans', label: 'Simplified Chinese' },
    { url: 'https://example.com/subs/ja.vtt', lang: 'ja', label: 'Japanese' },
    { url: 'https://example.com/subs/ko.vtt', lang: 'ko', label: 'Korean' }
  ];
  
  for (const sub of subtitles) {
    try {
      await player.addTextTrackAsync(
        sub.url,
        sub.lang,
        'subtitle',
        'text/vtt',
        null,
        sub.label
      );
    } catch (e) {
      console.error(`Failed to load ${sub.lang} subtitle:`, e);
    }
  }
}
```

### Loading TTML Subtitles

```javascript
async function loadTTMLSubtitle(player) {
  try {
    await player.addTextTrackAsync(
      'https://example.com/subtitles/movie.ttml',
      'en-US',
      'subtitle',
      'application/ttml+xml',  // Important: Use correct MIME type for TTML
      null,
      'English (TTML)'
    );
  } catch (e) {
    console.error('Failed to load TTML subtitle:', e);
  }
}
```

### Complete Implementation with Error Handling

```javascript
async function initPlayerWithSubtitles() {
  const video = document.getElementById('video');
  const player = new shaka.Player();
  await player.attach(video);
  
  player.addEventListener('error', onErrorEvent);
  
  try {
    await player.load('https://example.com/manifest.mpd');
    console.log('Video loaded successfully');
    
    await loadExternalSubs(player);
    
    player.setTextTrackVisibility(true);
    
    const tracks = player.getTextTracks();
    console.log('Available subtitles:', tracks);
    
  } catch (e) {
    console.error('Initialization error:', e);
  }
}

function onErrorEvent(event) {
  console.error('Player error:', event.detail);
}
```

## Subtitle Styling

Shaka Player provides two methods to control subtitle appearance:

### Method A: CSS Override (Simplest and Most Direct)

Override the subtitle container styles in Shaka's built-in UI:

```css
.shaka-text-container span {
  background-color: rgba(0, 0, 0, 0.8) !important;
  color: #ffffff !important;
  font-size: 1.2em !important;
  text-shadow: 2px 2px 2px #000;
  font-family: 'Arial', sans-serif !important;
  font-weight: bold !important;
  padding: 4px 8px !important;
  border-radius: 4px !important;
}

.shaka-text-container {
  bottom: 10% !important;
}
```

### Method B: TextDisplayer Configuration

For more complex rendering (e.g., TTML region definitions), enable the built-in UI renderer:

```javascript
player.configure('textDisplayFactory', shaka.text.UITextDisplayer.factory);
```

### Advanced CSS Styling Examples

```css
.shaka-text-container span {
  font-family: 'Helvetica Neue', Arial, sans-serif !important;
  font-size: 1.5em !important;
  font-weight: 500 !important;
  color: #ffff00 !important;
  background-color: rgba(0, 0, 0, 0.7) !important;
  text-shadow: 
    1px 1px 0 #000,
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000 !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
  letter-spacing: 0.5px !important;
  line-height: 1.4 !important;
}
```

### Semi-Transparent Overlay Style

```css
.shaka-text-container span {
  background-color: transparent !important;
  color: #ffffff !important;
  text-shadow: 
    0 0 4px #000,
    0 0 4px #000,
    0 0 4px #000,
    0 0 4px #000 !important;
  font-size: 1.3em !important;
}
```

### High Contrast Style

```css
.shaka-text-container span {
  background-color: #000000 !important;
  color: #ffffff !important;
  font-size: 1.4em !important;
  border: 2px solid #ffffff !important;
  padding: 4px 10px !important;
}
```

## Subtitle Positioning and Display Control

### CSS-Based Positioning

```css
.shaka-text-container {
  position: absolute !important;
  bottom: 15% !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  width: 80% !important;
  text-align: center !important;
}
```

### Programmatic Position Control

```javascript
function setSubtitlePosition(player, position) {
  const textContainer = document.querySelector('.shaka-text-container');
  if (textContainer) {
    switch (position) {
      case 'top':
        textContainer.style.top = '10%';
        textContainer.style.bottom = 'auto';
        break;
      case 'middle':
        textContainer.style.top = '45%';
        textContainer.style.bottom = 'auto';
        break;
      case 'bottom':
      default:
        textContainer.style.top = 'auto';
        textContainer.style.bottom = '10%';
        break;
    }
  }
}
```

## Multi-Language Subtitle Switching

### Automatic Language Selection

```javascript
player.configure({
  preferredTextLanguage: 'zh-Hans',
  preferForcedSubs: false
});

await player.load(manifestUri);
```

### Manual Language Switching

```javascript
function switchSubtitleLanguage(player, languageCode) {
  const tracks = player.getTextTracks();
  const targetTrack = tracks.find(track => track.language === languageCode);
  
  if (targetTrack) {
    player.selectTextTrack(targetTrack);
    console.log(`Switched to: ${targetTrack.label}`);
  } else {
    console.warn(`Subtitle not found for language: ${languageCode}`);
  }
}

switchSubtitleLanguage(player, 'en');
```

### Building a Language Selector UI

```javascript
function createSubtitleSelector(player) {
  const tracks = player.getTextTracks();
  const selector = document.createElement('select');
  selector.id = 'subtitle-selector';
  
  const offOption = document.createElement('option');
  offOption.value = 'off';
  offOption.textContent = 'Off';
  selector.appendChild(offOption);
  
  tracks.forEach((track, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = track.label || track.language;
    if (track.active) {
      option.selected = true;
    }
    selector.appendChild(option);
  });
  
  selector.addEventListener('change', (e) => {
    if (e.target.value === 'off') {
      player.setTextTrackVisibility(false);
    } else {
      const trackIndex = parseInt(e.target.value);
      player.selectTextTrack(tracks[trackIndex]);
      player.setTextTrackVisibility(true);
    }
  });
  
  return selector;
}
```

### Complete Language Switching Example

```javascript
class SubtitleManager {
  constructor(player) {
    this.player = player;
    this.currentLanguage = null;
  }
  
  async loadSubtitles(subtitleConfigs) {
    for (const config of subtitleConfigs) {
      try {
        await this.player.addTextTrackAsync(
          config.url,
          config.lang,
          config.kind || 'subtitle',
          config.mime || 'text/vtt',
          null,
          config.label
        );
      } catch (e) {
        console.error(`Failed to load ${config.lang}:`, e);
      }
    }
  }
  
  getAvailableLanguages() {
    return this.player.getTextTracks().map(track => ({
      language: track.language,
      label: track.label,
      active: track.active
    }));
  }
  
  setLanguage(languageCode) {
    const tracks = this.player.getTextTracks();
    const track = tracks.find(t => t.language === languageCode);
    
    if (track) {
      this.player.selectTextTrack(track);
      this.player.setTextTrackVisibility(true);
      this.currentLanguage = languageCode;
      return true;
    }
    return false;
  }
  
  toggle() {
    const isVisible = this.player.isTextTrackVisible();
    this.player.setTextTrackVisibility(!isVisible);
    return !isVisible;
  }
  
  off() {
    this.player.setTextTrackVisibility(false);
  }
}

const subManager = new SubtitleManager(player);
await subManager.loadSubtitles([
  { url: '/subs/en.vtt', lang: 'en', label: 'English' },
  { url: '/subs/zh.vtt', lang: 'zh-Hans', label: 'Chinese' }
]);
subManager.setLanguage('en');
```

## Subtitle Event Listening and Handling

### Track Change Events

```javascript
player.addEventListener('texttrackchanged', () => {
  const tracks = player.getTextTracks();
  const activeTrack = tracks.find(t => t.active);
  
  if (activeTrack) {
    console.log('Active subtitle:', activeTrack.label || activeTrack.language);
  } else {
    console.log('No active subtitle');
  }
});
```

### Visibility Change Events

```javascript
player.addEventListener('texttrackvisibility', () => {
  const isVisible = player.isTextTrackVisible();
  console.log('Subtitle visibility:', isVisible ? 'Visible' : 'Hidden');
  
  updateSubtitleToggleButton(isVisible);
});
```

### Complete Event Handler Implementation

```javascript
function setupSubtitleEventHandlers(player) {
  player.addEventListener('texttrackchanged', (event) => {
    const tracks = player.getTextTracks();
    const activeTrack = tracks.find(t => t.active);
    
    document.dispatchEvent(new CustomEvent('subtitleChanged', {
      detail: {
        track: activeTrack,
        language: activeTrack?.language,
        label: activeTrack?.label
      }
    }));
  });
  
  player.addEventListener('texttrackvisibility', () => {
    const isVisible = player.isTextTrackVisible();
    
    document.dispatchEvent(new CustomEvent('subtitleVisibilityChanged', {
      detail: { visible: isVisible }
    }));
  });
  
  player.addEventListener('error', (event) => {
    const error = event.detail;
    if (error.category === shaka.util.Error.Category.TEXT) {
      console.error('Subtitle error:', error);
      handleSubtitleError(error);
    }
  });
}

function handleSubtitleError(error) {
  switch (error.code) {
    case shaka.util.Error.Code.INVALID_TEXT_HEADER:
      console.error('Invalid subtitle file header');
      break;
    case shaka.util.Error.Code.INVALID_TEXT_CUE:
      console.error('Invalid subtitle cue data');
      break;
    default:
      console.error('Unknown subtitle error:', error.code);
  }
}
```

## Working with Text Track Objects

### Text Track Properties

```javascript
const tracks = player.getTextTracks();

tracks.forEach(track => {
  console.log({
    id: track.id,
    language: track.language,
    label: track.label,
    kind: track.kind,
    active: track.active,
    mimeType: track.mimeType,
    codecs: track.codecs
  });
});
```

### Selecting Tracks by Property

```javascript
function selectTrackByLanguage(player, language) {
  const tracks = player.getTextTracks();
  const track = tracks.find(t => t.language === language);
  if (track) {
    player.selectTextTrack(track);
  }
}

function selectTrackByLabel(player, label) {
  const tracks = player.getTextTracks();
  const track = tracks.find(t => t.label === label);
  if (track) {
    player.selectTextTrack(track);
  }
}

function selectFirstAvailableTrack(player) {
  const tracks = player.getTextTracks();
  if (tracks.length > 0) {
    player.selectTextTrack(tracks[0]);
    player.setTextTrackVisibility(true);
  }
}
```

## Troubleshooting

### 1. CORS Errors

**Symptom**: Console shows `Cross-Origin Request Blocked`

**Solution**: The server hosting subtitles must include proper CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
```

### 2. Subtitles Not Displaying

**Checklist**:
1. Ensure `player.setTextTrackVisibility(true)` is called
2. Verify MIME type is correct:
   - `.vtt` files: `text/vtt`
   - `.xml/.ttml` files: `application/ttml+xml`
3. Confirm timing: `addTextTrackAsync` must be called after `player.load()` completes
4. Check if subtitle file is valid and properly formatted

### 3. Language Matching Fails

**Issue**: Shaka strictly follows BCP 47 language tags

**Solution**: Maintain consistent naming:
- Use `zh-Hans` for Simplified Chinese (not `zh-CN`)
- Use `zh-Hant` for Traditional Chinese (not `zh-TW`)
- Use `en-US`, `en-GB` for specific English variants

### 4. TTML Styling Not Applied

**Solution**: Enable the UI text displayer:
```javascript
player.configure('textDisplayFactory', shaka.text.UITextDisplayer.factory);
```

### 5. Subtitle Sync Issues

**Solution**: Check WebVTT timing format:
```vtt
WEBVTT

00:00:01.000 --> 00:00:04.000
First subtitle line

00:00:05.000 --> 00:00:08.000
Second subtitle line
```

## Best Practices

### 1. Always Load After Video

```javascript
try {
  await player.load(manifestUri);
  await loadExternalSubs(player);
} catch (e) {
  console.error('Load error:', e);
}
```

### 2. Handle Errors Gracefully

```javascript
async function safeLoadSubtitle(player, url, lang, label) {
  try {
    await player.addTextTrackAsync(url, lang, 'subtitle', 'text/vtt', null, label);
    return true;
  } catch (e) {
    console.warn(`Subtitle load failed for ${lang}:`, e);
    return false;
  }
}
```

### 3. Provide User Feedback

```javascript
async function loadSubtitlesWithFeedback(player, configs) {
  showLoadingIndicator('Loading subtitles...');
  
  const results = await Promise.allSettled(
    configs.map(c => player.addTextTrackAsync(c.url, c.lang, 'subtitle', 'text/vtt', null, c.label))
  );
  
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    showWarning(`${failed.length} subtitle(s) failed to load`);
  }
  
  hideLoadingIndicator();
}
```

### 4. Use BCP 47 Language Tags

```javascript
const validLanguageTags = {
  english: 'en',
  simplifiedChinese: 'zh-Hans',
  traditionalChinese: 'zh-Hant',
  japanese: 'ja',
  korean: 'ko',
  spanish: 'es',
  french: 'fr',
  german: 'de'
};
```

### 5. Configure Default Behavior

```javascript
player.configure({
  preferredTextLanguage: 'en',
  preferForcedSubs: false,
  streaming: {
    ignoreTextStreamFailures: false
  }
});
```

## WebVTT Format Reference

### Basic WebVTT Structure

```vtt
WEBVTT

NOTE This is a comment

00:00:01.000 --> 00:00:04.000
First subtitle appears here

00:00:05.000 --> 00:00:08.000 position:50% align:middle
Second subtitle with positioning

00:00:10.000 --> 00:00:14.000 line:85%
Third subtitle positioned near bottom
```

### WebVTT Styling

```vtt
WEBVTT

STYLE
::cue {
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  font-size: 1em;
}

::cue(.bold) {
  font-weight: bold;
}

00:00:01.000 --> 00:00:04.000
<u>Underlined subtitle</u>

00:00:05.000 --> 00:00:08.000
<b class="bold">Bold subtitle</b>
```

### WebVTT Positioning

```vtt
WEBVTT

00:00:01.000 --> 00:00:04.000 position:50%,center align:middle
Centered subtitle

00:00:05.000 --> 00:00:08.000 line:10% align:left
Top-left subtitle

00:00:10.000 --> 00:00:14.000 position:90% align:right
Right-aligned subtitle
```

## Related Skills

- `shaka-player-basic-usage`: Basic player setup
- `shaka-player-configuration`: Player configuration including language preferences
- `shaka-player-error-handling`: Error handling strategies
- `shaka-player-ui-customization`: UI customization including subtitle controls
