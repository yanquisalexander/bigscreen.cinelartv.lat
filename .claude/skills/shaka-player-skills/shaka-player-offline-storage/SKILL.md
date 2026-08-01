---
name: "shaka-player-offline-storage"
description: "Implements offline storage and playback for DASH/HLS content. Invoke when user needs to download content for offline viewing or manage stored content."
---

# Shaka Player Offline Storage

This skill helps you implement offline storage and playback for DASH and HLS content using Shaka Player's `shaka.offline.Storage` API.

## When to Use

Invoke this skill when:
- User needs to download content for offline playback
- User wants to list stored offline content
- User needs to manage offline storage
- User wants to play downloaded content
- User needs to implement offline DRM support

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `manifestUri` | string | Yes | URL of the manifest to download |
| `metadata` | object | No | Custom metadata to store with content |
| `trackSelectionCallback` | function | No | Custom track selection function |
| `progressCallback` | function | No | Progress callback for downloads |

## Storage API Overview

The `shaka.offline.Storage` API provides methods for:
- `configure()` - Configure storage settings
- `store()` - Download and store content
- `list()` - List all stored content
- `remove()` - Remove stored content

## Initializing Storage

### Basic Initialization

```javascript
// 创建 Storage 实例
const player = new shaka.Player();
await player.attach(video);

const storage = new shaka.offline.Storage(player);

// 配置存储
storage.configure({
  offline: {
    progressCallback: setDownloadProgress,
    trackSelectionCallback: selectTracks
  }
});
```

### Track Selection

```javascript
// 自定义轨道选择（选择最高带宽的变体）
function selectTracks(tracks) {
  // 示例：选择最高带宽的变体
  const found = tracks
    .filter(track => track.type === 'variant')
    .sort((a, b) => a.bandwidth - b.bandwidth)
    .pop();
  
  console.log('Offline track bandwidth:', found.bandwidth);
  return [found];
}
```

## Downloading Content

### Basic Download

```javascript
async function downloadContent(manifestUri, title) {
  // 构建元数据对象
  const metadata = {
    'title': title,
    'downloaded': new Date()
  };
  
  // 存储内容
  const downloadOperation = storage.store(manifestUri, metadata);
  
  // 等待下载完成
  const storedContent = await downloadOperation.promise;
  
  console.log('Download complete:', storedContent.offlineUri);
  return storedContent;
}
```

### Progress Tracking

```javascript
// 设置下载进度回调
function setDownloadProgress(content, progress) {
  const progressBar = document.getElementById('progress-bar');
  progressBar.value = progress * progressBar.max;
  
  console.log(`Download progress: ${Math.round(progress * 100)}%`);
}

storage.configure({
  offline: {
    progressCallback: setDownloadProgress
  }
});
```

### Abort Download

```javascript
// 下载操作可以中止
const downloadOperation = storage.store(manifestUri, metadata);

// 在需要时中止下载
downloadOperation.abort();
```

## Listing Stored Content

```javascript
async function listStoredContent() {
  // 获取所有存储的内容
  const storedContent = await storage.list();
  
  storedContent.forEach(content => {
    console.log('Offline URI:', content.offlineUri);
    console.log('Original URI:', content.originalManifestUri);
    console.log('Size:', content.size);
    console.log('Duration:', content.duration);
    console.log('Metadata:', content.appMetadata);
  });
  
  return storedContent;
}
```

## Playing Offline Content

```javascript
async function playOfflineContent(content) {
  // 离线内容的播放与在线内容相同
  // 只需使用 offlineUri 而不是原始 manifest URI
  await player.load(content.offlineUri);
  
  console.log('Playing offline content');
}
```

## Removing Stored Content

```javascript
async function removeStoredContent(content) {
  // 移除存储的内容
  await storage.remove(content.offlineUri);
  
  console.log('Content removed:', content.offlineUri);
}
```

## Complete Example

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="dist/shaka-player.compiled.js"></script>
    <script src="myapp.js"></script>
    <style>
      table, th, td { border: 1px solid black; }
    </style>
  </head>
  <body>
    <div id='online-signal' style='width:640px;text-align:center'></div>
    
    <div>
      <div>
        <span style="width:120px;display:inline-block">Asset Name</span>
        <input id="asset-title-input" type="text" style="width:500px" 
               value="Star Trek: Angel One">
      </div>
      <div>
        <span style="width:120px;display:inline-block">Asset Manifest</span>
        <input id="asset-uri-input" type="text" style="width:500px" 
               value="//storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd">
      </div>
    </div>

    <div>
      <span><progress id="progress-bar" value="0" max="100"></span>
      <span><button id="download-button">Download</button></span>
    </div>

    <video id="video" width="640" controls autoplay></video>
    <table id="content-table" style="width:640px"></table>
  </body>
</html>
```

```javascript
// myapp.js

let storage;

