---
name: "shaka-player-ui-customization"
description: "Customizes Shaka Player UI including controls, localization, and accessibility. Invoke when user needs to customize player appearance or add custom controls."
---

# Shaka Player UI Customization

This skill helps you customize the Shaka Player UI library, including controls, localization, accessibility features, and Chromecast integration.

## When to Use

Invoke this skill when:
- User needs to set up the UI library
- User wants to customize player controls
- User needs to enable Chromecast support
- User wants to enable VR playback
- User needs to localize the player UI
- User wants to build custom UI components
- User needs to implement deep styling customization

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `castReceiverAppId` | string | No | Chromecast receiver application ID |
| `config` | object | No | UI configuration object |
| `locale` | string | No | Language locale for UI |

---

## 1. UI Structure Fundamentals

Understanding the DOM hierarchy is essential for deep customization:

### DOM Layer Hierarchy

```
.shaka-video-container      ← Outermost container (video + all UI)
  └── .shaka-controls-container  ← Control layer (handles show/hide on hover)
        └── .shaka-control-panel ← Bottom control bar (play, seek, volume, etc.)
              └── .shaka-range-container ← Seek bar track
```

### Key CSS Classes

| Class | Purpose |
|-------|---------|
| `.shaka-video-container` | Root container for theming scope |
| `.shaka-controls-container` | Controls overlay layer |
| `.shaka-control-panel` | Bottom toolbar with buttons |
| `.shaka-range-container` | Progress/volume bar track |
| `.shaka-overflow-menu` | Settings popup menu |
| `.shaka-spinner` | Loading animation |

---

## 2. Setting Up UI Library

### HTML-based Setup (Declarative)

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="dist/shaka-player.ui.js"></script>
    <link rel="stylesheet" type="text/css" href="dist/controls.css">
    <script defer src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js"></script>
    <script src="myapp.js"></script>
  </head>
  <body>
    <div data-shaka-player-container style="max-width:40em"
         data-shaka-player-cast-receiver-id="07AEE832">
      <video autoplay data-shaka-player id="video" 
             style="width:100%;height:100%"></video>
    </div>
  </body>
</html>
```

### JavaScript Initialization

```javascript
const manifestUri = 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd';

async function init() {
  const video = document.getElementById('video');
  const ui = video['ui'];
  const controls = ui.getControls();
  const player = controls.getPlayer();
  
  window.player = player;
  window.ui = ui;
  
  player.addEventListener('error', onPlayerErrorEvent);
  controls.addEventListener('error', onUIErrorEvent);
  
  try {
    await player.load(manifestUri);
    console.log('The video has now been loaded!');
  } catch (error) {
    onPlayerError(error);
  }
}

function onPlayerErrorEvent(errorEvent) {
  onPlayerError(errorEvent.detail);
}

function onPlayerError(error) {
  console.error('Error code', error.code, 'object', error);
}

function onUIErrorEvent(errorEvent) {
  onPlayerError(errorEvent.detail);
}

function initFailed(errorEvent) {
  console.error('Unable to load the UI library!');
}

document.addEventListener('shaka-ui-loaded', init);
document.addEventListener('shaka-ui-load-failed', initFailed);
```

### Programmatic UI Setup

```javascript
const localPlayer = new shaka.Player();
const videoContainerElement = document.getElementById('video-container');
const videoElement = document.getElementById('video');

const ui = new shaka.ui.Overlay(localPlayer, videoContainerElement, videoElement);

await localPlayer.attach(videoElement);

const controls = ui.getControls();
const player = controls.getPlayer();
const video = controls.getVideo();

ui.configure({
  'castReceiverAppId': '07AEE832',
  'castAndroidReceiverCompatible': true
});
```

---

## 3. Auto-loading Content

### Using src Attribute

```html
<div data-shaka-player-container style="max-width:40em"
     data-shaka-player-cast-receiver-id="07AEE832">
  <video autoplay data-shaka-player id="video" 
         style="width:100%;height:100%"
         src="https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd">
  </video>
