---
name: "shaka-player-video-source-development"
description: "Comprehensive guide for video source development including bitrate control, resolution switching, ABR logic, multi-source switching, and quality selection UI. Invoke when user needs to implement quality/resolution controls or ABR functionality."
---

# Shaka Player Video Source Development

This skill provides comprehensive guidance for video source development in Shaka Player, covering bitrate control, resolution switching, ABR (Adaptive Bitrate) logic, multi-source switching, and pseudo-external quality selection implementation.

## When to Use

Invoke this skill when:
- User needs to implement bitrate control mechanisms
- User wants to add resolution switching functionality
- User asks about ABR configuration and customization
- User needs to switch between different video sources (HLS, DASH)
- User wants to implement a quality selection UI
- User asks about manual vs automatic quality switching

## Core Concepts

### Variant Tracks

In Shaka Player, video quality is represented as **Variant Tracks** - combinations of video and audio streams. Understanding this is fundamental to quality control.

```javascript
const tracks = player.getVariantTracks();

tracks.forEach(track => {
  console.log({
    id: track.id,
    active: track.active,
    type: track.type,
    bandwidth: track.bandwidth,
    width: track.width,
    height: track.height,
    frameRate: track.frameRate,
    videoCodec: track.videoCodec,
    audioCodec: track.audioCodec
  });
});
```

---

## Part 1: Bitrate Control Mechanisms

### 1.1 Core API Overview

| Function | Method/Property | Description |
|----------|-----------------|-------------|
| Get quality list | `player.getVariantTracks()` | Returns all available variant tracks |
| Switch quality | `player.selectVariantTrack(track, clearBuffer)` | Force switch to specified track |
| Enable/disable ABR | `player.configure({ 'abr.enabled': boolean })` | Toggle automatic quality switching |
| Set resolution limits | `player.configure({ 'abr.restrictions.maxHeight': 1080 })` | Limit ABR maximum resolution |
| Get current stats | `player.getStats()` | Get real-time playback statistics |

### 1.2 Manual Bitrate Selection

**Important:** You MUST disable ABR before manual selection, otherwise the player will immediately switch back based on network conditions.

```javascript
async function selectBitrateManually(player, targetBandwidth) {
  const tracks = player.getVariantTracks();
  
  const targetTrack = tracks.find(track => track.bandwidth === targetBandwidth);
  
  if (!targetTrack) {
    throw new Error('Target bitrate not available');
  }
  
  player.configure({ 'abr.enabled': false });
  
  player.selectVariantTrack(targetTrack, true);
  
  console.log(`Switched to ${targetTrack.height}p @ ${targetTrack.bandwidth} bps`);
}
```

### 1.3 Automatic Bitrate Adjustment

Configure ABR for automatic bitrate adjustment based on network conditions:

```javascript
player.configure({
  abr: {
    enabled: true,
    defaultBandwidthEstimate: 500000,
    bandwidthUpgradeTarget: 0.85,
    bandwidthDowngradeTarget: 0.95,
    switchInterval: 8,
    restrictions: {
      minBandwidth: 0,
      maxBandwidth: Infinity
    }
  }
});
```

### 1.4 Bandwidth Estimation

Monitor and influence bandwidth estimation:

```javascript
function monitorBandwidth(player) {
  setInterval(() => {
    const stats = player.getStats();
    console.log({
      estimatedBandwidth: stats.estimatedBandwidth,
      streamBandwidth: stats.streamBandwidth,
      decodedFrames: stats.decodedFrames,
      droppedFrames: stats.droppedFrames,
      width: stats.width,
      height: stats.height
    });
  }, 1000);
}
```

---

## Part 2: Resolution Switching

### 2.1 Get Unique Resolutions

Filter duplicate resolutions from variant tracks:

