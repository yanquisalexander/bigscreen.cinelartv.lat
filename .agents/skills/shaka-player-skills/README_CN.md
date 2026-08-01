# Shaka Player 技能库

一个全面的 Shaka Player 开发技能库，为 DASH、HLS 和 MSF 格式的自适应媒体流提供专业指导。

## 概述

本技能库为使用 [Shaka Player](https://github.com/shaka-project/shaka-player) 开发提供结构化指导。Shaka Player 是由 Google 维护的开源 JavaScript 自适应媒体播放库，支持 DASH、HLS 和 MSF 格式。本库涵盖从基础设置到高级定制的所有内容。

## 功能特性

- **基础用法**：设置和初始化指导
- **配置管理**：流媒体、缓冲、ABR 和语言设置
- **DRM 支持**：Widevine、PlayReady 和 FairPlay 配置
- **错误处理**：全面的错误管理和恢复策略
- **离线存储**：下载内容并离线播放
- **插件开发**：创建自定义扩展
- **UI 定制**：控件、本地化和无障碍支持
- **构建定制**：优化打包体积
- **字幕开发**：字幕加载、样式定制和多语言支持
- **音频开发**：音频轨道管理和多语言切换
- **视频源开发**：码率控制、分辨率切换和 ABR 逻辑

## 安装

```bash
npx skills add https://github.com/jiaiyan/shaka-player-skills --skill shaka-player-skills
```


## 可用技能

### 1. 基础用法 (`shaka-player-basic-usage`)

帮助设置和初始化 Shaka Player 进行自适应媒体流播放。

**涵盖主题**：
- 带视频元素的 HTML 结构
- JavaScript 初始化
- 错误处理设置
- 浏览器支持检查
- Polyfill 配置

### 2. 配置管理 (`shaka-player-configuration`)

配置播放器设置以获得最佳播放体验。

**涵盖主题**：
- 流媒体配置
- 缓冲设置
- ABR（自适应码率）配置
- 语言偏好
- 低延迟流媒体

### 3. DRM 设置 (`shaka-player-drm-setup`)

配置数字版权管理以播放受保护内容。

**涵盖主题**：
- 许可证服务器配置
- Widevine、PlayReady、FairPlay 设置
- Clear Key 测试配置
- 安全级别设置
- 持久许可证支持

### 4. 错误处理 (`shaka-player-error-handling`)

实现全面的错误处理策略。

**涵盖主题**：
- 错误结构和代码
- 严重程度级别
- 重试机制
- 错误恢复策略
- 调试技术

### 5. 离线存储 (`shaka-player-offline-storage`)

实现离线下载和播放功能。

**涵盖主题**：
- 内容下载
- 进度跟踪
- 存储管理
- 离线 DRM 支持
- IndexedDB 配置

### 6. 插件开发 (`shaka-player-plugin-development`)

开发自定义插件以扩展功能。

**涵盖主题**：
- 清单解析器插件
- 文本解析器插件
- 网络插件
- ABR 管理器插件
- Polyfill 插件

### 7. UI 定制 (`shaka-player-ui-customization`)

定制播放器用户界面。

**涵盖主题**：
- UI 库设置
- 控件定制
- Chromecast 集成
- VR 播放
- 本地化和无障碍

### 8. 构建定制 (`shaka-player-build-customization`)

优化打包体积并创建自定义配置。

**涵盖主题**：
- 构建系统概述
- 功能包含/排除
- 自定义构建配置
- 打包体积分析
- 插件集成

### 9. 字幕开发 (`shaka-player-subtitle-development`)

字幕集成、样式定制和多语言支持的全面指南。

**涵盖主题**：
- 外部字幕加载（WebVTT、TTML）
- 字幕样式和定制
- 多语言字幕切换
- 字幕事件和错误处理
- 字幕定位和显示控制

### 10. 音频开发 (`shaka-player-audio-development`)

音频轨道管理、多语言切换和 ABR 控制的全面指南。

**涵盖主题**：
- 多语言音频轨道切换
- 音频质量和带宽控制
- 音频语言偏好
- 音频事件和状态管理
- 多声道音频配置（立体声、5.1、7.1）

### 11. 视频源开发 (`shaka-player-video-source-development`)

视频源开发的全面指南，包括码率控制、分辨率切换和 ABR 逻辑。

**涵盖主题**：
- 码率控制机制（手动和自动）
- 分辨率切换功能
- ABR 算法配置和定制
- 多源切换（HLS、DASH）
- 质量选择 UI 实现

## 快速开始

### 基础播放器设置

```javascript
// 安装 polyfills
shaka.polyfill.installAll();

// 检查浏览器支持
if (shaka.Player.isBrowserSupported()) {
  const video = document.getElementById('video');
  const player = new shaka.Player();
  await player.attach(video);
  
  // 监听错误
  player.addEventListener('error', (event) => {
    console.error('错误:', event.detail);
  });
  
  // 加载内容
  await player.load('https://example.com/manifest.mpd');
}
```

### 带配置的设置

```javascript
player.configure({
  streaming: {
    bufferingGoal: 120,      // 2分钟缓冲
    rebufferingGoal: 30      // 30秒重新缓冲目标
  },
  abr: {
    enabled: true,
    defaultBandwidthEstimate: 500000
  },
  preferredAudioLanguage: 'zh-CN'
});
```

### 带 DRM 的设置

```javascript
player.configure({
  drm: {
    servers: {
      'com.widevine.alpha': 'https://license.example.com/widevine',
      'com.microsoft.playready': 'https://license.example.com/playready'
    }
  }
});
```

## API 参考

### 播放器方法

| 方法 | 描述 |
|------|------|
| `attach(video)` | 将播放器附加到视频元素 |
| `load(uri)` | 加载清单并开始播放 |
| `configure(config)` | 设置播放器配置 |
| `getConfiguration()` | 获取当前配置 |
| `getVariantTracks()` | 获取可用的视频/音频轨道 |
| `selectVariantTrack(track)` | 选择特定轨道 |

### 配置部分

| 部分 | 描述 |
|------|------|
| `streaming` | 缓冲和流媒体设置 |
| `abr` | 自适应码率设置 |
| `drm` | DRM 配置 |
| `manifest` | 清单解析设置 |
| `preferredAudioLanguage` | 首选音频语言 |
| `preferredTextLanguage` | 首选字幕语言 |

## 项目结构

```
shaka-player-skills/
├── SKILL.md                          # 根技能文件
├── README.md                         # 英文文档
├── README_CN.md                      # 本文件
├── AGENTS.md                         # Agent 文档
├── shaka-player-basic-usage/
│   └── SKILL.md
├── shaka-player-build-customization/
│   └── SKILL.md
├── shaka-player-configuration/
│   └── SKILL.md
├── shaka-player-drm-setup/
│   └── SKILL.md
├── shaka-player-error-handling/
│   └── SKILL.md
├── shaka-player-offline-storage/
│   └── SKILL.md
├── shaka-player-plugin-development/
│   └── SKILL.md
└── shaka-player-ui-customization/
    └── SKILL.md
```

## 贡献指南

添加新技能或更新现有技能时：

1. 遵循现有的 SKILL.md 格式
2. 包含带有 `name` 和 `description` 的前置元数据
3. 提供清晰的"何时使用"指导
4. 包含实用的代码示例
5. 引用相关技能

## 相关资源

- [Shaka Player 文档](https://shaka-player-demo.appspot.com/docs/api/index.html)
- [Shaka Player GitHub](https://github.com/shaka-project/shaka-player)
- [Shaka Player 演示](https://shaka-player-demo.appspot.com/)
- [API 参考](https://shaka-player-demo.appspot.com/docs/api/shaka.html)

## 许可证

本技能库采用 MIT 许可证发布。详情请参阅 [LICENSE](https://opensource.org/licenses/MIT) 文件。