async function initApp() {
  shaka.polyfill.installAll();
  
  if (shaka.Player.isBrowserSupported()) {
    await initPlayer();
  } else {
    console.error('Browser not supported!');
  }
  
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

async function initPlayer() {
  const video = document.getElementById('video');
  const player = new shaka.Player();
  await player.attach(video);
  
  window.player = player;
  player.addEventListener('error', onErrorEvent);
  
  // 初始化存储
  storage = new shaka.offline.Storage(player);
  storage.configure({
    offline: {
      progressCallback: setDownloadProgress,
      trackSelectionCallback: selectTracks
    }
  });
  
  document.getElementById('download-button').onclick = onDownloadClick;
  refreshContentList();
}

function selectTracks(tracks) {
  // 选择最高带宽的变体
  const found = tracks
    .filter(track => track.type === 'variant')
    .sort((a, b) => a.bandwidth - b.bandwidth)
    .pop();
  
  return [found];
}

function setDownloadProgress(content, progress) {
  const progressBar = document.getElementById('progress-bar');
  progressBar.value = progress * progressBar.max;
}

async function onDownloadClick() {
  const downloadButton = document.getElementById('download-button');
  const manifestUri = document.getElementById('asset-uri-input').value;
  const title = document.getElementById('asset-title-input').value;
  
  downloadButton.disabled = true;
  setDownloadProgress(null, 0);
  
  try {
    const metadata = {
      'title': title,
      'downloaded': new Date()
    };
    
    await storage.store(manifestUri, metadata).promise;
    await refreshContentList();
    
    setDownloadProgress(null, 1);
  } catch (error) {
    onError(error);
  } finally {
    downloadButton.disabled = false;
  }
}

async function refreshContentList() {
  const contentTable = document.getElementById('content-table');
  
  // 清空表格
  while (contentTable.rows.length) {
    contentTable.deleteRow(0);
  }
  
  // 列出存储的内容
  const storedContent = await storage.list();
  
  storedContent.forEach(content => {
    const row = contentTable.insertRow(-1);
    row.insertCell(-1).innerHTML = content.appMetadata.title;
    row.insertCell(-1).innerHTML = new Date(content.appMetadata.downloaded).toLocaleDateString();
    
    // 播放按钮
    const playButton = document.createElement('button');
    playButton.innerHTML = 'PLAY';
    playButton.onclick = () => player.load(content.offlineUri);
    row.insertCell(-1).appendChild(playButton);
    
    // 删除按钮
    const removeButton = document.createElement('button');
    removeButton.innerHTML = 'REMOVE';
    removeButton.onclick = async () => {
      await storage.remove(content.offlineUri);
      await refreshContentList();
    };
    row.insertCell(-1).appendChild(removeButton);
  });
}

function updateOnlineStatus() {
  const signal = document.getElementById('online-signal');
  if (navigator.onLine) {
    signal.innerHTML = 'ONLINE';
    signal.style.background = 'green';
  } else {
    signal.innerHTML = 'OFFLINE';
    signal.style.background = 'grey';
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

## Protected Content Offline

### Persistent License Support

Platform support for persistent licenses:
- ✅ **Android** (M62+)
- ✅ **Chromebooks**
- ✅ **Chrome** (v64-v142 on Windows/Mac)
- ❌ **Other platforms**

### Disable Persistent License

For platforms without persistent license support:

```javascript
storage.configure({
  offline: {
    usePersistentLicense: false
  }
});
```

**Note**: With `usePersistentLicense: false`, you need a network connection at playback time to retrieve licenses.

### Enable Persistent License

```javascript
storage.configure({
  offline: {
    usePersistentLicense: true  // 默认值
  }
});
```

## IndexedDB Configuration

### Set Storage Timeout

```javascript
// 设置 IndexedDB 打开超时（秒）
shaka.offline.indexeddb.StorageMechanismOpenTimeout = 10;

// 禁用超时（无限等待）
shaka.offline.indexeddb.StorageMechanismOpenTimeout = false;
```

**Important**: Configure timeout before any offline storage operations.

## Stored Content Structure

```javascript
{
  offlineUri: string,           // 离线播放 URI
  originalManifestUri: string,  // 原始清单 URI
  size: number,                 // 存储大小（字节）
  duration: number,             // 内容时长（秒）
  tracks: Array,                // 存储的轨道列表
  appMetadata: object           // 应用自定义元数据
}
```

## Best Practices

1. **Track Selection**: Choose appropriate quality for offline storage
2. **Metadata**: Store useful metadata (title, thumbnail, etc.)
3. **Progress Feedback**: Show download progress to users
4. **Error Handling**: Handle download failures gracefully
5. **Storage Management**: Monitor and manage storage space
6. **License Management**: Understand platform DRM limitations

## Common Issues

### 1. Download Fails

- Check network connectivity
- Verify manifest URL is accessible
- Check CORS headers on server
- Verify DRM configuration for protected content

### 2. Playback Fails

- Check if content was downloaded completely
- Verify DRM license availability
- Check storage integrity

### 3. Storage Full

- Monitor available storage space
- Implement cleanup of old content
- Allow users to manage stored content

## Related Skills

- `shaka-player-basic-usage`: Basic player setup
- `shaka-player-drm-setup`: DRM configuration for offline
- `shaka-player-error-handling`: Handle offline errors
