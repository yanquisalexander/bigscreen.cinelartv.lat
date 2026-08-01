---
name: "shaka-player-plugin-development"
description: "Develops custom plugins for Shaka Player including manifest parsers, text parsers, networking plugins, and ABR managers. Invoke when user needs to extend or customize player functionality."
---

# Shaka Player Plugin Development

This skill helps you develop custom plugins for Shaka Player to extend and customize functionality in areas like manifest parsing, text parsing, networking, ABR, and polyfills.

## When to Use

Invoke this skill when:
- User needs to create a custom manifest parser
- User wants to develop a text/caption parser
- User needs to implement a custom networking plugin
- User wants to create a custom ABR manager
- User needs to add browser polyfills

## Plugin Types

Shaka Player supports these plugin interfaces:

| Plugin Type | Selection Method | Registration |
|-------------|------------------|--------------|
| Manifest Parser | File extension / MIME type | `shaka.media.ManifestParser.registerParserByExtension`<br>`shaka.media.ManifestParser.registerParserByMime` |
| Text Parser | MIME type | `shaka.text.TextEngine.registerParser` |
| Text Displayer | Runtime configuration | `player.configure('textDisplayFactory')` |
| Networking Plugin | URI scheme | `shaka.net.NetworkingEngine.registerScheme` |
| ABR Manager | Runtime configuration | `player.configure('abrFactory')` |
| Polyfill | Auto-install | `shaka.polyfill.register` |

## Manifest Parser Plugin

### Interface

```javascript
/**
 * @interface
 */
shaka.media.ManifestParser = class {
  /**
   * 解析清单
   * @param {string} uri
   * @param {shaka.extern.ManifestParser.PlayerInterface} playerInterface
   * @return {!Promise.<shaka.extern.Manifest>}
   */
  async parse(uri, playerInterface) {}
  
  /**
   * 停止解析
   */
  stop() {}
  
  /**
   * 更新清单
   * @return {!Promise}
   */
  async update() {}
  
  /**
   * 事件监听
   * @param {string} name
   * @param {function(*)} callback
   */
  on(name, callback) {}
}
```

### Example: Custom Manifest Parser

```javascript
/**
 * 自定义清单解析器
 * @implements {shaka.media.ManifestParser}
 */
class MyManifestParser {
  constructor() {
    this.playerInterface_ = null;
  }
  
  async parse(uri, playerInterface) {
    this.playerInterface_ = playerInterface;
    
    // 获取清单数据
    const response = await playerInterface.networkingEngine.request(
      'manifest',
      shaka.net.NetworkingEngine.RequestType.MANIFEST,
      {uris: [uri], method: 'GET'}
    );
    
    // 解析清单
    const manifest = this.parseManifest_(response.data);
    
    return manifest;
  }
  
  parseManifest_(data) {
    // 解析逻辑
    return {
      presentationTimeline: /* ... */,
      variants: /* ... */,
      textStreams: /* ... */,
      imageStreams: /* ... */
    };
  }
  
  stop() {
    // 清理资源
  }
  
  async update() {
    // 更新清单（用于直播）
  }
  
  on(name, callback) {
    // 事件监听
  }
}

// 注册解析器
shaka.media.ManifestParser.registerParserByExtension('myformat', MyManifestParser);
shaka.media.ManifestParser.registerParserByMime('application/x-myformat', MyManifestParser);
```

## Text Parser Plugin

### Interface

```javascript
/**
 * @interface
 */
shaka.extern.TextParser = class {
  /**
   * 解析文本轨道
   * @param {BufferSource} data
   * @param {shaka.extern.TextParser.TimeContext} timeContext
   * @return {!Array.<shaka.extern.Cue>}
   */
  parse(data, timeContext) {}
}
```

### Example: Custom Text Parser

