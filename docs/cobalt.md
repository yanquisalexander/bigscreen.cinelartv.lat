# Cobalt

Cobalt es un contenedor HTML5 ligero basado en Chromium/Blink, diseñado para dispositivos de sala de estar (Smart TVs, STB, consolas). Implementa un subconjunto de W3C HTML5 optimizado para SPAs a pantalla completa.

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

- **Cobalt core**: Motor web (Chromium/Blink/V8) como biblioteca compartida (`libcobalt.so`)
- **Starboard**: Capa de porting que abstrae el OS/hardware
- **Contenido**: Cobalt carga contenido vía URL. Nuestra app ya está deployada en `https://bigscreen.cinelartv.lat`

## Capacidades web soportadas

- DOM, CSS Flexbox, Animaciones
- JavaScript (V8, ES2015+)
- `fetch()`, `XMLHttpRequest`
- `localStorage`, `sessionStorage`
- `MediaSource Extensions` (MSE) para streaming adaptativo
- `Encrypted Media Extensions` (EME) para DRM (Widevine, PlayReady)
- Canvas 2D, WebGL (via GLES2)
- Web Audio API
- Custom Elements v1

## Lo que NO soporta

- No es un browser general (sin pestañas, extensions, address bar)
- No WebAssembly (deshabilitado por defecto)
- No WebRTC
- No Pointer Lock
- No Service Workers
- No multi-process (single-process)

## Nuestra integración

Cobalt carga directamente `https://bigscreen.cinelartv.lat`. No compilamos la app dentro del pipeline de Cobalt — la app se sirve desde su URL de producción.

```bash
cobalt --url=https://bigscreen.cinelartv.lat
```

## Plataformas oficiales

| Plataforma | Familia | Variante | Uso |
|---|---|---|---|
| `linux-x64x11` | linux | x64x11 | Desktop Linux (Ubuntu x64 + X11) |
| `android-arm` | android | arm | Android TV |
| `raspi-2` | raspi | 2 | Raspberry Pi |

## Links

- Repo: https://github.com/youtube/cobalt
- Docs: https://developers.google.com/youtube/cobalt
- App: https://bigscreen.cinelartv.lat
