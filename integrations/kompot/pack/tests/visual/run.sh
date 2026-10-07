#!/usr/bin/env bash
# Визуальные тесты Kompot: движок в оконном режиме (окно откроется на пару
# секунд), скриншоты из export: копируются в tests/visual/out/.
#   ./tests/visual/run.sh primitives
# Движок: $VOXELCORE, иначе сборка из latest.log игры.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
pack="$(cd "$here/../.." && pwd)"
content="$(dirname "$pack")"
game_log="$(dirname "$content")/latest.log"
engine="${VOXELCORE:-}"
if [ -z "$engine" ] && [ -f "$game_log" ]; then
    exe="$(grep -m1 -o 'executable path: .*' "$game_log" | sed 's/executable path: //')"
    root="$(dirname "$(dirname "$(dirname "$exe")")")"
    [ -x "$root/AppRun" ] && engine="$root/AppRun"
fi
user="$(mktemp -d "${TMPDIR:-/tmp}/kompot-visual.XXXXXX")"
mkdir -p "$user/content" "$here/out"
ln -sfn "$pack" "$user/content/kompot"
# зависимые паки для визуальных тестов (демо и т.п.) - из соседних каталогов
for extra in ${KOMPOT_EXTRA_PACKS:-}; do
    ln -sfn "$content/$extra" "$user/content/$extra"
done
timeout 180 "$engine" --dir "$user" --test "$here/${1:?test name}.lua" 2>&1 \
    | grep -v '^\[I\]' | grep -v '^\s*$'
engine_status=${PIPESTATUS[0]}
cp "$user"/export/*.png "$user"/export/*.lua "$here/out/" 2>/dev/null; ls "$here/out"
rm -rf "$user"
exit "$engine_status"