```javascript
/**
 * 自定义字幕解析器
 * @implements {shaka.extern.TextParser}
 */
class MyTextParser {
  parse(data, timeContext) {
    const text = shaka.util.StringUtils.fromUTF8(data);
    const cues = [];
    
    // 解析字幕文本
    const lines = text.split('\n');
    
    for (const line of lines) {
      const cue = this.parseLine_(line, timeContext);
      if (cue) {
        cues.push(cue);
      }
    }
    
    return cues;
  }
  
  parseLine_(line, timeContext) {
    // 解析单行字幕
    // 返回 shaka.extern.Cue 对象
    return {
      startTime: /* ... */,
      endTime: /* ... */,
      payload: /* ... */,
      // 其他属性...
    };
  }
}

// 注册解析器
shaka.text.TextEngine.registerParser('text/x-myformat', MyTextParser);
```

## Text Displayer Plugin

### Interface

```javascript
/**
 * @interface
 */
shaka.extern.TextDisplayer = class {
  /**
   * 初始化
   * @param {HTMLMediaElement} video
   */
  initialize(video) {}
  
  /**
   * 移除字幕
   */
  remove(start, end) {}
  
  /**
   * 添加字幕
   * @param {shaka.extern.Cue} cue
   */
  append(cue) {}
  
  /**
   * 销毁
   */
  destroy() {}
  
  /**
   * 是否已初始化
   * @return {boolean}
   */
  isInitialized() {}
}
```

### Example: Custom Text Displayer

```javascript
/**
 * 自定义字幕显示器
 * @implements {shaka.extern.TextDisplayer}
 */
class MyTextDisplayer {
  constructor() {
    this.video_ = null;
    this.cues_ = [];
  }
  
  initialize(video) {
    this.video_ = video;
  }
  
  append(cue) {
    this.cues_.push(cue);
    this.renderCue_(cue);
  }
  
  remove(start, end) {
    this.cues_ = this.cues_.filter(cue => 
      cue.startTime < start || cue.endTime > end
    );
    this.updateDisplay_();
  }
  
  destroy() {
    this.cues_ = [];
    this.video_ = null;
  }
  
  isInitialized() {
    return this.video_ != null;
  }
  
  renderCue_(cue) {
    // 自定义渲染逻辑
  }
  
  updateDisplay_() {
    // 更新显示
  }
}

// 配置使用自定义显示器
player.configure('textDisplayFactory', () => new MyTextDisplayer());
```

## Networking Plugin

### Interface

```javascript
/**
 * @interface
 */
shaka.extern.NetworkingPlugin = class {
  /**
   * 执行网络请求
   * @param {string} uri
   * @param {shaka.extern.Request} request
   * @param {shaka.net.NetworkingEngine.RequestType} requestType
   * @return {!shaka.extern.IAbortableOperation.<shaka.extern.Response>}
   */
  request(uri, request, requestType) {}
}
```

### Example: Custom Networking Plugin

```javascript
/**
 * 自定义网络插件
 * @implements {shaka.extern.NetworkingPlugin}
 */
class MyNetworkingPlugin {
  static request(uri, request, requestType) {
    const abortController = new AbortController();
    
    const operation = new shaka.util.AbortableOperation(async () => {
      // 自定义请求逻辑
      const response = await fetch(uri, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: abortController.signal
      });
      
      // 返回响应
      return {
        uri: response.url,
        data: await response.arrayBuffer(),
        headers: this.parseHeaders_(response.headers)
      };
    }, () => {
      // 中止操作
      abortController.abort();
    });
    
    return operation;
  }
  
  static parseHeaders_(headers) {
    const result = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

// 注册插件
shaka.net.NetworkingEngine.registerScheme('myprotocol', MyNetworkingPlugin);
```

## ABR Manager Plugin

### Interface

```javascript
/**
 * @interface
 */
shaka.extern.AbrManager = class {
  /**
   * 初始化
   * @param {shaka.extern.AbrManager.PlayerInterface} playerInterface
   */
  init(playerInterface) {}
  
  /**
   * 选择变体
   * @return {shaka.extern.Variant}
   */
  chooseVariant() {}
  
  /**
   * 设置变体列表
   * @param {Array.<shaka.extern.Variant>} variants
   */
  setVariants(variants) {}
  
  /**
   * 启用/禁用
   * @param {boolean} enabled
   */
  enable(enabled) {}
  
  /**
   * 停止
   */
  stop() {}
  
  /**
   * 片段下载完成回调
   * @param {number} bandwidth
   */
  segmentDownloaded(bandwidth) {}
  
  /**
   * 获取带宽估计
   * @return {number}
   */
  getBandwidthEstimate() {}
}
```

