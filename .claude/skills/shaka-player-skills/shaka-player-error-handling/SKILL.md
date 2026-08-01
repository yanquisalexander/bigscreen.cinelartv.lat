---
name: "shaka-player-error-handling"
description: "Implements comprehensive error handling for Shaka Player including error codes, severity levels, and retry mechanisms. Invoke when user needs to handle player errors or implement error recovery."
---

# Shaka Player Error Handling

This skill helps you implement comprehensive error handling for Shaka Player, including understanding error codes, severity levels, and implementing retry mechanisms.

## When to Use

Invoke this skill when:
- User needs to handle player errors
- User wants to implement error recovery strategies
- User needs to understand error codes and categories
- User wants to customize retry behavior
- User needs to handle streaming failures

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `error` | object | Yes | Shaka error object to handle |
| `severity` | string | No | Error severity filter (CRITICAL, RECOVERABLE) |
| `category` | number | No | Error category to handle |

## Error Structure

Shaka Player errors are structured objects with:

```javascript
{
  category: number,      // 错误类别
  code: number,          // 具体错误代码
  severity: number,      // 严重程度
  data: Array,           // 附加错误数据
  message: string,       // 人类可读的错误消息
  stack: string          // 堆栈跟踪（调试模式）
}
```

## Error Severity Levels

```javascript
// 错误严重程度
shaka.util.Error.Severity = {
  RECOVERABLE: 1,  // 可恢复错误，播放可以继续
  CRITICAL: 2      // 致命错误，播放无法继续
};
```

## Error Categories

```javascript
// 错误类别
shaka.util.Error.Category = {
  NETWORK: 1,      // 网络错误
  TEXT: 2,         // 文本/字幕错误
  MEDIA: 3,        // 媒体错误
  MANIFEST: 4,     // 清单解析错误
  STREAMING: 5,    // 流媒体错误
  DRM: 6,          // DRM 错误
  PLAYER: 7,       // 播放器错误
  CAST: 8,         // 投屏错误
  STORAGE: 9       // 存储错误
};
```

## Basic Error Handling

### Listening to Errors

```javascript
const player = new shaka.Player();
await player.attach(video);

// 监听播放后的错误
player.addEventListener('error', (event) => {
  handleError(event.detail);
});

// 处理加载时的错误
try {
  await player.load(url);
} catch (e) {
  handleError(e);
}

function handleError(error) {
  if (error instanceof Error) {
    // Shaka 崩溃，抛出原生错误
    console.error('Native error:', error);
    return;
  }

  if (error.severity === shaka.util.Error.Severity.CRITICAL) {
    // 处理致命错误，播放无法继续
    console.error('Critical error:', error.code, error.message);
    // 显示错误消息给用户
    showUserError(error);
  } else {
    // 处理可恢复错误，播放可以继续
    console.warn('Recoverable error:', error.code, error.message);
  }
}
```

### Error Code Lookup

常见错误代码：

| Code | Name | Description |
|------|------|-------------|
| 1001 | BAD_HTTP_STATUS | HTTP 请求失败 |
| 1002 | BAD_HTTP_STATUS | HTTP 请求失败 |
| 1003 | TIMEOUT | 请求超时 |
| 2001 | INVALID_TEXT_HEADER | 无效的文本头部 |
| 3001 | VIDEO_ERROR | 视频解码错误 |
| 4001 | INVALID_MANIFEST | 无效的清单 |
| 6001 | LICENSE_REQUEST_FAILED | 许可证请求失败 |

完整错误代码列表请参考 `shaka.util.Error.Code` API 文档。

## Custom Streaming Error Handling

```javascript
// 自定义流媒体错误处理
player.configure('streaming.failureCallback', (error) => {
  if (error.severity === shaka.util.Error.Severity.CRITICAL) {
    // 自定义致命错误处理
    console.error('Streaming critical error:', error);
    
    // 尝试重试流媒体
    const retryCount = getRetryCount();
    if (retryCount < 3) {
      incrementRetryCount();
      player.retryStreaming();
    } else {
      // 超过重试次数，显示错误
      showUserError(error);
    }
  } else {
    // 自定义可恢复错误处理
    console.warn('Streaming recoverable error:', error);
  }
});
```

## Retry Mechanism

### Network Retry Configuration

```javascript
// 配置网络重试参数
player.configure({
  streaming: {
    retryParameters: {
      maxAttempts: 5,        // 最大尝试次数
      baseDelay: 1000,       // 基础延迟（毫秒）
      backoffFactor: 2,      // 退避因子
      fuzzFactor: 0.5,       // 随机因子
      timeout: 30000         // 超时时间（毫秒）
    }
  }
});
```

### Custom Retry Handling

```javascript
const nwEngine = player.getNetworkingEngine();

// 自定义重试处理
const customRetryHandler = (event) => {
  const code = event.error.code;
  const data = event.error.data;

  // 示例：VOD 清单 404 错误不重试
  if (code === shaka.util.Error.Code.BAD_HTTP_STATUS) {
    if (
      Array.isArray(data) &&
      data[1] === 404 &&
      data[4] === shaka.net.NetworkingEngine.RequestType.MANIFEST
    ) {
      // 阻止默认重试行为
      event.preventDefault();
      console.error('Manifest not found, not retrying');
    }
  }
};

nwEngine.addEventListener('retry', customRetryHandler);

// 加载完成后移除监听器
player.addEventListener('load', () => {
  nwEngine.removeEventListener('retry', customRetryHandler);
});
```