</div>
```

### Using source Tags

```html
<div data-shaka-player-container style="max-width:40em"
     data-shaka-player-cast-receiver-id="07AEE832">
  <video autoplay data-shaka-player id="video" style="width:100%;height:100%">
    <source src="https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd"/>
    <source src="https://storage.googleapis.com/shaka-demo-assets/angel-one-hls-apple/master.m3u8"/>
  </video>
</div>
```

---

## 4. Deep Configuration Options

### Full Configuration Reference

```javascript
const config = {
  'controlPanelElements': [
    'play_pause',
    'time_and_duration',
    'spacer',
    'mute',
    'volume',
    'fullscreen',
    'overflow_menu'
  ],
  
  'overflowMenuButtons': [
    'quality',
    'language',
    'text_track',
    'playback_rate',
    'cast',
    'picture_in_picture'
  ],
  
  'doubleClickForFullscreen': true,
  'enableKeyboardPlaybackControls': true,
  'enableTooltips': true,
  'fadeControlsInSeconds': 3,
  
  'seekBarColors': {
    'base': 'rgba(255, 255, 255, 0.3)',
    'buffered': 'rgba(255, 255, 255, 0.5)',
    'played': 'rgb(255, 0, 0)',
    'adBreaks': 'rgb(255, 204, 0)'
  },
  
  'keyboardSeekDistance': 5,
  'keyboardLargeSeekDistance': 60,
  
  'displayInVrMode': false,
  
  'castReceiverAppId': 'YOUR_APP_ID',
  'castAndroidReceiverCompatible': false
};

ui.configure(config);
```

### Configuration Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `controlPanelElements` | string[] | [...] | Buttons in control bar (left to right) |
| `overflowMenuButtons` | string[] | [...] | Items in settings menu |
| `doubleClickForFullscreen` | boolean | true | Double-click toggles fullscreen |
| `enableKeyboardPlaybackControls` | boolean | true | Enable keyboard shortcuts |
| `enableTooltips` | boolean | true | Show tooltips on hover |
| `fadeControlsInSeconds` | number | 3 | Auto-hide delay for controls |
| `keyboardSeekDistance` | number | 5 | Arrow key seek distance (seconds) |
| `keyboardLargeSeekDistance` | number | 60 | PageUp/Down seek distance (seconds) |
| `displayInVrMode` | boolean | false | Enable VR display mode |

### Available Control Panel Elements

| Element | Description |
|---------|-------------|
| `play_pause` | Play/pause toggle button |
| `mute` | Mute/unmute button |
| `volume` | Volume slider |
| `time_and_duration` | Current time / total duration |
| `fullscreen` | Fullscreen toggle |
| `overflow_menu` | Settings menu button |
| `cast` | Chromecast button |
| `spacer` | Flexible space |
| `live` | Live indicator |
| `pip` | Picture-in-picture button |

---

## 5. Custom Button Development

### Step 1: Define Component Class

```javascript
class MyCustomButton extends shaka.ui.Element {
  constructor(parent, controls) {
    super(parent, controls);
    
    this.button_ = document.createElement('button');
    this.button_.classList.add('shaka-my-custom-button');
    this.button_.textContent = 'Feedback';
    this.parent.appendChild(this.button_);
    
    this.eventManager.listen(this.button_, 'click', () => {
      alert('Thanks for your feedback!');
    });
  }
}

MyCustomButton.Factory = class {
  create(parent, controls) {
    return new MyCustomButton(parent, controls);
  }
};
```

### Step 2: Register and Use

```javascript
shaka.ui.Controls.registerElement('my_feedback', new MyCustomButton.Factory());

ui.configure({
  'controlPanelElements': ['play_pause', 'spacer', 'my_feedback', 'fullscreen']
});
```

### Custom Button with State

```javascript
class LoopToggleButton extends shaka.ui.Element {
  constructor(parent, controls) {
    super(parent, controls);
    
    this.button_ = document.createElement('button');
    this.button_.classList.add('shaka-loop-button');
    this.button_.textContent = '🔁';
    this.parent.appendChild(this.button_);
    
    this.isLooping_ = false;
    
    this.eventManager.listen(this.button_, 'click', () => {
      this.isLooping_ = !this.isLooping_;
      this.video_.loop = this.isLooping_;
      this.button_.style.opacity = this.isLooping_ ? '1' : '0.5';
    });
    
    this.eventManager.listen(this.video_, 'ended', () => {
      if (this.isLooping_) {
        this.video_.currentTime = 0;
        this.video_.play();
      }
    });
  }
}