### Example: Custom ABR Manager

```javascript
/**
 * 自定义 ABR 管理器
 * @implements {shaka.extern.AbrManager}
 */
class MyAbrManager {
  constructor() {
    this.playerInterface_ = null;
    this.variants_ = [];
    this.enabled_ = true;
    this.bandwidthEstimate_ = 500000;
  }
  
  init(playerInterface) {
    this.playerInterface_ = playerInterface;
  }
  
  chooseVariant() {
    if (!this.enabled_ || this.variants_.length === 0) {
      return null;
    }
    
    // 自定义选择逻辑
    // 根据带宽估计选择合适的变体
    const sortedVariants = this.variants_
      .filter(v => v.bandwidth <= this.bandwidthEstimate_)
      .sort((a, b) => b.bandwidth - a.bandwidth);
    
    return sortedVariants[0] || this.variants_[0];
  }
  
  setVariants(variants) {
    this.variants_ = variants;
  }
  
  enable(enabled) {
    this.enabled_ = enabled;
  }
  
  stop() {
    this.variants_ = [];
  }
  
  segmentDownloaded(bandwidth) {
    // 更新带宽估计
    this.bandwidthEstimate_ = this.calculateBandwidth_(bandwidth);
  }
  
  getBandwidthEstimate() {
    return this.bandwidthEstimate_;
  }
  
  calculateBandwidth_(measuredBandwidth) {
    // 自定义带宽计算逻辑
    return measuredBandwidth;
  }
}

// 配置使用自定义 ABR 管理器
player.configure('abrFactory', () => new MyAbrManager());
```

## Polyfill Plugin

### Example: Custom Polyfill

```javascript
/**
 * 自定义 Polyfill
 */
class MyPolyfill {
  static install() {
    // 检查是否需要 polyfill
    if (!window.myCustomAPI) {
      window.myCustomAPI = {
        // 实现 polyfill
      };
    }
  }
}

// 注册 polyfill
shaka.polyfill.register(MyPolyfill.install);
```

## Plugin Registration Patterns

### In Application (Uncompiled)

```javascript
// 在应用中注册插件（不需要编译）
// 加载库后注册
shaka.media.ManifestParser.registerParserByExtension('myformat', MyManifestParser);
shaka.text.TextEngine.registerParser('text/x-myformat', MyTextParser);
shaka.net.NetworkingEngine.registerScheme('myprotocol', MyNetworkingPlugin);
```

### In Build (Compiled)

```javascript
// 在源文件末尾注册（会被编译进库）
// my_plugin.js

goog.provide('my.Plugin');

// 插件实现...

// 注册插件
shaka.media.ManifestParser.registerParserByExtension(
  'myformat', 
  my.Plugin.ManifestParser
);
```

## Excluding Default Plugins

```bash
# 排除默认插件以减小体积
python3 build/build.py +@complete -lib/text/mp4_ttml_parser.js

# 排除整个类别
python3 build/build.py +@complete -@polyfill
python3 build/build.py +@complete -@text
```

## Adding Custom Plugins to Build

```bash
# 添加单个源文件
python3 build/build.py +@complete +my_plugin.js

# 添加多个源文件
python3 build/build.py +@complete +my_plugin.js +/path/to/other_plugin.js
```

## Custom Build Config

```bash
# 创建自定义构建配置文件
# build/types/my_custom_build:

# Start with complete library
+@complete
# Drop subtitle support
-@text
# Remove default networking plugins
-@networking
# Add custom HTTP implementation
+/path/to/my_http_plugin.js
# Add custom polyfill
+/path/to/my_polyfill.js
```

## Best Practices

1. **Follow interfaces**: Implement all required methods
2. **Handle errors**: Return proper error types
3. **Support abort**: Implement abortable operations for async work
4. **Test thoroughly**: Test with various content types
5. **Document**: Provide clear documentation for your plugins
6. **Contribute back**: Consider contributing useful plugins to the community

## Related Skills

- `shaka-player-build-customization`: Build system configuration
- `shaka-player-configuration`: Runtime configuration
- `shaka-player-basic-usage`: Basic player setup