```javascript
function getUniqueResolutions(player) {
  const tracks = player.getVariantTracks();
  
  const qualities = tracks
    .filter((track, index, self) => 
      index === self.findIndex((t) => t.height === track.height)
    )
    .sort((a, b) => b.height - a.height);
  
  return qualities.map(track => ({
    id: track.id,
    height: track.height,
    width: track.width,
    bandwidth: track.bandwidth,
    label: `${track.height}p`,
    active: track.active
  }));
}
```

### 2.2 Manual Resolution Switching

```javascript
async function switchResolution(player, targetHeight, clearBuffer = true) {
  const tracks = player.getVariantTracks();
  const targetTrack = tracks.find(t => t.height === targetHeight);
  
  if (!targetTrack) {
    throw new Error(`Resolution ${targetHeight}p not available`);
  }
  
  player.configure({ 'abr.enabled': false });
  
  player.selectVariantTrack(targetTrack, clearBuffer);
  
  return {
    success: true,
    resolution: `${targetTrack.width}x${targetTrack.height}`,
    bandwidth: targetTrack.bandwidth
  };
}
```

### 2.3 Resolution Restrictions

Limit available resolutions for ABR:

```javascript
function setResolutionLimits(player, minHeight, maxHeight) {
  player.configure({
    abr: {
      restrictions: {
        minHeight: minHeight || 0,
        maxHeight: maxHeight || Infinity
      }
    }
  });
}

function limitTo720p(player) {
  player.configure({
    abr: {
      restrictions: {
        maxHeight: 720
      }
    }
  });
}
```

### 2.4 Resolution Switching with Animation

Implement smooth resolution switching with loading indicator:

```javascript
class ResolutionSwitcher {
  constructor(player, videoElement) {
    this.player = player;
    this.video = videoElement;
    this.loadingOverlay = null;
  }
  
  createLoadingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'resolution-switch-overlay';
    overlay.innerHTML = `
      <div class="spinner"></div>
      <span>Switching to <span class="target-res"></span>...</span>
    `;
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      z-index: 1000;
    `;
    return overlay;
  }
  
  async switchWithAnimation(targetHeight) {
    const container = this.video.parentElement;
    
    if (!this.loadingOverlay) {
      this.loadingOverlay = this.createLoadingOverlay();
    }
    
    this.loadingOverlay.querySelector('.target-res').textContent = `${targetHeight}p`;
    container.appendChild(this.loadingOverlay);
    
    try {
      await this.switchResolution(targetHeight);
      
      await new Promise(resolve => {
        this.video.addEventListener('loadeddata', resolve, { once: true });
      });
      
    } finally {
      this.loadingOverlay.remove();
    }
  }
  
  async switchResolution(targetHeight) {
    const tracks = this.player.getVariantTracks();
    const targetTrack = tracks.find(t => t.height === targetHeight);
    
    if (!targetTrack) {
      throw new Error(`Resolution ${targetHeight}p not available`);
    }
    
    this.player.configure({ 'abr.enabled': false });
    this.player.selectVariantTrack(targetTrack, true);
  }
}
```

---

## Part 3: ABR Logic Implementation

### 3.1 ABR Configuration Options

```javascript
const abrConfig = {
  enabled: true,
  defaultBandwidthEstimate: 1000000,
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
    maxBandwidth: Infinity
  }
};

player.configure({ abr: abrConfig });
```

### 3.2 Custom ABR Manager

Implement a custom ABR manager for advanced control:

```javascript
class CustomAbrManager {
  constructor() {
    this.player = null;
    this.config = {
      bandwidthUpgradeTarget: 0.85,
      bandwidthDowngradeTarget: 0.95,
      switchInterval: 8,
      minBandwidth: 0,
      maxBandwidth: Infinity
    };
    this.lastSwitchTime = 0;
    this.bandwidthHistory = [];
    this.historyMaxLength = 10;
  }
  
  init(player, config = {}) {
    this.player = player;
    this.config = { ...this.config, ...config };
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.player.addEventListener('adaptation', (event) => {
      console.log('ABR adaptation:', event);
      this.onAdaptation(event);
    });
    
    this.player.addEventListener('trackschanged', () => {
      console.log('Available tracks changed');
    });
  }
  
