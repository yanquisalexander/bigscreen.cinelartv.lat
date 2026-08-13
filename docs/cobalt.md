# Cobalt

Cobalt es un contenedor HTML5 ligero basado en Chromium/Blink, diseñado para dispositivos de sala de estar (Smart TVs, STB, consolas).

## Cómo funciona

```
Cobalt (Blink + V8)
      ↓
   Starboard (abstracción de plataforma)
      ↓
   OS / Hardware
      ↓
   Carga URL → https://bigscreen.cinelartv.lat
```

## Evergreen (self-updating)

Evergreen es la arquitectura de auto-actualización de Cobalt:

```
Android TV (firmware permanente)
   └── loader_app (bootstrap, permanente)
          └── libcobalt.so (se actualiza OTA desde Google)
```

- Google puede actualizar Cobalt sin firmware del OEM
-YouTube on TV requiere Evergreen para certificación
- Nosotros lo usamos para tener actualizaciones automáticas

## Capacidades web

- DOM, CSS Flexbox, Animaciones
- JavaScript (V8, ES2015+)
- `fetch()`, `XMLHttpRequest`
- `localStorage`, `sessionStorage`
- MSE (streaming adaptativo)
- EME (DRM: Widevine, PlayReady)
- Canvas 2D, WebGL
- Web Audio API
- Custom Elements v1

## NO soporta

- No es un browser general
- No WebAssembly
- No WebRTC
- No Pointer Lock
- No Service Workers

## Nuestra integración

Cobalt carga `https://bigscreen.cinelartv.lat` directamente. La app no se compila dentro del pipeline.

```bash
cobalt --url=https://bigscreen.cinelartv.lat
```

## Plataformas

| Plataforma | OS | CPU | Uso |
|---|---|---|---|
| `android-arm` | Android | ARM | **Android TV** (target principal) |
| `linux-x64x11` | Linux | x86_64 | CI testing / desktop |

## Links

- Repo: https://github.com/youtube/cobalt
- Docs: https://developers.google.com/youtube/cobalt
- App: https://bigscreen.cinelartv.lat
