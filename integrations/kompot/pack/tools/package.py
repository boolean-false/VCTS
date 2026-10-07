"""Build a minimal install pack with readable MPL source."""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
PACK_ID = "kompot"
RUNTIME_FILES = (
    "package.json",
    "preload.json",
    "icon.png",
    "art/icon.svg",
    "LICENSE",
    "LICENSES/CC-BY-4.0.txt",
    "README.md",
    "CHANGELOG.md",
)
RUNTIME_DIRECTORIES = {
    "modules": {".lua"},
    "scripts": {".lua"},
    "layouts": {".lua", ".xml"},
    "config": {".toml"},
    "texts": {".txt"},
    "fonts": {".ttf", ".otf", ".txt"},
    "textures": {".png"},
    "docs": {".md"},
    "annotations": {".lua"}
}
EXCLUDED_RUNTIME_FILES = {"modules/test.lua", "KOMPOT_AI_GUIDE.md"}
EXCLUDED_RUNTIME_DIRECTORIES = {"modules/showcases"}
VERSION_PATTERN = re.compile(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?")
ZIP_TIME = (1980, 1, 1, 0, 0, 0)


def release_paths(root_files: tuple[str, ...], directories: dict[str, set[str]]) -> list[Path]:
    paths = []
    for name in root_files:
        if name in EXCLUDED_RUNTIME_FILES:
            continue
        path = ROOT / name
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"Missing or linked release file: {name}")
        paths.append(path)
    for name, suffixes in directories.items():
        directory = ROOT / name
        if not directory.is_dir() or directory.is_symlink():
            raise ValueError(f"Missing or linked release directory: {name}")
        for path in directory.rglob("*"):
            relative = path.relative_to(ROOT)
            if any(
                relative.is_relative_to(excluded)
                for excluded in EXCLUDED_RUNTIME_DIRECTORIES
            ):
                continue
            if path.is_symlink():
                raise ValueError(f"Linked release resource: {path}")
            if relative.as_posix() in EXCLUDED_RUNTIME_FILES:
                continue
            if path.is_file() and path.suffix in suffixes and not any(
                part.startswith(".") for part in path.relative_to(ROOT).parts
            ):
                paths.append(path)
    return sorted(set(paths), key=lambda path: path.relative_to(ROOT).as_posix())


def metadata(paths: list[Path]) -> str:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    version = package.get("version")
    if package.get("id") != PACK_ID or not isinstance(version, str) or not VERSION_PATTERN.fullmatch(version):
        raise ValueError("Invalid package id or version")
    if package.get("license") != "MPL-2.0":
        raise ValueError("package.json must declare MPL-2.0")
    included = {path.relative_to(ROOT).as_posix() for path in paths}
    preload = json.loads((ROOT / "preload.json").read_text(encoding="utf-8"))
    for font in preload.get("fonts", []):
        if font["path"] not in included:
            raise ValueError(f"Missing preloaded font: {font['path']}")
    for atlas in preload.get("atlases", []):
        if not any(path.startswith("textures/" + atlas["name"] + "/") for path in included):
            raise ValueError(f"Missing preloaded atlas: {atlas['name']}")
    return version


def write_archive(target: Path, files: list[Path]) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=target.name + ".", suffix=".tmp", dir=target.parent)
    os.close(fd)
    temporary = Path(temporary_name)
    try:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
            for path in files:
                relative = path.relative_to(ROOT).as_posix()
                entry = ZipInfo(f"{PACK_ID}/{relative}", date_time=ZIP_TIME)
                entry.compress_type = ZIP_DEFLATED
                entry.external_attr = 0o100644 << 16
                archive.writestr(entry, path.read_bytes(), compresslevel=9)
        os.replace(temporary, target)
        target.chmod(0o644)
    finally:
        temporary.unlink(missing_ok=True)


def build(output: Path) -> Path:
    runtime = release_paths(RUNTIME_FILES, RUNTIME_DIRECTORIES)
    version = metadata(runtime)
    target = output / f"{PACK_ID}-{version}.zip"
    write_archive(target, runtime)
    print(f"Install: {target} ({len(runtime)} files)")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist", help="output directory")
    args = parser.parse_args()
    build(args.output.resolve())


if __name__ == "__main__":
    main()
