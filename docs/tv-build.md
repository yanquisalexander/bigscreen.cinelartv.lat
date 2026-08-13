# TV Build

## Targets

| Campo | android-arm | linux-x64x11 |
|---|---|---|
| OS | Android | Linux |
| CPU | ARM (armv7) | x86_64 |
| Graphics | EGL + GLES 2.0 | EGL + GLES 2.0 |
| Starboard API | v16 | v16 |
| Uso | Android TV (producción) | CI / testing |

**Target principal**: `android-arm`

## Build types

| Tipo | Optimización | Uso |
|---|---|---|
| `debug` | O0, assertions | Desarrollo |
| `devel` | O1 | Testing rápido |
| `qa` | O2 | QA, NPLB |
| `gold` | O2/O3 | Producción |

## Build local

### Prerequisitos

```bash
# Linux
sudo apt-get install git curl python3 python3-dev xz-utils lsb-release file ccache pkg-config
sudo apt-get install libx11-dev libxcursor-dev libxrandr-dev libxinerama-dev
sudo apt-get install libxi-dev libgl-dev libegl-dev libgles2-mesa-dev

# Android (para android-arm)
# Descargar NDK: https://developer.android.com/ndk/downloads
export ANDROID_NDK_HOME=/path/to/ndk
```

### Paso 1: depot_tools

```bash
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
export PATH="$(pwd)/depot_tools:$PATH"
```

### Paso 2-4: gclient sync

```bash
mkdir cobalt-build && cd cobalt-build
cat > .gclient << EOF
solutions = [{
  "url": "https://github.com/youtube/cobalt.git@27.lts.1",
  "managed": False,
  "name": "src/cobalt",
}]
EOF
gclient sync --no-history --shallow
```

### Paso 5: Configurar (Android ARM)

```bash
cd src/cobalt
python3 cobalt/build/gn.py \
  -p android-arm \
  -c gold \
  --no-rbe \
  --args='target_os="android" target_cpu="arm" android_ndk_root="$ANDROID_NDK_HOME"'
```

### Paso 6: Compilar

```bash
autoninja -C out/android-arm_gold cobalt
autoninja -C out/android-arm_gold loader_app
```

### Paso 7: Instalar en Android TV

```bash
adb push out/android-arm_gold/ /sdcard/cobalt/
adb shell chmod +x /sdcard/cobalt/loader_app
adb shell /sdcard/cobalt/loader_app --url=https://bigscreen.cinelartv.lat
```

## Estructura del artifact

```
build/tv/android-arm/
├── cobalt              # Binario principal
├── loader_app          # Bootstrap de Evergreen
├── libcobalt.so        # Engine actualizable
├── *.so                # Shared libraries
├── manifest.json       # Versiones
└── start.sh            # Script de instalación
```

## Evergreen

El artifact incluye `loader_app` + `libcobalt.so`. El loader es el punto de entrada permanente; `libcobalt.so` se actualiza OTA sin firmware updates.

## Actualizar Cobalt

1. Editar `cobalt-versions.json` → `cobalt.ref`
2. Push → el workflow usa la nueva versión
3. **Nunca** usar `main` o `latest`
