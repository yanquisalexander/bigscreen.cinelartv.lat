# Cobalt

Cobalt es un contenedor HTML5 ligero basado en Chromium/Blink para Smart TVs.

## Cómo funciona

```
Cobalt APK (cobalt_loader)
      ↓
   Starboard (abstracción de plataforma)
      ↓
   Android TV (AOSP)
      ↓
   Carga URL → https://bigscreen.cinelartv.lat
```

## Plataformas

| Plataforma | CPU | Uso |
|---|---|---|
| `aosp-arm` | ARM 32-bit | **Android TV** (principal) |
| `aosp-arm64` | ARM 64-bit | Android TV (64-bit) |
| `aosp-x86` | x86 | Emulador / testing |

## Output

El build produce un APK: `out/<platform>_<type>/apks/cobalt.apk`

## Instalación

```bash
adb install -r out/aosp-arm_gold/apks/cobalt.apk
adb shell am start --esa commandLineArgs "url=https://bigscreen.cinelartv.lat" dev.cobalt.coat/dev.cobalt.app.MainActivity
```

## Links

- Repo: https://github.com/youtube/cobalt
- Docs: https://developers.google.com/youtube/cobalt
- App: https://bigscreen.cinelartv.lat
