---
name: "shaka-player-drm-setup"
description: "Configures DRM (Widevine, PlayReady, FairPlay) for protected content playback. Invoke when user needs to set up encrypted media or configure license servers."
---

# Shaka Player DRM Setup

This skill helps you configure Digital Rights Management (DRM) systems including Widevine, PlayReady, and FairPlay for protected content playback.

## When to Use

Invoke this skill when:
- User needs to play DRM-protected content
- User wants to configure license servers
- User needs to set up Clear Key for testing
- User asks about DRM robustness settings
- User needs to configure FairPlay on Safari

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `licenseServers` | object | Yes | Map of key system IDs to license server URLs |
| `advancedConfig` | object | No | Advanced DRM configuration options |
| `clearKeys` | object | No | Clear Key configuration for testing |

## Important Security Requirements

**EME requires secure URLs:**
- Use `https://` or `localhost`
- Mixed content: if your site uses HTTPS, manifest and segments must also use HTTPS
- Currently enforced by Chrome, other browsers will follow

## Basic DRM Configuration

### Setting License Servers

```javascript
// 配置 Widevine 和 PlayReady 许可证服务器
player.configure({
  drm: {
    servers: {
      'com.widevine.alpha': 'https://foo.bar/drm/widevine',
      'com.microsoft.playready': 'https://foo.bar/drm/playready'
    }
  }
});
```

### Key System Selection

Shaka Player is key-system-agnostic:
- Uses EME to query browser support
- Prefers first supported key system in manifest
- Supports Common Encryption (CENC)

For CENC-only manifests:

```xml
<ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc"/>
```

Shaka will try all known key systems based on `keySystemsByURI` configuration.

## Clear Key Configuration

### Using Clear Key for Testing

```javascript
// 使用 Clear Key 进行测试（需要 hex 格式的 key ID 和 key）
player.configure({
  drm: {
    clearKeys: {
      // 'key-id-in-hex': 'key-in-hex'
      'deadbeefdeadbeefdeadbeefdeadbeef': '18675309186753091867530918675309',
      '02030507011013017019023029031037': '03050701302303204201080425098033'
    }
  }
});
```

### Clear Key License Server

```javascript
// 使用 Clear Key 许可证服务器
player.configure({
  drm: {
    servers: {
      'org.w3.clearkey': 'http://foo.bar/drm/clearkey'
    }
  }
});
```

## Advanced DRM Configuration

### Robustness Settings

```javascript
// 配置 Widevine 硬件安全级别
player.configure({
  drm: {
    servers: {
      'com.widevine.alpha': 'https://foo.bar/drm/widevine'
    },
    advanced: {
      'com.widevine.alpha': {
        'videoRobustness': ['HW_SECURE_ALL'],
        'audioRobustness': ['HW_SECURE_ALL']
      }
    }
  }
});
```

### Multiple Robustness Levels

```javascript
// 设置多个安全级别（按优先级尝试）
player.configure({
  drm: {
    servers: {
      'com.widevine.alpha': 'https://foo.bar/drm/widevine'
    },
    advanced: {
      'com.widevine.alpha': {
        'videoRobustness': ['HW_SECURE_ALL', 'SW_SECURE_CRYPTO'],
        'audioRobustness': ['HW_SECURE_ALL', 'SW_SECURE_CRYPTO']
      }
    }
  }
});
```

### Custom Headers

```javascript
// 为许可证请求添加自定义头部
player.configure({
  drm: {
    servers: {
      'com.widevine.alpha': 'https://foo.bar/drm/widevine'
    },
    advanced: {
      'com.widevine.alpha': {
        'headers': {
          'customHeader1': 'value1',
          'customHeader2': 'value2'
        }
      }
    }
  }
});
```

## Robustness Levels

### Widevine Robustness

- `SW_SECURE_CRYPTO` - 软件加密
- `SW_SECURE_DECODE` - 软件解码
- `HW_SECURE_CRYPTO` - 硬件加密
- `HW_SECURE_DECODE` - 硬件解码
- `HW_SECURE_ALL` - 最高硬件安全

### PlayReady Robustness

- `3000` - 最高安全级别
- `2000` - 中等安全级别（默认）
- `150` - 最低安全级别

### FairPlay Robustness

Use empty string `''` as robustness value.

## Persistent License

### Enable Persistent License

```javascript
// 启用持久许可证（用于离线播放）
player.configure({
  drm: {
    advanced: {
      'com.widevine.alpha': {
        'sessionType': 'persistent-license'
      }
    }
  }
});
```

### Reuse Persistent License

```javascript
// 重用持久许可证进行在线播放
player.configure({
  drm: {
    persistentSessionOnlinePlayback: true,
    persistentSessionsMetadata: [{
      sessionId: 'deadbeefdeadbeefdeadbeefdeadbeef',
      initData: new InitData(0),
      initDataType: 'cenc'
    }]
  }
});
```

## HDCP Requirements

```javascript
// 设置最低 HDCP 版本要求
player.configure({
  drm: {
    minHdcpVersion: '2.3'
  }
});
```

Supported values: `1.0`, `1.1`, `1.2`, `1.3`, `1.4`, `2.0`, `2.1`, `2.2`, `2.3`

## Key System Mapping

### Custom Key System Mapping

```javascript
// 自定义密钥系统映射
player.configure({
  manifest: {
    dash: {
      keySystemsByURI: {
        'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95': 'com.microsoft.playready.recommendation',
        'urn:uuid:79f0049a-4098-8642-ab92-e65be0885f95': 'com.microsoft.playready.recommendation'
      }
    }
  }
});
```

### Key System Alias Mapping

```javascript
// 使用别名映射密钥系统
player.configure({
  drm: {
    keySystemsMapping: {
      'com.microsoft.playready': 'com.microsoft.playready.recommendation'
    }
  }
});
```

## Platform Support

### Persistent License Support

- **Android** (M62+): ✅ Supported
- **Chromebooks**: ✅ Supported
- **Chrome** (v64-v142 on Windows/Mac): ✅ Was supported
- **Other platforms**: ❌ Not supported

For platforms without persistent license support:

```javascript
// 禁用持久许可证（需要网络连接进行播放）
player.configure({
  drm: {
    usePersistentLicense: false
  }
});
```

## Common Errors

1. **REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE**
   - Robustness level too high for device
   - Key system not supported by browser

2. **LICENSE_REQUEST_FAILED**
   - License server unreachable
   - Invalid license server URL
   - CORS issues

3. **BAD_HTTP_STATUS**
   - License server returned error status
   - Authentication failed

## Best Practices

1. **Testing**: Use Clear Key to verify keys and content
2. **Robustness**: Start with lower levels, increase as needed
3. **Headers**: Configure authentication headers for license servers
4. **Fallback**: Provide multiple robustness levels for device compatibility
5. **Security**: Always use HTTPS for license servers

## Related Skills

- `shaka-player-configuration`: General player configuration
- `shaka-player-offline-storage`: Offline playback with DRM
- `shaka-player-error-handling`: DRM error handling