  onAdaptation(event) {
    const now = Date.now();
    const timeSinceLastSwitch = (now - this.lastSwitchTime) / 1000;
    
    if (timeSinceLastSwitch < this.config.switchInterval) {
      console.log('Switching too frequent, ignoring');
      return;
    }
    
    this.lastSwitchTime = now;
    
    const stats = this.player.getStats();
    this.addToBandwidthHistory(stats.estimatedBandwidth);
  }
  
  addToBandwidthHistory(bandwidth) {
    this.bandwidthHistory.push(bandwidth);
    if (this.bandwidthHistory.length > this.historyMaxLength) {
      this.bandwidthHistory.shift();
    }
  }
  
  getAverageBandwidth() {
    if (this.bandwidthHistory.length === 0) return 0;
    const sum = this.bandwidthHistory.reduce((a, b) => a + b, 0);
    return sum / this.bandwidthHistory.length;
  }
  
  chooseVariant(variants) {
    const bandwidth = this.getAverageBandwidth();
    const filteredVariants = variants.filter(v => {
      return v.bandwidth >= this.config.minBandwidth &&
             v.bandwidth <= this.config.maxBandwidth;
    });
    
    filteredVariants.sort((a, b) => b.bandwidth - a.bandwidth);
    
    for (const variant of filteredVariants) {
      if (variant.bandwidth <= bandwidth * this.config.bandwidthUpgradeTarget) {
        return variant;
      }
    }
    
    return filteredVariants[filteredVariants.length - 1] || null;
  }
}
```

### 3.3 ABR Event Handling

```javascript
function setupAbrEventHandlers(player) {
  player.addEventListener('adaptation', (event) => {
    const stats = player.getStats();
    console.log('Quality adapted:', {
      newWidth: stats.width,
      newHeight: stats.height,
      bandwidth: stats.streamBandwidth,
      estimatedBandwidth: stats.estimatedBandwidth
    });
  });
  
  player.addEventListener('trackschanged', () => {
    console.log('Available tracks changed');
    updateQualityUI(player);
  });
  
  player.addEventListener('streaming', (event) => {
    console.log('Streaming event:', event);
  });
}
```

### 3.4 Network-Aware ABR

Adjust ABR behavior based on network type:

```javascript
class NetworkAwareAbr {
  constructor(player) {
    this.player = player;
    this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  }
  
  async init() {
    if (this.connection) {
      this.connection.addEventListener('change', () => this.updateAbrConfig());
      this.updateAbrConfig();
    }
  }
  
  updateAbrConfig() {
    const type = this.connection.effectiveType;
    const downlink = this.connection.downlink;
    
    let config = {};
    
    switch (type) {
      case '4g':
        config = {
          abr: {
            defaultBandwidthEstimate: downlink * 1000000,
            restrictions: { maxHeight: 1080 }
          }
        };
        break;
      case '3g':
        config = {
          abr: {
            defaultBandwidthEstimate: 1500000,
            restrictions: { maxHeight: 720 }
          }
        };
        break;
      case '2g':
        config = {
          abr: {
            defaultBandwidthEstimate: 500000,
            restrictions: { maxHeight: 480 }
          }
        };
        break;
      default:
        config = {
          abr: {
            defaultBandwidthEstimate: 1000000,
            restrictions: { maxHeight: 720 }
          }
        };
    }
    
    this.player.configure(config);
    console.log('ABR config updated for network type:', type);
  }
}
```

---

## Part 4: Multi-Source Switching

### 4.1 Core Concept: Save & Reload

When you have separate video URLs for different qualities (not a master playlist), use the save and reload pattern:

```javascript
async function switchExternalQuality(player, newUri) {
  const video = player.getMediaElement();
  const previousTime = video.currentTime;
  const wasPaused = video.paused;
  
  try {
    await player.load(newUri, previousTime);
    
    if (!wasPaused) {
      await video.play();
    }
    
    console.log('Quality switched successfully');
  } catch (error) {
    console.error('Quality switch failed:', error);
    throw error;
  }
}
```

### 4.2 Multi-Source Manager

```javascript
class MultiSourceManager {
  constructor(player) {
    this.player = player;
    this.sources = new Map();
    this.currentSource = null;
    this.subtitleTracks = [];
  }
  