LoopToggleButton.Factory = class {
  create(parent, controls) {
    return new LoopToggleButton(parent, controls);
  }
};

shaka.ui.Controls.registerElement('loop_toggle', new LoopToggleButton.Factory());
```

---

## 6. CSS Variables Reference

### Core Branding Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--shaka-primary-color` | `#448aff` | Theme color (progress bar, active icons) |
| `--shaka-range-thumb-color` | `#fff` | Slider thumb color |
| `--shaka-controls-background-color` | `rgba(0,0,0,0.5)` | Control bar background |
| `--shaka-text-track-background-color` | `rgba(0,0,0,0.8)` | Subtitle background |

### Seek Bar Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--shaka-range-background-color` | `rgba(255,255,255,0.3)` | Unplayed track color |
| `--shaka-buffered-range-color` | `rgba(255,255,255,0.5)` | Buffered portion color |
| `--shaka-ad-break-color` | `#ffcc00` | Ad marker color |

### Menu Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--shaka-overflow-menu-bg` | `#2a2a2a` | Settings menu background |
| `--shaka-overflow-menu-text-color` | `#fff` | Menu text color |
| `--shaka-menu-item-hover-bg` | `#444` | Hover state background |
| `--shaka-menu-item-active-color` | `var(--shaka-primary-color)` | Selected item color |

### Auxiliary Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `--shaka-loader-color` | `var(--shaka-primary-color)` | Loading spinner color |
| `--shaka-tooltip-bg` | `rgba(0,0,0,0.7)` | Tooltip background |
| `--shaka-error-message-bg` | `rgba(0,0,0,0.8)` | Error overlay background |

### YouTube-Style Theme Example

```css
.shaka-video-container {
  --shaka-primary-color: #ff0000;
  --shaka-controls-background-color: linear-gradient(transparent, rgba(0,0,0,0.9));
  --shaka-range-thumb-color: #ff0000;
  --shaka-range-background-color: rgba(255,255,255,0.2);
  --shaka-buffered-range-color: rgba(255,255,255,0.4);
}

.shaka-video-container .shaka-range-container {
  height: 6px;
}

.shaka-video-container .shaka-play-button {
  transform: scale(1.1);
}
```

### Dynamic Theme Switching

```javascript
const container = document.querySelector('.shaka-video-container');

function setTheme(primaryColor) {
  container.style.setProperty('--shaka-primary-color', primaryColor);
}

setTheme('#fb7299');
```

---

## 7. Deep CSS Override Techniques

### Progress Bar Customization

```css
.shaka-range-container {
  height: 8px !important;
}

.shaka-range-container:hover {
  height: 12px !important;
}
```

### Overflow Menu Styling

```css
.shaka-overflow-menu {
  background-color: #1a1a1a !important;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
}
```

### Mobile Optimization

```css
.shaka-mobile .shaka-video-controls-button {
  padding: 15px !important;
  min-width: 48px;
  min-height: 48px;
}
```

### Loading Spinner

```css
.shaka-spinner-path {
  stroke: #ff0000 !important;
  stroke-width: 4px;
}
```

---

## 8. Localization

### Override Translations

```javascript
const localization = ui.getControls().getLocalization();

localization.insert('zh', 'Quality', '画质');
localization.insert('zh', 'Subtitles', '字幕');
localization.insert('zh', 'Play', '播放');
localization.insert('zh', 'Pause', '暂停');
localization.insert('zh', 'Mute', '静音');
localization.insert('zh', 'Unmute', '取消静音');
localization.insert('zh', 'Fullscreen', '全屏');
localization.insert('zh', 'Exit Fullscreen', '退出全屏');
localization.insert('zh', 'Picture-in-Picture', '画中画');
localization.insert('zh', 'Language', '语言');
localization.insert('zh', 'Resolution', '分辨率');
localization.insert('zh', 'Playback Rate', '播放速度');
```

