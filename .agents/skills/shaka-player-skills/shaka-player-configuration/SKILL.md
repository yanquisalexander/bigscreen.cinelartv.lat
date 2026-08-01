---
name: "shaka-player-configuration"
description: "Configures Shaka Player settings for streaming, buffering, ABR, and language preferences. Invoke when user needs to customize player behavior or optimize playback settings."
---

# Shaka Player Configuration

This skill helps you configure Shaka Player's hierarchical configuration system for streaming, buffering, ABR (Adaptive Bitrate), language preferences, and other player behaviors.

## When to Use

Invoke this skill when:
- User needs to customize player configuration
- User wants to optimize buffering or streaming settings
- User needs to set language preferences
- User asks about ABR configuration
- User wants to enable low latency streaming

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config` | object | Yes | Configuration object with player settings |
| `path` | string | No | Dot-notation path for single field configuration |
| `value` | any | No | Value for single field configuration |

## Configuration Structure

Shaka Player uses a hierarchical configuration system with these main sections:

### Streaming Configuration

```javascript
player.configure({
  streaming: {
    bufferingGoal: 10,           // 目标缓冲时长（秒）
    rebufferingGoal: 0,          // 重新缓冲目标（秒）
    bufferBehind: 30,            // 后向缓冲时长（秒）
    safeSeekOffset: 5,           // 安全跳转偏移（秒）
    startAtSegmentBoundary: false,
    ignoreTextStreamFailures: false,
    segmentPrefetchLimit: 0,     // 预取分段限制
    durationBackoff: 1,
    failureCallback: (error) => {
      // 自定义流媒体错误处理
    }
  }
});
```

### ABR Configuration

```javascript
player.configure({
  abr: {
    enabled: true,
    defaultBandwidthEstimate: 500000,  // 默认带宽估计（bps）
    bandwidthUpgradeTarget: 0.85,      // 带宽升级目标
    bandwidthDowngradeTarget: 0.95,    // 带宽降级目标
    switchInterval: 8,                  // 切换间隔（秒）
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
  }
});
```

### Language Preferences

```javascript
player.configure({
  preferredAudioLanguage: 'en-US',    // 首选音频语言
  preferredTextLanguage: 'es',        // 首选字幕语言
  preferredAudioLabel: '',            // 首选音频标签
  preferredVideoLabel: '',            // 首选视频标签
  preferForcedSubs: false             // 优先使用强制字幕
});
```

### Manifest Configuration

```javascript
player.configure({
  manifest: {
    retryParameters: {
      maxAttempts: 2,
      baseDelay: 1000,
      backoffFactor: 2,
      fuzzFactor: 0.5,
      timeout: 0
    },
    dash: {
      autoCorrectDrift: true,
      ignoreDrmInfo: false,
      xlinkFailGracefully: false,
      ignoreMinBufferTime: false,
      initialSegmentLimit: 1000
    }
  }
});
```

## Configuration Methods

### Method 1: Object-based Configuration

```javascript
// 设置多个配置项
player.configure({
  streaming: {
    bufferingGoal: 120
  },
  preferredAudioLanguage: 'fr-CA'
});
```

### Method 2: Path-based Configuration

```javascript
// 设置单个配置项
player.configure('streaming.bufferingGoal', 120);
```

### Method 3: Revert to Default

```javascript
// 将特定字段恢复为默认值
player.configure({
  streaming: {
    bufferingGoal: undefined  // 设置为 undefined 恢复默认
  }
});
```

## Low Latency Streaming

对于低延迟流媒体，启用特殊配置：

```javascript
// 启用低延迟模式
player.configure('streaming.lowLatencyMode', true);

// 自定义低延迟配置
player.configurationForLowLatency({
  streaming: {
    inaccurateManifestTolerance: 0,
    segmentPrefetchLimit: 2,
    updateIntervalSeconds: 0.1,
    maxDisabledTime: 1,
    retryParameters: {
      baseDelay: 100
    }
  },
  manifest: {
    dash: {
      autoCorrectDrift: true
    },
    retryParameters: {
      baseDelay: 100
    }
  }
});
```

## Viewing Current Configuration

```javascript
// 获取当前完整配置
const config = player.getConfiguration();
console.log(config);

// 检查特定配置值
console.log(player.getConfiguration().streaming.bufferingGoal);
```

## Configuration Timing

不同配置项的生效时机：

### Immediate Effect
- 网络设置
- 缓冲设置
- ABR 设置

### Next Load Effect
- DRM 设置
- Manifest 设置
- 语言偏好设置

这些配置只在下次调用 `player.load()` 时生效。

## Common Use Cases

### 1. 优化缓冲策略

```javascript
// 高质量缓冲（适合高速网络）
player.configure({
  streaming: {
    bufferingGoal: 300,      // 5分钟缓冲
    rebufferingGoal: 30,     // 30秒重新缓冲目标
    bufferBehind: 60         // 保留60秒后向缓冲
  }
});
```

### 2. 限制带宽使用

```javascript
// 限制最大带宽（适合移动网络）
player.configure({
  abr: {
    restrictions: {
      maxBandwidth: 2000000  // 限制为 2 Mbps
    }
  }
});
```

### 3. 限制分辨率

```javascript
// 限制最大分辨率
player.configure({
  abr: {
    restrictions: {
      maxWidth: 1920,
      maxHeight: 1080
    }
  }
});
```

## Best Practices

1. **缓冲设置**: 根据网络条件调整 `bufferingGoal` 和 `rebufferingGoal`
2. **ABR 调优**: 调整 `bandwidthUpgradeTarget` 和 `bandwidthDowngradeTarget` 控制切换频率
3. **语言偏好**: 在调用 `load()` 前设置语言偏好
4. **低延迟**: 使用 `lowLatencyMode` 和相关配置优化实时流

## Related Skills

- `shaka-player-basic-usage`: Basic player setup
- `shaka-player-drm-setup`: DRM configuration
- `shaka-player-network-and-buffering`: Advanced networking configuration
