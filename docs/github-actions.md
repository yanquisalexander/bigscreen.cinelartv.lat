# GitHub Actions

## Workflows

### `build-tv.yml` — Build + Test

Se ejecuta en:
- `push` a `main`
- `pull request` a `main`
- `workflow_dispatch` (manual)

Produce: artifact con binario de Cobalt (retención 30 días).

### `release-tv.yml` — Build + Release

Se ejecuta en:
- Tag `tv-v*` (ej: `tv-v1.0.0`)
- `workflow_dispatch` con versión manual

Produce: GitHub Release con artifact versionado (retención 90 días).

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `COBALT_PLATFORM` | `linux-x64x11` | Target platform |
| `COBALT_BUILD_TYPE` | `gold` | Build type (debug/devel/qa/gold) |
| `APP_URL` | `https://bigscreen.cinelartv.lat` | URL de la app que Cobalt carga |

## Qué se buildea

El pipeline **solo compila Cobalt**. La app no se compila — se carga desde su URL de producción.

```
GitHub Actions
   → compila Cobalt (GN + Ninja)
   → ejecuta NPLB tests
   → verifica que la app responde (curl HTTP)
   → empaqueta binario de Cobalt
   → sube artifact
```

## Caching

| Componente | Cacheado | Razón |
|---|---|---|
| `depot_tools` | Sí | Evita re-clonar |
| `ccache` | Sí | Acelera builds C++ |
| Build output Cobalt | No | Builds reproducibles |

## Artifact

El artifact contiene:
- `cobalt/` — Binario de Cobalt + shared libraries
- `manifest.json` — Versiones y metadata
- `start.sh` — Ejecuta `cobalt --url=https://bigscreen.cinelartv.lat`

## Obtener el artifact

1. Ir a "Actions" del repo
2. Seleccionar el workflow
3. Click en el run
4. Scroll a "Artifacts"
5. Descargar

## Ejecutar en el dispositivo TV

```bash
# Extraer artifact
tar -xzf tv-app-linux-x64x11-*.tar.gz

# Ejecutar
cd tv/
./start.sh
# Equivalente a: ./cobalt/cobalt --url=https://bigscreen.cinelartv.lat
```

## Crear un release

```bash
# Tag
git tag tv-v1.0.0
git push origin tv-v1.0.0

# O manual
# Actions → Release TV App → Run workflow → versión: 1.0.0
```

## Release info

| Campo | Fuente |
|---|---|
| `app_version` | Tag o input manual |
| `cobalt_version` | `cobalt-versions.json` |
| `platform` | `cobalt-versions.json` |
| `build_type` | Input o default `gold` |
| `app_url` | `https://bigscreen.cinelartv.lat` |