## Debugging Errors

### Using Debug Library

```html
<!-- 使用调试版本获取详细错误信息 -->
<script src="shaka-player.compiled.debug.js"></script>
```

### Setting Log Level

```javascript
// 设置日志级别（仅调试版本可用）
shaka.log.setLevel(shaka.log.Level.DEBUG);  // 调试日志
shaka.log.setLevel(shaka.log.Level.V1);     // 详细日志
shaka.log.setLevel(shaka.log.Level.V2);     // 极详细日志
```

### Error Object Inspection

```javascript
function inspectError(error) {
  console.log('Category:', error.category);
  console.log('Code:', error.code);
  console.log('Severity:', error.severity);
  console.log('Message:', error.message);
  console.log('Data:', error.data);
  console.log('Stack:', error.stack);
  
  // 根据错误类别处理
  switch (error.category) {
    case shaka.util.Error.Category.NETWORK:
      handleNetworkError(error);
      break;
    case shaka.util.Error.Category.DRM:
      handleDrmError(error);
      break;
    case shaka.util.Error.Category.MEDIA:
      handleMediaError(error);
      break;
    default:
      handleGenericError(error);
  }
}
```

## Error Recovery Strategies

### Strategy 1: Retry with Backoff

```javascript
let retryCount = 0;
const maxRetries = 3;

player.addEventListener('error', async (event) => {
  const error = event.detail;
  
  if (error.severity === shaka.util.Error.Severity.CRITICAL && retryCount < maxRetries) {
    retryCount++;
    const delay = Math.pow(2, retryCount) * 1000; // 指数退避
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await player.load(currentManifestUri);
      retryCount = 0; // 重置计数器
    } catch (e) {
      console.error('Retry failed:', e);
    }
  }
});
```

### Strategy 2: Fallback Stream

```javascript
const fallbackManifests = [
  'https://example.com/primary.mpd',
  'https://example.com/backup.mpd',
  'https://example.com/hls/master.m3u8'
];

let currentManifestIndex = 0;

player.addEventListener('error', async (event) => {
  const error = event.detail;
  
  if (error.severity === shaka.util.Error.Severity.CRITICAL) {
    currentManifestIndex++;
    
    if (currentManifestIndex < fallbackManifests.length) {
      try {
        await player.load(fallbackManifests[currentManifestIndex]);
      } catch (e) {
        console.error('Fallback failed:', e);
      }
    } else {
      showUserError('All streams failed');
    }
  }
});
```

### Strategy 3: Quality Degradation

```javascript
player.addEventListener('error', (event) => {
  const error = event.detail;
  
  // 媒体错误时降低质量
  if (error.category === shaka.util.Error.Category.MEDIA) {
    const tracks = player.getVariantTracks();
    const lowerQuality = tracks
      .filter(t => t.bandwidth < currentTrack.bandwidth)
      .sort((a, b) => b.bandwidth - a.bandwidth)[0];
    
    if (lowerQuality) {
      player.selectVariantTrack(lowerQuality);
    }
  }
});
```

## Common Error Scenarios

### 1. Network Errors

```javascript
if (error.category === shaka.util.Error.Category.NETWORK) {
  // 检查网络连接
  if (!navigator.onLine) {
    showOfflineMessage();
  } else {
    // 可能是服务器问题
    retryWithBackoff();
  }
}
```

### 2. DRM Errors

```javascript
if (error.category === shaka.util.Error.Category.DRM) {
  switch (error.code) {
    case shaka.util.Error.Code.LICENSE_REQUEST_FAILED:
      // 许可证服务器问题
      showDrmError('License server unavailable');
      break;
    case shaka.util.Error.Code.REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE:
      // 设备不支持所需的 DRM 级别
      showDrmError('DRM not supported on this device');
      break;
  }
}
```

### 3. Media Errors

```javascript
if (error.category === shaka.util.Error.Category.MEDIA) {
  // 尝试切换到不同的编解码器或质量
  const tracks = player.getVariantTracks();
  const alternativeTrack = tracks.find(t => 
    t.codecs !== currentTrack.codecs
  );
  
  if (alternativeTrack) {
    player.selectVariantTrack(alternativeTrack);
  }
}
```

## Best Practices

1. **Always implement error listeners** - Never ignore errors
2. **Use debug library during development** - Get detailed error information
3. **Implement retry logic** - Network issues are often temporary
4. **Provide user feedback** - Show meaningful error messages
5. **Log errors for analysis** - Help identify patterns and issues
6. **Test error scenarios** - Verify error handling works correctly

## Related Skills

- `shaka-player-basic-usage`: Basic player setup
- `shaka-player-drm-setup`: DRM-specific errors
- `shaka-player-debugging`: Advanced debugging techniques
