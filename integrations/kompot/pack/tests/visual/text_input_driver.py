#!/usr/bin/env python3
"""Real X11 keyboard/clipboard test. Usage: python text_input_driver.py /path/to/AppRun.

Requires xdotool and xclip. Opens a temporary engine window; saves/restores
the clipboard's text or PNG representation. Artifacts stay in the printed directory.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time


def run(*args, **kwargs):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, **kwargs).stdout


def windows():
    result = subprocess.run(["xdotool", "search", "--onlyvisible", "--name", "VoxelCore"],
                            stdout=subprocess.PIPE)
    return set(result.stdout.decode().split())


def main():
    engine = sys.argv[1] if len(sys.argv) > 1 else os.environ["VOXELCORE"]
    pack = Path(__file__).resolve().parents[2]
    root = Path(tempfile.mkdtemp(prefix="kompot-text-input."))
    (root / "content").mkdir()
    (root / "content/kompot").symlink_to(pack)
    export = root / "export"
    export.mkdir()
    (export / "driver").touch()
    if "--presentation" in sys.argv[2:]:
        (export / "presentation").touch()
    previous = windows()
    saved, target = None, None
    try:
        targets = run("xclip", "-selection", "clipboard", "-o", "-t", "TARGETS", stderr=subprocess.DEVNULL)
        for candidate in ("image/png", "UTF8_STRING"):
            if candidate.encode() in targets:
                target = candidate
                saved = run("xclip", "-selection", "clipboard", "-o", "-t", target)
                break
    except subprocess.CalledProcessError:
        pass
    process = None
    held = set()
    try:
        with (root / "engine.log").open("wb") as log:
            environment = dict(os.environ, XDG_SESSION_TYPE="x11")
            environment.pop("WAYLAND_DISPLAY", None)
            process = subprocess.Popen([engine, "--dir", str(root), "--test",
                                        str(pack / "tests/visual/text_input.lua")], stdout=log, stderr=log, env=environment)
            deadline, handled, window = time.monotonic() + 90, 0, None
            while process.poll() is None:
                if time.monotonic() > deadline:
                    raise TimeoutError("native input test exceeded 90 seconds")
                request = export / "request.json"
                if not request.exists():
                    time.sleep(0.05)
                    continue
                try:
                    action = json.loads(request.read_text())
                except json.JSONDecodeError:
                    continue
                if action["id"] == handled:
                    time.sleep(0.05)
                    continue
                if window is None:
                    candidates = windows() - previous
                    if not candidates:
                        time.sleep(0.05)
                        continue
                    window, = candidates
                    run("xdotool", "windowfocus", "--sync", window)
                    time.sleep(0.3)
                focused = subprocess.run(["xdotool", "getwindowfocus"], stdout=subprocess.PIPE,
                                         stderr=subprocess.DEVNULL)
                if focused.returncode or focused.stdout.decode().strip() != window:
                    run("xdotool", "windowfocus", "--sync", window)
                    time.sleep(0.15)
                response = {}
                try:
                    for key in action.get("down", []):
                        run("xdotool", "keydown", key)
                        held.add(key)
                    for key in action.get("up", []):
                        run("xdotool", "keyup", key)
                        held.discard(key)
                    if "clipboard" in action:
                        run("xclip", "-selection", "clipboard", "-i", "-t", "UTF8_STRING",
                            input=action["clipboard"].encode())
                        time.sleep(0.1)
                    for chord in action.get("keys", []):
                        # Keep modifiers down across engine frames, not only X events.
                        parts = chord.split("+")
                        for modifier in parts[:-1]:
                            run("xdotool", "keydown", modifier)
                        time.sleep(0.08)
                        run("xdotool", "keydown", parts[-1])
                        time.sleep(0.08)
                        run("xdotool", "keyup", parts[-1])
                        for modifier in reversed(parts[:-1]):
                            run("xdotool", "keyup", modifier)
                        time.sleep(0.12)
                    if "text" in action:
                        run("xdotool", "type", "--delay", "70", "--", action["text"])
                        time.sleep(0.15)
                    if "drag" in action:
                        x, y, end_x, end_y = map(lambda v: str(round(v)), action["drag"])
                        run("xdotool", "mousemove", "--window", window, x, y)
                        time.sleep(0.15)
                        run("xdotool", "mousedown", "1")
                        time.sleep(0.15)
                        run("xdotool", "mousemove", "--window", window, end_x, end_y)
                        time.sleep(0.15)
                        run("xdotool", "mouseup", "1")
                        time.sleep(0.15)
                    if "wheel" in action:
                        x, y, count = action["wheel"]
                        run("xdotool", "mousemove", "--window", window,
                            str(round(x)), str(round(y)))
                        time.sleep(0.15)
                        for _ in range(count):
                            run("xdotool", "click", "5")
                            time.sleep(0.12)
                    if action.get("read_clipboard"):
                        response["text"] = run("xclip", "-selection", "clipboard", "-o", "-t", "UTF8_STRING").decode()
                except Exception as error:
                    response["error"] = str(error)
                handled = action["id"]
                tmp = export / "reply.tmp"
                tmp.write_text(json.dumps(response))
                tmp.rename(export / f"reply_{handled}.json")
            if process.returncode or "passed: native text input" not in (root / "engine.log").read_text():
                raise RuntimeError("native input test failed; see engine.log")
            print("Native input test passed")
    finally:
        for key in held:
            subprocess.run(["xdotool", "keyup", key], check=False)
        if process and process.poll() is None:
            process.terminate()
            process.wait(timeout=10)
        if saved is not None:
            run("xclip", "-selection", "clipboard", "-i", "-t", target, input=saved)
        print(f"Artifacts: {root}")


if __name__ == "__main__":
    main()
