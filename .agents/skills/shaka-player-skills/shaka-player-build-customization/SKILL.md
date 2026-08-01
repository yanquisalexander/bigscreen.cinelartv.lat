---
name: "shaka-player-build-customization"
description: "Customizes Shaka Player builds to include or exclude specific features. Invoke when user needs to optimize bundle size or create custom build configurations."
---

# Shaka Player Build Customization

This skill helps you customize Shaka Player builds to optimize bundle size and include only the features you need.

## When to Use

Invoke this skill when:
- User needs to reduce bundle size
- User wants to exclude unused features
- User needs to create custom build configurations
- User wants to add custom plugins to the build
- User needs to understand the build system

## Build System Overview

Shaka Player uses **Python + Java (Closure Compiler)** for building:

- **Closure Compiler**: Advanced optimizations, dead code elimination
- **Python scripts**: Build orchestration
- **Node.js**: Tooling scripts

## Prerequisites

- **Git** v1.9+
- **Python** v3.5+
- **Java Runtime Environment** v21+
- **Node.js** v18+

### Install Prerequisites (Ubuntu/Debian)

```bash
curl https://raw.githubusercontent.com/shaka-project/shaka-player/main/build/install-linux-prereqs.sh | bash
```

## Basic Build Commands

### Full Build

```bash
# 完整构建（lint、类型检查、编译、文档）
python3 build/all.py

# 仅编译
python3 build/build.py

# 仅样式和类型检查
python3 build/check.py

# 运行测试
python3 build/test.py

# 构建文档
python3 build/docs.py

# 重新生成依赖文件
python3 build/gendeps.py
```

### Docker Build

```bash
# 使用 Docker 构建
docker build -t shaka-player-build build/docker
docker run -v $(pwd):/usr/src --user $(id -u):$(id -g) shaka-player-build
```

## Build Output

### Output Files (dist/)

| File | Description |
|------|-------------|
| `shaka-player.{variant}.js` | Minified production bundle |
| `shaka-player.{variant}.debug.js` | Unminified bundle with source maps |
| `shaka-player.{variant}.d.ts` | TypeScript declarations |
| `shaka-player.{variant}.externs.js` | Closure externs |
| `shaka-player.{variant}-es2021.js` | ES2021 target variant |
| `controls.css` | UI stylesheet |

### Build Variants

- `compiled` (default, no UI)
- `ui` (with UI)
- `dash`
- `hls`
- `experimental`

## Configurable Builds

The build system supports `+`/`-` syntax for including/excluding features:

### Include Features

```bash
# 完整构建
python3 build/build.py +@complete

# 完整构建 + UI
python3 build/build.py +@complete +@ui
```

### Exclude Features

```bash
# 完整构建，排除网络插件
python3 build/build.py +@complete -@networking

# 完整构建，排除 UI
python3 build/build.py +@complete -@ui

# 完整构建，排除文本解析器
python3 build/build.py +@complete -@text

# 完整构建，排除 polyfills
python3 build/build.py +@complete -@polyfill
```

### Exclude Specific Files

```bash
# 排除特定源文件
python3 build/build.py +@complete -lib/text/mp4_ttml_parser.js
python3 build/build.py +@complete -lib/text/mp4_vtt_parser.js
```

## Build Config Files

Build configs are defined in `build/types/`:

### Example: @complete

```bash
# build/types/complete
# Complete library with all features
+@core
+@ui
+@dash
+@hls
+@text
+@networking
+@polyfill
+@offline
+@cast
```

### Example: @networking

```bash
# build/types/networking
# All standard networking scheme plugins
+../../lib/net/http_xhr_plugin.js
+../../lib/net/http_fetch_plugin.js
+../../lib/net/http_plugin_utils.js
+../../lib/net/data_uri_plugin.js
```

### View Available Configs

```bash
# 查看所有构建配置
ls build/types/
```

## Custom Build Configs

### Create Custom Config

```bash
# 创建自定义构建配置文件
# build/types/my_custom_build

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

### Use Custom Config

```bash
# 使用自定义配置构建
python3 build/build.py +@my_custom_build
```

## Adding Custom Plugins

### Add Single File

```bash
# 添加单个源文件
python3 build/build.py +@complete +my_plugin.js
```

### Add Multiple Files

```bash
# 添加多个源文件
python3 build/build.py +@complete +my_plugin.js +/path/to/other_plugin.js
```

### Plugin Registration Pattern

```javascript
// my_plugin.js

