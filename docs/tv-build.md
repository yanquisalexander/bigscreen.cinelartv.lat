# TV Build

## Target

| Campo | Valor |
|---|---|
| Plataforma | `linux-x64x11` |
| OS | Linux (Ubuntu 22.04+) |
| CPU | x86_64 |
| Graphics | EGL + OpenGL ES 2.0 |
| Windowing | X11 |
| Starboard API | v16 |
| App URL | `https://bigscreen.cinelartv.lat` |

## Build types

| Tipo | Optimización | Uso |
|---|---|---|
| `debug` | O0, assertions | Desarrollo local |
| `devel` | O1 | Testing rápido |
| `qa` | O2 | QA, NPLB tests |
| `gold` | O2/O3 | Producción |

## Build local

### Prerequisitos

```bash
sudo apt-get install git curl python3 python3-dev xz-utils lsb-release file ccache pkg-config
sudo apt-get install libx11-dev libxcursor-dev libxrandr-dev libxinerama-dev
sudo apt-get install libxi-dev libgl-dev libegl-dev libgles2-mesa-dev
```

### Paso 1: depot_tools

```bash
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH="$(pwd)/depot_tools:$PATH"
```

### Paso 2: Directorio de trabajo

```bash
mkdir cobalt-build && cd cobalt-build
```

### Paso 3: gclient config

```bash
cat > .gclient << EOF
solutions = [{
  "url": "https://github.com/youtube/cobalt.git@27.lts.1",
  "managed": False,
  "name": "src/cobalt",
}]
EOF
```

### Paso 4: Sync dependencias

```bash
gclient sync --no-history --shallow
```

### Paso 5: Configurar build

```bash
cd src/cobalt
python3 cobalt/build/gn.py -p linux-x64x11 -c gold --no-rbe
```

### Paso 6: Compilar

```bash
autoninja -C out/linux-x64x11_gold cobalt
```

### Paso 7: Ejecutar

```bash
out/linux-x64x11_gold/cobalt --url=https://bigscreen.cinelartv.lat
```

## Estructura del artifact

```
build/tv/
├── cobalt/           # Binario de Cobalt + libs
│   ├── cobalt
│   └── *.so
├── manifest.json     # Versiones y metadata
└── start.sh          # Script: ejecuta Cobalt con la URL de la app
```

El artifact contiene SOLO el binario de Cobalt. La app se carga desde `https://bigscreen.cinelartv.lat`.

## Actualizar Cobalt

1. Editar `cobalt-versions.json` → cambiar `cobalt.ref`
2. Hacer push
3. Verificar que el build pasa

**Nunca** usar `main` o `latest` de Cobalt para producción.