  registerSource(id, uri, metadata = {}) {
    this.sources.set(id, {
      id,
      uri,
      metadata: {
        label: metadata.label || id,
        height: metadata.height,
        bandwidth: metadata.bandwidth,
        ...metadata
      }
    });
  }
  
  getSources() {
    return Array.from(this.sources.values()).map(s => ({
      id: s.id,
      ...s.metadata
    }));
  }
  
  async switchSource(sourceId) {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }
    
    const video = this.player.getMediaElement();
    const previousTime = video.currentTime;
    const wasPaused = video.paused;
    
    try {
      await this.player.load(source.uri, previousTime);
      
      await this.restoreSubtitles();
      
      if (!wasPaused) {
        await video.play();
      }
      
      this.currentSource = sourceId;
      
      return { success: true, source };
    } catch (error) {
      console.error('Source switch failed:', error);
      throw error;
    }
  }
  
  saveSubtitleTracks() {
    this.subtitleTracks = this.player.getTextTracks()
      .filter(t => t.active)
      .map(t => ({
        uri: t.originalUri || t.uri,
        language: t.language,
        kind: t.kind,
        label: t.label
      }));
  }
  
  async restoreSubtitles() {
    for (const track of this.subtitleTracks) {
      try {
        await this.player.addTextTrackAsync(
          track.uri,
          track.language,
          track.kind,
          track.label
        );
      } catch (e) {
        console.warn('Failed to restore subtitle:', track.uri, e);
      }
    }
  }
}
```

### 4.3 Seamless Source Switching

```javascript
class SeamlessSourceSwitcher {
  constructor(player, videoElement) {
    this.player = player;
    this.video = videoElement;
    this.switching = false;
  }
  
  async switchSource(newUri, options = {}) {
    if (this.switching) {
      throw new Error('Another switch is in progress');
    }
    
    this.switching = true;
    
    const {
      preserveTime = true,
      preservePlaybackState = true,
      timeOffset = 0,
      showLoading = true
    } = options;
    
    const currentTime = this.video.currentTime;
    const wasPaused = this.video.paused;
    const volume = this.video.volume;
    
    if (showLoading) {
      this.showLoadingOverlay();
    }
    
    try {
      const startTime = preserveTime ? currentTime + timeOffset : 0;
      await this.player.load(newUri, startTime);
      
      if (preservePlaybackState && !wasPaused) {
        await this.video.play();
      }
      
      this.video.volume = volume;
      
      return { success: true };
    } catch (error) {
      console.error('Seamless switch failed:', error);
      throw error;
    } finally {
      this.switching = false;
      if (showLoading) {
        this.hideLoadingOverlay();
      }
    }
  }
  
