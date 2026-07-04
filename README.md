# 🎬 CinelarTV for Bigscreen

**The ultimate streaming experience for your TV.** 🍿

A web-based streaming client designed for **Android TV**, **Samsung Tizen**, **LG WebOS**, and other big-screen devices. CinelarTV Bigscreen delivers a Netflix-style, remote-control-friendly interface — navigated entirely with your **D-pad**. 🎮

> 🌐 **Always use the live version at [bigscreen.cinelartv.lat](https://bigscreen.cinelartv.lat)** — we continuously push improvements and fixes to the hosted site. Building locally is only recommended for development and contribution purposes.

---

## ✨ Features

- 📺 **D-pad Navigation** — Full spatial navigation, no mouse or touch required
- 🎞️ **Hero Carousel** — Auto-advancing hero with trailer video playback
- 👀 **Continue Watching** — Syncs progress to the Android TV home screen
- 📡 **Live TV** — Delegates playback to the native player via NativeBridge
- 👥 **Multi-Profile** — Netflix-style profile selection and switching
- 🔐 **Device Code Auth** — Scan a QR code or enter a code to link your account
- 🔍 **Search** — On-screen keyboard with D-pad-friendly search
- ⚡ **Performance Optimized** — RAF-based seekbar, memoized components, lazy loading for buttery-smooth playback on low-end TV hardware
- 🌙 **Dark UI** — Designed for the big screen, from the couch

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| ⚛️ React 19 | UI framework |
| 🟦 TypeScript | Type safety |
| ⚡ Vite | Build tool & dev server |
| 🎨 Tailwind CSS v4 | Utility-first styling |
| 🗃️ Zustand | Lightweight state management |
| 🎯 norigin-spatial-navigation | D-pad spatial navigation |
| 🔗 React Router v7 | Client-side routing |
| 🔤 Lucide + FluentUI Icons | Icon libraries |
| 🧩 core-js + polyfills | Compatibility with older WebViews |

---

## 🌉 What is the NativeBridge?

The **NativeBridge** is a JavaScript-to-native communication layer that allows the web app (running inside a WebView) to call methods on the native host application — and vice versa.

### How it works

1. The native app (e.g. Android TV) **injects** a `window.CinelarNative` object into the WebView before the React app loads
2. The web app **calls methods** on this object to interact with the device (e.g. play a stream, sync data to the home screen, exit the app)
3. If no native host is present (e.g. running in a regular browser), every method **gracefully falls back** to a safe default — so the app works everywhere 🌐

### Interface at a glance

```typescript
interface CinelarNative {
  // Device info
  getPlatform?: () => string;        // e.g. 'android-tv', 'web'
  getAppVersion?: () => string;
  getDeviceModel?: () => string;

  // Navigation
  exitApp?: () => void;
  openUrl?: (url: string) => void;

  // Android TV home screen integration
  syncContinueWatching?: (itemsJson: string) => boolean;
  addContinueWatching?: (itemJson: string) => boolean;
  syncRecommendations?: (itemsJson: string) => boolean;

  // Live TV (delegates to native player)
  supportsLiveTV?: () => boolean;
  playLiveChannel?: (channelJson: string) => boolean;

  // Auth notifications
  onProfileChanged?: () => boolean;
  onLogout?: () => boolean;
}
```

### Why it matters

The NativeBridge is **the key to porting CinelarTV to any platform**. It keeps the web app platform-agnostic while giving native hosts the hooks they need to integrate deeply with the device.

---

## 🌍 Community Porting Guide

CinelarTV Bigscreen is **platform-agnostic by design**. Thanks to the NativeBridge abstraction, anyone can port this app to a new platform by implementing a simple JavaScript object on the native side.

### What you need to implement

To run CinelarTV on your platform, you need to create a native app (or WebView wrapper) that:

1. **Opens a WebView** pointing to `https://bigscreen.cinelartv.lat`
2. **Injects** a `window.CinelarNative` object with the methods listed above

### Example: Minimal Tizen implementation (TVWebApp)

```javascript
// In your Tizen WebView page that hosts the app
window.CinelarNative = {
  getPlatform: () => 'tizen',
  getAppVersion: () => '1.0.0',
  exitApp: () => tizen.application.getCurrentApplication().exit(),
  supportsLiveTV: () => false,
  openUrl: (url) => new tizen.ApplicationControl(
    'http://tizen.org/appcontrol/operation/view', url
  ),
};
```

### Example: Minimal Fire TV (WebView)

```java
// In your Android/WebView activity for Fire TV
webView.addJavascriptInterface(new Object() {
    @JavascriptInterface
    public String getPlatform() { return "fire-tv"; }

    @JavascriptInterface
    public void exitApp() { finish(); }

    @JavascriptInterface
    public boolean supportsLiveTV() { return false; }

    @JavascriptInterface
    public boolean playLiveChannel(String json) {
        // Open your native player
        return true;
    }
}, "CinelarNative");
```

### Example: Roku (Component Script)

```brightscript
' In your Roku component script
sub injectNativeBridge()
    js = "window.CinelarNative = {"
    js += "getPlatform: function() { return 'roku'; },"
    js += "exitApp: function() { m.top.signalClose(); },"
    js += "supportsLiveTV: function() { return false; },"
    js += "};"
    m.webView.callFunc("executeJavaScript", js)
end sub
```

### Platform checklist

| Platform | What to implement | Priority |
|---|---|---|
| 🤖 **Android TV** | WebView + full NativeBridge (already exists!) | ✅ Done |
| 📺 **Samsung Tizen** | Tizen WebView + `getPlatform`, `exitApp`, `openUrl` | High |
| 🔥 **Amazon Fire TV** | Android WebView + full NativeBridge | High |
| 📺 **LG WebOS** | WebOS WebView + `getPlatform`, `exitApp`, `openUrl` | Medium |
| 🎮 **Roku** | Roku SceneGraph + `getPlatform`, `exitApp` | Medium |
| 🖥️ **Desktop Browser** | Nothing needed — it works out of the box! 🎉 | — |

> 💡 **Tip:** The app runs perfectly in any modern browser for development and testing. Just open `https://bigscreen.cinelartv.lat` in Chrome, Firefox, or Safari.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (recommended) or npm

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-org/bigscreen.cinelartv.lat.git
cd bigscreen.cinelartv.lat

# Install dependencies
pnpm install

# Start dev server
pnpm dev
```

### Build

```bash
# Production build
pnpm build

# Preview production build
pnpm preview
```

> ⚠️ **Remember:** We push updates to [bigscreen.cinelartv.lat](https://bigscreen.cinelartv.lat) regularly. If you're a user, just visit the site — no need to build anything! If you're a developer, feel free to build locally for testing your changes.

---

## 📁 Project Structure

```
src/
├── api/                    # API client & endpoints
├── components/
│   ├── home/               # Hero carousel
│   ├── layout/             # App shell & sidebar
│   ├── tv/                 # D-pad focusable components
│   └── ui/                 # Toasts, incompatibility screen
├── features/
│   ├── auth/               # Device code OAuth flow
│   └── content/            # Content, search, explore APIs
├── hooks/                  # Custom hooks (nav, bridge sync, keys)
├── pages/                  # Route screens (Home, Watch, Search...)
├── router/                 # Route definitions & auth guards
├── services/               # NativeBridge, compat checks, polyfills
├── stores/                 # Zustand state stores
├── types/                  # TypeScript type definitions
└── utils/                  # Helpers
```

---

## 🤝 Contributing

Contributions are welcome! Whether it's fixing a bug, improving performance, or porting to a new platform — we'd love your help.

1. Fork the repo
2. Create your feature branch
3. Test on both browser and device
4. Open a PR

---

## 📄 License

This project is part of the [CinelarTV](https://cinelartv.lat) ecosystem.

---

<p align="center">
  Made with ❤️ for the big screen 📺
</p>