goog.provide('my.CustomPlugin');

/**
 * 自定义插件实现
 */
my.CustomPlugin = class {
  // 实现代码...
};

// 在文件末尾注册插件
shaka.media.ManifestParser.registerParserByExtension(
  'myformat',
  my.CustomPlugin
);
```

## Bundle Size Analysis

### Function Sizes

```bash
# 分析函数大小
python3 build/stats.py -s
```

### Class Dependencies

```bash
# 分析类依赖
python3 build/stats.py -c
```

## Testing

### Run Tests

```bash
# 运行所有测试
python3 build/test.py

# 快速测试（仅单元测试）
python3 build/test.py --quick

# 过滤测试
python3 build/test.py --filter="ManifestParser"

# 指定浏览器
python3 build/test.py --browsers Chrome,Firefox

# 测试未编译代码
python3 build/test.py --uncompiled
```

### Test Configuration

- **Framework**: Jasmine
- **Runner**: Karma
- **Config**: `karma.conf.js`
- **Location**: `test/`

## Output Wrapper

The compiled bundle is wrapped in an IIFE for compatibility:

```javascript
(function(global, factory) {
  // CommonJS
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    factory(exports);
  }
  // AMD
  else if (typeof define === 'function' && define.amd) {
    define(['exports'], factory);
  }
  // Browser global
  else {
    factory(global.shaka = {});
  }
}(this, function(exports) {
  // Shaka Player code...
}));
```

This wrapper must be preserved in any new build system.

## Closure Compiler Integration

### Module System

```javascript
// 声明命名空间/类
goog.provide('shaka.Foo');

// 声明依赖
goog.require('shaka.Bar');

// 类型通过 JSDoc 注解
/**
 * @param {string} name
 * @return {number}
 */
function calculate(name) {
  // ...
}
```

### Externs

- `externs/*.js`: Browser/platform API externs
- `externs/shaka/*.js`: Shaka's public interface types
- `ui/externs/*.js`: UI layer interface types

## Common Build Scenarios

### Scenario 1: Minimal Player (No UI)

```bash
# 最小播放器（无 UI）
python3 build/build.py +@core -@ui -@text -@offline
```

### Scenario 2: DASH-Only Player

```bash
# 仅 DASH 播放器
python3 build/build.py +@core +@dash -@hls -@text -@offline
```

### Scenario 3: HLS-Only Player

```bash
# 仅 HLS 播放器
python3 build/build.py +@core +@hls -@dash -@text -@offline
```

### Scenario 4: Player with UI but No Offline

```bash
# 带 UI 但无离线功能
python3 build/build.py +@complete -@offline
```

### Scenario 5: Player with Custom Plugins

```bash
# 带自定义插件的播放器
python3 build/build.py +@complete +my_manifest_parser.js +my_text_parser.js
```

## Build Optimization Tips

1. **Exclude unused features**: Remove text, offline, cast if not needed
2. **Use specific formats**: Build DASH-only or HLS-only if applicable
3. **Custom ABR**: Replace default ABR with custom implementation
4. **Custom networking**: Replace default networking plugins
5. **Analyze bundle**: Use `stats.py` to identify large modules

## Debugging Builds

### Use Debug Library

```html
<!-- 使用调试版本 -->
<script src="dist/shaka-player.compiled.debug.js"></script>
```

### Use Uncompiled Library

```html
<!-- 使用未编译库进行快速开发 -->
<script src="node_modules/google-closure-library/closure/goog/base.js"></script>
<script src="dist/deps.js"></script>
<script src="shaka-player.uncompiled.js"></script>
```

## Best Practices

1. **Start with @complete**: Then exclude what you don't need
2. **Test thoroughly**: Ensure excluded features aren't required
3. **Analyze size**: Use stats tools to optimize
4. **Document custom builds**: Keep track of your build configuration
5. **Use version control**: Commit your custom build configs

## Common Issues

### 1. Build Fails

- Check Java version (need v21+)
- Check Python version (need v3.5+)
- Check Node.js version (need v18+)
- Verify all dependencies installed

### 2. Missing Features

- Check if excluded feature is required
- Verify custom plugins are properly registered
- Check build config for correct includes/excludes

### 3. Large Bundle Size

- Analyze with `stats.py`
- Exclude unused features
- Consider DASH-only or HLS-only builds

## Related Skills

- `shaka-player-plugin-development`: Creating custom plugins
- `shaka-player-basic-usage`: Basic player setup
- `shaka-player-debugging`: Using debug builds