### Change UI Language

```javascript
ui.configure({ 'preferredTextLanguage': 'zh' });
```

### URL Parameter Override

```
https://example.com/player?lang=zh-CN
```

---

## 9. UI Reconfiguration & Refresh

### Live Reconfiguration

```javascript
function switchToLiveUI(ui) {
  ui.configure({
    'controlPanelElements': ['play_pause', 'live', 'spacer', 'mute', 'volume', 'fullscreen'],
    'addBackwardsJumpButton': false,
    'addForwardsJumpButton': false
  });
}

function switchToVodUI(ui) {
  ui.configure({
    'controlPanelElements': ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen']
  });
}
```

### Destroy & Re-overlay

```javascript
async function resetUI(player, newContainer, videoElement) {
  const oldUi = videoElement['ui'];
  if (oldUi) {
    await oldUi.destroy();
  }
  
  newContainer.innerHTML = '';
  newContainer.appendChild(videoElement);
  
  const ui = new shaka.ui.Overlay(player, newContainer, videoElement);
  ui.configure(myGlobalConfig);
  
  return ui;
}
```

### Manual Layout Refresh

```javascript
const controls = ui.getControls();

controls.updateControlsLayout();

controls.setEnabled(true);
controls.onMouseMove();
```

### Force Track Menu Update

```javascript
player.dispatchEvent(new shaka.util.FakeEvent('trackchanged'));
```

---

## 10. Chromecast Integration

### Enable Chromecast

```html
<div data-shaka-player-container 
     data-shaka-player-cast-receiver-id="YOUR_APP_ID">
  <video data-shaka-player id="video"></video>
</div>
```

### Monitor Cast Status

```javascript
const controls = ui.getControls();

controls.addEventListener('caststatuschanged', (event) => {
  const newCastStatus = event['newStatus'];
  console.log('Cast status changed:', newCastStatus);
  
  if (newCastStatus) {
    showCastConnectedMessage();
  } else {
    showCastDisconnectedMessage();
  }
});
```

### Android Receiver Apps

```html
<div data-shaka-player-container 
     data-shaka-player-cast-receiver-id="07AEE832"
     data-shaka-player-cast-android-receiver-compatible="true">
  <video data-shaka-player id="video"></video>
</div>
```

---

## 11. VR Playback

### Enable VR Mode

```javascript
ui.configure({
  'displayInVrMode': true
});
```

### Automatic VR Detection

VR is automatically enabled for content with:
- HLS or DASH manifest
- fMP4 segments
- Init segment contains `prji` and `hfov` boxes

### External VR Canvas

```html
<canvas data-shaka-player-vr-canvas id="vr-canvas"></canvas>
<div data-shaka-player-container>
  <video data-shaka-player id="video"></video>
</div>
```

**Note**: VR is only supported for clear streams or HLS-AES streams. DRM prevents access to video pixels for transformation.

---

## 12. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Spacebar` | Play/Pause (when seek bar is focused) |
| `←` / `→` | Seek backward/forward 5 seconds |
| `PageDown` / `PageUp` | Seek backward/forward 60 seconds |
| `Home` / `End` | Seek to beginning/end |
| `c` | Toggle closed captions |
| `f` | Toggle full screen |
| `m` | Mute/unmute |
| `p` | Toggle picture-in-picture |
| `>` | Increase playback rate |
| `<` | Decrease playback rate |

### Customize Keyboard Shortcuts

```javascript
ui.configure({
  'keyboardSeekDistance': 10,
  'keyboardLargeSeekDistance': 30
});
```

---

## 13. Stream Metadata for UI

### Display Title

| Format | Method |
|--------|--------|
| ID3 | Use `TIT2` tag |
| HLS | Include `#EXT-X-SESSION-DATA` with ID `com.apple.hls.title` |
| DASH | Use `ProgramInformation` element with `Title` field |

