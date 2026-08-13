# GitHub Actions

## Workflows

### `build-tv.yml` — Build + Test

- `push` a `main`
- `pull request` a `main`
- `workflow_dispatch` (manual,可以选择 platform)

### `release-tv.yml` — Build + Release

- Tag `tv-v*`
- `workflow_dispatch` con versión

## Variables

| Variable | Default | Descripción |
|---|---|---|
| `APP_URL` | `https://bigscreen.cinelartv.lat` | URL que Cobalt carga |
| `COBALT_VERSION` | `27.lts.1` | Versión de Cobalt |

## Platforms

El workflow acepta `platform` como input:

- **`android-arm`** (default) — Android TV, necesita NDK cross-compilation
- **`linux-x64x11`** — Desktop Linux, para testing rápido

## Pipeline

```
git push
  → checkout
  → setup Android NDK (si android-arm)
  → depot_tools
  → gclient sync
  → gn.py -p <platform> -c gold
  → autoninja cobalt
  → autoninja loader_app (Evergreen)
  → NPLB tests
  → curl verify app reachable
  → package artifact
  → upload
```

## Caching

| Componente | Cacheado |
|---|---|
| depot_tools | Sí |
| ccache | Sí |
| Build output | No (reproducible) |

## Artifact

- `cobalt/` — Binario Cobalt
- `loader_app` — Bootstrap Evergreen
- `libcobalt.so` — Engine actualizable
- `manifest.json` — Versiones
- `start.sh` — Script de instalación

## Instalar en Android TV

```bash
# Descargar artifact de GitHub Actions
# Extraer
tar -xzf tv-app-android-arm-*.tar.gz

# Push al TV
adb push tv/android-arm/ /sdcard/cobalt/
adb shell chmod +x /sdcard/cobalt/loader_app
adb shell /sdcard/cobalt/loader_app --url=https://bigscreen.cinelartv.lat
```

## Crear release

```bash
git tag tv-v1.0.0
git push origin tv-v1.0.0

# O manual:
# Actions → Release TV App → versión: 1.0.0
```

## Release info

| Campo | Fuente |
|---|---|
| `app_version` | Tag o input |
| `cobalt_version` | `cobalt-versions.json` |
| `platform` | Input (default: android-arm) |
| `build_type` | Input (default: gold) |
| `evergreen` | `true` |
| `app_url` | `https://bigscreen.cinelartv.lat` |
