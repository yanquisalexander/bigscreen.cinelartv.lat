#!/usr/bin/env bash
set -euo pipefail
export DEPOT_TOOLS_UPDATE=0 DEPOT_TOOLS_METRICS=0 DEPOT_TOOLS_COLLECT_METRICS=0
export DEPOT_TOOLS_REPORT_BUILD=0
export CI=1
REPORT="$GITHUB_WORKSPACE/measurement"
WORK="$GITHUB_WORKSPACE/cobalt-work"
mkdir -p "$REPORT" "$WORK"
echo bootstrap > "$REPORT/stage"
snapshot() {
  local stage="$1"
  echo "$stage" > "$REPORT/stage"
  python3 - "$stage" "$WORK" "$REPORT" <<'PY'
import json, os, shutil, subprocess, sys, time
stage, work, report = sys.argv[1:]
usage = shutil.disk_usage(work)
sizes = {}
for name, path in {'workspace': work, 'source_git': work+'/src/.git', 'output': work+'/src/out', 'depot_tools': work+'/depot_tools'}.items():
    if os.path.exists(path):
        sizes[name] = int(subprocess.check_output(['du','-s','-B1',path], text=True).split()[0])
record = dict(stage=stage, timestamp=time.time(), total_bytes=usage.total, used_bytes=usage.used, free_bytes=usage.free, allocated_bytes=sizes)
with open(report+'/snapshots.jsonl','a') as f: f.write(json.dumps(record)+'\n')
print(json.dumps(record), flush=True)
PY
}
finish() {
  local result=$?
  trap - EXIT
  echo "$result" > "$REPORT/exit-code"
  snapshot "final-$(cat "$REPORT/stage")" || true
  if [[ -n "${MONITOR_PID:-}" ]]; then kill "$MONITOR_PID" 2>/dev/null || true; fi
  exit "$result"
}
trap finish EXIT
start_monitor() {
python3 -u - "$WORK" "$REPORT" <<'PY' &
import json, shutil, sys, time
work, report=sys.argv[1:]
while True:
    d=shutil.disk_usage(work)
    with open(report+'/disk-samples.jsonl','a') as f:
        f.write(json.dumps(dict(timestamp=time.time(), total_bytes=d.total, used_bytes=d.used, free_bytes=d.free))+'\n')
    time.sleep(10)
PY
MONITOR_PID=$!
}
compile() {
  cd "$WORK/src"
  echo compile-gold > "$REPORT/stage"
  snapshot compile-start
  /usr/bin/time -v -o "$REPORT/build-time.txt" timeout --signal=INT --kill-after=60s 4h autoninja -C out/android-arm64_gold -j 4 cobalt/android:cobalt_apk 2>&1 | tee "$REPORT/build.log"
  snapshot build-complete
  find out/android-arm64_gold/apks -maxdepth 1 -name '*.apk' -printf '%f %s bytes\n' > "$REPORT/apk-sizes.txt"
}
if [[ "${1:-all}" == compile ]]; then
  export PATH="$WORK/depot_tools:$PATH"
  start_monitor
  compile
  exit 0
fi
snapshot runner-before-cleanup
# Only disposable, preinstalled SDKs on this ephemeral Linux VM; no user files.
sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc /usr/local/share/boost /opt/hostedtoolcache/CodeQL
sudo docker image prune -af || true
snapshot runner-after-cleanup
start_monitor
git clone --depth=1 https://chromium.googlesource.com/chromium/tools/depot_tools.git "$WORK/depot_tools"
export PATH="$WORK/depot_tools:$PATH"
git -C "$WORK/depot_tools" rev-parse HEAD > "$REPORT/depot-tools-sha"
echo source-fetch > "$REPORT/stage"
git init "$WORK/src"
git -C "$WORK/src" remote add origin https://github.com/youtube/cobalt.git
git -C "$WORK/src" fetch --depth=1 origin 28c0cce964f326ae24fd4e4d74dc95f50a853762
git -C "$WORK/src" checkout --detach FETCH_HEAD
git -C "$WORK/src" rev-parse HEAD > "$REPORT/cobalt-sha"
snapshot source-only
cd "$WORK"
cat > .gclient <<'EOF'
solutions = [{
  'name': 'src',
  'url': 'https://github.com/youtube/cobalt.git',
  'managed': False,
  'custom_deps': {},
  'custom_vars': {
    'checkout_cobalt_internal': False,
    'checkout_src_internal': False,
    'checkout_pgo_profiles': False,
    'checkout_instrumented_libraries': False,
  },
}]
target_os = ['android']
# GN also evaluates host toolchains: keep Linux host dependencies enabled.
target_os_only = False
EOF
cp .gclient "$REPORT/gclient.txt"
echo dependencies-sync > "$REPORT/stage"
gclient sync --no-history --shallow --nohooks --jobs=4 --revision src@28c0cce964f326ae24fd4e4d74dc95f50a853762 2>&1 | tee "$REPORT/sync.log"
"$WORK/src/third_party/depot_tools/ensure_bootstrap"
snapshot source-and-dependencies
cd "$WORK/src"
echo system-build-dependencies > "$REPORT/stage"
sudo build/install-build-deps.sh --android --no-prompt 2>&1 | tee "$REPORT/system-deps.log"
snapshot system-dependencies-installed
echo hooks > "$REPORT/stage"
gclient runhooks 2>&1 | tee "$REPORT/hooks.log"
snapshot hooks-complete
"$WORK/depot_tools/ensure_bootstrap"
"$WORK/src/third_party/depot_tools/ensure_bootstrap"
python3 build/linux/sysroot_scripts/install-sysroot.py --arch=amd64 2>&1 | tee "$REPORT/host-sysroot.log"
python3 build/linux/sysroot_scripts/install-sysroot.py --arch=i386 2>&1 | tee "$REPORT/host-sysroot-i386.log"
echo gn-gold > "$REPORT/stage"
python3 cobalt/build/gn.py -p android-arm64 -c gold --no-rbe 2>&1 | tee "$REPORT/gn.log"
cp out/android-arm64_gold/args.gn "$REPORT/args.gn"
snapshot gn-complete
if [[ "${1:-all}" != prepare ]]; then
  compile
fi