### Display Poster

| Format | Method |
|--------|--------|
| ID3 | Use `APIC` tag |
| HLS | Include `#EXT-X-SESSION-DATA` with ID `com.apple.hls.poster` |

**Note**: This metadata is also used by the Media Session API.

---

## 14. Building Custom UI from Scratch

When built-in UI cannot meet complex requirements, consider building a completely custom UI layer.

### Architecture Overview

```
Data Layer (Shaka Player Core)
    ↓ Events
Adapter Layer (Event Bridge)
    ↓ State
Presentation Layer (Custom UI)
```

### HTML Structure

```html
<div id="video-container" class="custom-player-scope">
  <video id="video" poster="cover.jpg"></video>
  
  <div class="custom-controls">
    <div class="progress-bar">...</div>
    <button id="play-btn">Play</button>
    <div class="quality-selector">...</div>
  </div>
</div>
```

### Event Bridge: Player to UI

```javascript
const video = document.getElementById('video');
const player = /* shaka player instance */;

video.addEventListener('timeupdate', () => {
  const percent = (video.currentTime / video.duration) * 100;
  myProgressBar.style.width = `${percent}%`;
});

player.addEventListener('buffering', (event) => {
  loadingSpinner.style.display = event.buffering ? 'block' : 'none';
});

player.addEventListener('variantchanged', () => {
  const tracks = player.getVariantTracks();
  renderQualityMenu(tracks);
});
```

### Event Bridge: UI to Player

```javascript
playBtn.onclick = () => {
  video.paused ? video.play() : video.pause();
};

qualityItem.onclick = (track) => {
  player.configure({ 'abr.enabled': false });
  player.selectVariantTrack(track, true);
};
```

### Fullscreen Handling

```javascript
function toggleFullScreen() {
  const container = document.getElementById('video-container');
  if (!document.fullscreenElement) {
    container.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}
```

### Z-Index Management

```
Video: z-index: 1
Custom UI: z-index: 10
Popups/Modals: z-index: 100
```

---

## 15. Custom Seek Bar Implementation

### HTML Structure

```html
<div class="custom-seekbar-container" id="seekbar-container">
  <div class="seekbar-bg"></div>
  <div class="seekbar-buffered" id="buffered-bar"></div>
  <div class="seekbar-played" id="played-bar">
    <div class="seekbar-handle"></div>
  </div>
</div>
```

### Core JavaScript Logic

```javascript
const video = document.getElementById('video');
const container = document.getElementById('seekbar-container');
const playedBar = document.getElementById('played-bar');
let isDragging = false;

function getClickPosition(e) {
  const rect = container.getBoundingClientRect();
  const offset = e.clientX - rect.left;
  let percent = offset / rect.width;
  return Math.max(0, Math.min(1, percent));
}

container.addEventListener('mousedown', (e) => {
  isDragging = true;
  updateSeek(e);
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  updateSeek(e);
});

window.addEventListener('mouseup', (e) => {
  if (isDragging) {
    isDragging = false;
    const percent = getClickPosition(e);
    video.currentTime = percent * video.duration;
  }
});

function updateSeek(e) {
  const percent = getClickPosition(e);
  playedBar.style.width = (percent * 100) + '%';
}
```

### Auto-sync Logic

```javascript
video.addEventListener('timeupdate', () => {
  if (!isDragging) {
    const percent = (video.currentTime / video.duration) * 100;
    playedBar.style.width = percent + '%';
  }
});

video.addEventListener('progress', () => {
  if (video.buffered.length > 0) {
    const bufferedEnd = video.buffered.end(video.buffered.length - 1);
    const percent = (bufferedEnd / video.duration) * 100;
    document.getElementById('buffered-bar').style.width = percent + '%';
  }
});
```

### CSS Styling

```css
.custom-seekbar-container {
  position: relative;
  height: 10px;
  cursor: pointer;
  background: rgba(255,255,255,0.2);
}

.seekbar-played {
  position: absolute;
  background: #ff0000;
  height: 100%;
  width: 0;
}

.seekbar-handle {
  position: absolute;
  right: -5px;
  top: -3px;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 0 5px rgba(0,0,0,0.5);
}
```