  showLoadingOverlay() {
    let overlay = document.getElementById('source-switch-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'source-switch-overlay';
      overlay.innerHTML = '<div class="spinner"></div><span>Loading...</span>';
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        z-index: 1000;
      `;
      this.video.parentElement.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }
  
  hideLoadingOverlay() {
    const overlay = document.getElementById('source-switch-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
}
```

### 4.4 Cross-Format Source Switching

```javascript
async function switchBetweenFormats(player, manifestUri, format) {
  const video = player.getMediaElement();
  const currentTime = video.currentTime;
  const wasPaused = video.paused;
  
  console.log(`Switching to ${format} format at ${currentTime}s`);
  
  try {
    await player.load(manifestUri, currentTime);
    
    if (!wasPaused) {
      await video.play();
    }
    
    console.log(`Successfully switched to ${format}`);
  } catch (error) {
    console.error(`Failed to switch to ${format}:`, error);
    throw error;
  }
}
```

---

## Part 5: Pseudo-External Quality Selection

### 5.1 Quality Selection UI Component

```javascript
class QualitySelector {
  constructor(player, container) {
    this.player = player;
    this.container = container;
    this.isOpen = false;
    this.currentQuality = 'auto';
    this.init();
  }
  
  init() {
    this.createUI();
    this.setupEventListeners();
    this.updateQualityList();
  }
  
  createUI() {
    this.element = document.createElement('div');
    this.element.className = 'quality-selector';
    this.element.innerHTML = `
      <button class="quality-btn">
        <span class="quality-label">Auto</span>
        <span class="quality-arrow">▼</span>
      </button>
      <div class="quality-menu">
        <div class="quality-option" data-quality="auto">
          <span>Auto</span>
          <span class="quality-info">Adaptive</span>
        </div>
      </div>
    `;
    
    this.container.appendChild(this.element);
    
    this.button = this.element.querySelector('.quality-btn');
    this.menu = this.element.querySelector('.quality-menu');
    this.label = this.element.querySelector('.quality-label');
  }
  
  setupEventListeners() {
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    
    document.addEventListener('click', () => {
      if (this.isOpen) this.close();
    });
    
    this.player.addEventListener('adaptation', () => {
      this.updateCurrentQuality();
    });
    
    this.player.addEventListener('trackschanged', () => {
      this.updateQualityList();
    });
  }
  
  updateQualityList() {
    const tracks = this.getUniqueResolutions();
    const menuItems = tracks.map(track => `
      <div class="quality-option" data-height="${track.height}" data-id="${track.id}">
        <span>${track.label}</span>
        <span class="quality-info">${this.formatBandwidth(track.bandwidth)}</span>
      </div>
    `).join('');
    
    this.menu.innerHTML = `
      <div class="quality-option" data-quality="auto">
        <span>Auto</span>
        <span class="quality-info">Adaptive</span>
      </div>
      ${menuItems}
    `;
    
    this.menu.querySelectorAll('.quality-option').forEach(option => {
      option.addEventListener('click', () => this.selectQuality(option));
    });
  }
  
  getUniqueResolutions() {
    const tracks = this.player.getVariantTracks();
    return tracks
      .filter((track, index, self) => 
        index === self.findIndex((t) => t.height === track.height)
      )
      .sort((a, b) => b.height - a.height)
      .map(track => ({
        id: track.id,
        height: track.height,
        bandwidth: track.bandwidth,
        label: `${track.height}p`,
        active: track.active
      }));
  }
  
  formatBandwidth(bandwidth) {
    if (bandwidth >= 1000000) {
      return `${(bandwidth / 1000000).toFixed(1)} Mbps`;
    }
    return `${(bandwidth / 1000).toFixed(0)} Kbps`;
  }
  
  async selectQuality(option) {
    const quality = option.dataset.quality;
    const height = option.dataset.height;
    
    if (quality === 'auto') {
      this.player.configure({ 'abr.enabled': true });
      this.currentQuality = 'auto';
      this.label.textContent = 'Auto';
    } else {
      const tracks = this.player.getVariantTracks();
      const targetTrack = tracks.find(t => t.height === parseInt(height));
      
      if (targetTrack) {
        this.player.configure({ 'abr.enabled': false });
        this.player.selectVariantTrack(targetTrack, true);
        this.currentQuality = height;
        this.label.textContent = `${height}p`;
      }
    }
    
    this.updateMenuSelection();
    this.close();
  }
  
  updateCurrentQuality() {
    if (this.currentQuality === 'auto') {
      const stats = this.player.getStats();
      if (stats.height) {
        this.label.textContent = `Auto (${stats.height}p)`;
      }
    }
  }
  
  updateMenuSelection() {
    this.menu.querySelectorAll('.quality-option').forEach(option => {
      option.classList.remove('selected');
      
      if (this.currentQuality === 'auto' && option.dataset.quality === 'auto') {
        option.classList.add('selected');
      } else if (option.dataset.height === this.currentQuality) {
        option.classList.add('selected');
      }
    });
  }
  
  toggle() {
    this.isOpen ? this.close() : this.open();
  }
  
  open() {
    this.isOpen = true;
    this.menu.classList.add('open');
  }
  
  close() {
    this.isOpen = false;
    this.menu.classList.remove('open');
  }
}
```

### 5.2 CSS Styles for Quality Selector

```css
.quality-selector {
  position: relative;
  display: inline-block;
}

.quality-btn {
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.quality-btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

.quality-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  border-radius: 4px;
  min-width: 150px;
  display: none;
  margin-bottom: 8px;
  overflow: hidden;
}

.quality-menu.open {
  display: block;
}

.quality-option {
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.quality-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.quality-option.selected {
  background: rgba(255, 255, 255, 0.2);
}

.quality-info {
  font-size: 12px;
  color: #aaa;
}
```

### 5.3 Complete Quality Manager

```javascript
class QualityManager {
  constructor(player, videoElement, options = {}) {
    this.player = player;
    this.video = videoElement;
    this.options = {
      showBandwidth: true,
      autoSwitchInterval: 8,
      ...options
    };
    
    this.externalSources = new Map();
    this.useExternalSources = false;
    this.currentQuality = 'auto';
    
    this.init();
  }
  
  init() {
    this.setupAbrConfig();
    this.setupEventListeners();
  }
  
  setupAbrConfig() {
    this.player.configure({
      abr: {
        enabled: true,
        switchInterval: this.options.autoSwitchInterval
      }
    });
  }
  
  setupEventListeners() {
    this.player.addEventListener('adaptation', (event) => {
      this.onQualityChange(event);
    });
    
    this.player.addEventListener('trackschanged', () => {
      this.onTracksChange();
    });
  }
  
  registerExternalSource(id, uri, metadata) {
    this.externalSources.set(id, { id, uri, ...metadata });
    this.useExternalSources = true;
  }
  
  getAvailableQualities() {
    if (this.useExternalSources) {
      return Array.from(this.externalSources.values());
    }
    
    return this.getUniqueResolutions();
  }
  
  getUniqueResolutions() {
    const tracks = this.player.getVariantTracks();
    return tracks
      .filter((track, index, self) => 
        index === self.findIndex((t) => t.height === track.height)
      )
      .sort((a, b) => b.height - a.height)
      .map(track => ({
        id: track.id,
        height: track.height,
        bandwidth: track.bandwidth,
        label: `${track.height}p`
      }));
  }
  
  async setQuality(qualityId) {
    if (qualityId === 'auto') {
      return this.enableAutoQuality();
    }
    
    if (this.useExternalSources) {
      return this.switchExternalQuality(qualityId);
    }
    
    return this.switchInternalQuality(qualityId);
  }
  
  enableAutoQuality() {
    this.player.configure({ 'abr.enabled': true });
    this.currentQuality = 'auto';
    return { success: true, quality: 'auto' };
  }
  
  async switchInternalQuality(height) {
    const tracks = this.player.getVariantTracks();
    const targetTrack = tracks.find(t => t.height === parseInt(height));
    
    if (!targetTrack) {
      throw new Error(`Quality ${height}p not available`);
    }
    
    this.player.configure({ 'abr.enabled': false });
    this.player.selectVariantTrack(targetTrack, true);
    this.currentQuality = height;
    
    return { success: true, quality: height };
  }
  
  async switchExternalQuality(sourceId) {
    const source = this.externalSources.get(sourceId);
    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }
    
    const currentTime = this.video.currentTime;
    const wasPaused = this.video.paused;
    
    try {
      await this.player.load(source.uri, currentTime);
      
      if (!wasPaused) {
        await this.video.play();
      }
      
      this.currentQuality = sourceId;
      return { success: true, quality: sourceId };
    } catch (error) {
      console.error('External quality switch failed:', error);
      throw error;
    }
  }
  
  onQualityChange(event) {
    const stats = this.player.getStats();
    
    if (this.currentQuality === 'auto') {
      console.log('Auto quality changed:', {
        height: stats.height,
        bandwidth: stats.streamBandwidth
      });
    }
    
    if (this.options.onQualityChange) {
      this.options.onQualityChange({
        height: stats.height,
        bandwidth: stats.streamBandwidth,
        isAuto: this.currentQuality === 'auto'
      });
    }
  }
  
  onTracksChange() {
    if (this.options.onTracksChange) {
      this.options.onTracksChange(this.getAvailableQualities());
    }
  }
  
  getCurrentQuality() {
    const stats = this.player.getStats();
    return {
      selected: this.currentQuality,
      actual: {
        height: stats.height,
        width: stats.width,
        bandwidth: stats.streamBandwidth
      },
      isAuto: this.currentQuality === 'auto'
    };
  }
  
  getStats() {
    return this.player.getStats();
  }
}
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Black Screen After Quality Switch

**Cause:** Buffer not properly cleared during switch

**Solution:**
```javascript
player.selectVariantTrack(track, true);
```

#### 2. Duplicate Resolutions in List

**Cause:** Same resolution with different bandwidths

**Solution:**
```javascript
function getUniqueResolutionsWithBandwidth(player) {
  const tracks = player.getVariantTracks();
  const grouped = {};
  
  tracks.forEach(track => {
    const key = `${track.height}p`;
    if (!grouped[key] || track.bandwidth > grouped[key].bandwidth) {
      grouped[key] = track;
    }
  });
  
  return Object.values(grouped).sort((a, b) => b.height - a.height);
}
```

#### 3. Cannot Reach Highest Quality

**Cause 1:** Browser doesn't support codec

**Solution:**
```javascript
async function checkCodecSupport() {
  const support = await shaka.Player.probeSupport();
  console.log('Supported codecs:', support);
}
```

**Cause 2:** DRM restrictions

**Solution:** Check DRM robustness settings

#### 4. Timestamp Mismatch in Multi-Source

**Cause:** Different source files have different timestamps

**Solution:**
```javascript
async function switchWithOffset(player, newUri, offset = 0.5) {
  const video = player.getMediaElement();
  const time = video.currentTime + offset;
  await player.load(newUri, time);
}
```

#### 5. Subtitles Lost After Source Switch

**Cause:** `player.load()` clears all text tracks

**Solution:**
```javascript
async function switchPreservingSubtitles(player, newUri) {
  const subtitles = player.getTextTracks()
    .filter(t => t.active)
    .map(t => ({ uri: t.originalUri, lang: t.language }));
  
  const video = player.getMediaElement();
  const time = video.currentTime;
  
  await player.load(newUri, time);
  
  for (const sub of subtitles) {
    await player.addTextTrackAsync(sub.uri, sub.lang);
  }
}
```

---

## Best Practices

1. **Always disable ABR before manual selection** - Otherwise player will switch back
2. **Use clearBuffer wisely** - `true` for immediate switch, `false` for smooth transition
3. **Monitor bandwidth history** - Don't react to single bandwidth readings
4. **Implement loading indicators** - Quality switches need visual feedback
5. **Preserve playback state** - Remember time, pause state, and volume
6. **Handle subtitle restoration** - External source switches clear text tracks
7. **Test on various networks** - Verify ABR behavior under different conditions

---

## Related Skills

- `shaka-player-basic-usage`: Basic player setup
- `shaka-player-configuration`: Advanced configuration options
- `shaka-player-error-handling`: Error handling strategies
- `shaka-player-ui-customization`: UI customization
- `shaka-player-audio-development`: Audio track management
