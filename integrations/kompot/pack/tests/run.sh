#!/usr/bin/env bash
# Headless-тесты Demo Pack. Движок: $VOXELCORE, иначе сборка из latest.log игры.
# Аргумент - имя теста без .lua (по умолчанию все).
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
pack="$(dirname "$here")"
game_log="$(dirname "$(dirname "$pack")")/latest.log"
user="$here/.user"

engine="${VOXELCORE:-}"
if [ -z "$engine" ] && [ -f "$game_log" ]; then
    exe="$(grep -m1 -o 'executable path: .*' "$game_log" | sed 's/executable path: //')"
    root="$(dirname "$(dirname "$(dirname "$exe")")")"
    [ -x "$root/AppRun" ] && engine="$root/AppRun"
fi
echo "engine: $engine"

mkdir -p "$user/content"
ln -sfn "$pack" "$user/content/kompot"

status=0
for test in "$here"/${1:-*}.lua; do
    echo "== $(basename "$test")"
    output="$(timeout 300 "$engine" --headless --dir "$user" --test "$test" 2>&1)"
    echo "$output" | grep -v '^\[I\]' | grep -v '^\s*$'
    if ! echo "$output" | grep -q "failed: 0" || echo "$output" | grep -q '^\[E\]\|terminate called'; then
        status=1
    fi
done
exit $status