---

## 16. Seek Bar Hover Preview

### HTML Structure

```html
<div class="custom-seekbar-container" id="seekbar-container">
  <div class="seekbar-tooltip" id="seekbar-tooltip">
    <div class="thumbnail-placeholder" id="preview-thumbnail"></div>
    <span id="preview-time">00:00</span>
  </div>
</div>
```

### Time Preview Logic

```javascript
const container = document.getElementById('seekbar-container');
const tooltip = document.getElementById('seekbar-tooltip');
const previewTime = document.getElementById('preview-time');
const video = document.getElementById('video');

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s]
    .map(v => (v < 10 ? "0" + v : v))
    .filter((v, i) => v !== "00" || i > 0)
    .join(":");
}

container.addEventListener('mousemove', (e) => {
  const rect = container.getBoundingClientRect();
  const offset = e.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, offset / rect.width));
  
  const duration = video.duration || 0;
  const hoverTime = percent * duration;
  previewTime.textContent = formatTime(hoverTime);
  
  tooltip.style.left = `${offset}px`;
  tooltip.style.display = 'block';
});

container.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
});
```

### Thumbnail Preview

```javascript
async function updateThumbnail(time) {
  const imageTracks = player.getImageTracks();
  if (imageTracks.length > 0) {
    const thumb = await player.getThumbnail(imageTracks[0].id, time);
    if (thumb) {
      const el = document.getElementById('preview-thumbnail');
      el.style.backgroundImage = `url(${thumb.uris[0]})`;
    }
  }
}
```

### Tooltip CSS

```css
.seekbar-tooltip {
  position: absolute;
  bottom: 20px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: none;
  pointer-events: none;
  white-space: nowrap;
}

.thumbnail-placeholder {
  width: 160px;
  height: 90px;
  background-color: #000;
  background-size: cover;
  margin-bottom: 5px;
  border: 1px solid #444;
}
```

---

## 17. Custom Context Menu

### HTML Structure

```html
<div id="video-container" class="custom-player-scope">
  <video id="video"></video>
  
  <div id="custom-context-menu" class="context-menu">
    <ul>
      <li id="menu-stats">View Statistics</li>
      <li id="menu-copy-url">Copy Video URL</li>
      <li class="menu-divider"></li>
      <li class="menu-version">Shaka Player v4.x</li>
    </ul>
  </div>
</div>
```

### JavaScript Logic

```javascript
const container = document.getElementById('video-container');
const menu = document.getElementById('custom-context-menu');
const video = document.getElementById('video');

container.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  
  const rect = container.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  
  const menuWidth = 150;
  const menuHeight = 100;
  if (x + menuWidth > rect.width) x -= menuWidth;
  if (y + menuHeight > rect.height) y -= menuHeight;
  
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = 'block';
});

document.addEventListener('click', () => {
  menu.style.display = 'none';
});

document.getElementById('menu-stats').onclick = () => {
  const stats = player.getStats();
  alert(`Resolution: ${stats.width}x${stats.height}\nDropped Frames: ${stats.droppedFrames}`);
};
```

### Available Stats from player.getStats()

| Property | Description |
|----------|-------------|
| `decodedFrames` | Total decoded frames |
| `droppedFrames` | Dropped frames (key indicator of stuttering) |
| `estimatedBandwidth` | Estimated network bandwidth |
| `loadLatency` | Video load latency |
| `width` / `height` | Current resolution |
| `streamBandwidth` | Current stream bitrate |

### CSS Styling

```css
.context-menu {
  position: absolute;
  display: none;
  z-index: 1000;
  background: rgba(28, 28, 28, 0.95);
  border: 1px solid #444;
  border-radius: 4px;
  min-width: 150px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
  padding: 5px 0;
}

.context-menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.context-menu li {
  padding: 8px 15px;
  color: #eee;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.context-menu li:hover {
  background: #444;
  color: #fff;
}

.menu-divider {
  height: 1px;
  background: #444;
  margin: 5px 0;
  cursor: default !important;
}
```

---

## 18. Accessibility Features

Shaka Player UI provides:
- Keyboard navigation
- Screen reader support
- High contrast mode support
- ARIA labels for all controls

### ARIA Attributes

All built-in controls include proper ARIA attributes. Custom buttons should follow the same pattern:

```javascript
this.button_.setAttribute('aria-label', 'Custom action');
this.button_.setAttribute('role', 'button');
```

---

## 19. UI Development Checklist

### Pre-development

- [ ] Verify `controls.css` and `shaka-player.ui.js` are loaded
- [ ] Check container has `data-shaka-player-container` attribute (for declarative setup)
- [ ] Ensure proper z-index hierarchy for custom layers

### During Development

- [ ] Test keyboard navigation for accessibility
- [ ] Verify responsive behavior on mobile devices
- [ ] Check `.shaka-mobile` class is applied on mobile
- [ ] Test fullscreen mode behavior

### Performance

- [ ] Throttle `timeupdate` handlers to avoid UI lag
- [ ] Use `requestAnimationFrame` for drag operations
- [ ] Avoid frequent DOM manipulations

### Post-development

- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Verify Chromecast functionality (if enabled)
- [ ] Test with screen readers for accessibility
- [ ] Validate keyboard shortcuts work correctly

---

## 20. Common Issues & Solutions

### UI Not Loading

**Symptoms**: Controls not appearing, JavaScript errors

**Solutions**:
1. Check if `shaka-player.ui.js` is loaded
2. Verify `controls.css` is included
3. Check browser console for errors
4. Ensure `shaka-ui-loaded` event fires

### Cast Button Not Showing

**Symptoms**: No Chromecast button visible

**Solutions**:
1. Verify Chromecast SDK is loaded
2. Check `castReceiverAppId` is set correctly
3. Ensure device is on same network
4. Check if Chrome browser is being used

### VR Not Working

**Symptoms**: VR mode not activating

**Solutions**:
1. Verify content meets VR requirements
2. Check if stream is DRM-protected (not supported)
3. Ensure canvas element is properly configured
4. Verify `displayInVrMode` is enabled

### Controls Auto-hide Too Quickly

**Symptoms**: Controls disappear too fast

**Solution**:
```javascript
ui.configure({
  'fadeControlsInSeconds': 5
});
```

### Custom Button Not Appearing

**Symptoms**: Registered button not visible

**Solutions**:
1. Verify `shaka.ui.Controls.registerElement()` is called before UI initialization
2. Check button name matches in `controlPanelElements`
3. Ensure Factory class is properly defined

### Z-Index Conflicts

**Symptoms**: Custom overlays hidden behind player

**Solutions**:
1. Set custom overlay z-index > 1000
2. Check for conflicting CSS rules
3. Use browser DevTools to inspect stacking context

### Mobile Controls Too Small

**Symptoms**: Buttons hard to tap on mobile

**Solution**:
```css
.shaka-mobile .shaka-video-controls-button {
  padding: 15px !important;
  min-width: 48px;
  min-height: 48px;
}
```

---

## 21. Best Practices

1. **Use declarative setup** when possible for simplicity
2. **Provide fallback sources** for robustness
3. **Test keyboard navigation** for accessibility
4. **Customize controls** to match your application's needs
5. **Handle cast status changes** for better user experience
6. **Use appropriate metadata** for title and poster display
7. **Prefer `ui.configure()` over destroying/recreating UI**
8. **Load custom CSS after `controls.css`** for proper override priority
9. **Scope CSS variables under `.shaka-video-container`** to avoid global pollution
10. **Throttle high-frequency event handlers** for performance

---

## Related Skills

- `shaka-player-basic-usage`: Basic player setup
- `shaka-player-configuration`: Player configuration
- `shaka-player-accessibility`: Accessibility features
- `shaka-player-subtitle-development`: Subtitle integration
- `shaka-player-audio-development`: Audio track management
- `shaka-player-video-source-development`: Video quality control
