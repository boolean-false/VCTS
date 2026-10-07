#!/usr/bin/env python3
"""Сверяет превью без движка с отрисовкой движка.

    luajit kompot/tools/preview_host.lua . my_pack:ui/previews --all > all.json
    python3 tools/compare_previews.py all.json \\
        tests/visual/out/previews_layout.txt tests/visual/out [--save diff.png]

Средняя разница яркости (0-255) по каждому превью; > 5 - ошибка.
"""
import argparse
import json
import os
import sys

from PIL import Image, ImageChops, ImageStat

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render_preview import Renderer  # noqa: E402

LIMIT = 5.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("docs")
    ap.add_argument("layout")
    ap.add_argument("shots")
    ap.add_argument("--save")
    a = ap.parse_args()
    docs = json.load(open(a.docs, encoding="utf-8"))
    rows, worst = [], 0.0
    for line in open(a.layout):
        page, i, x, y, w, h = map(int, line.split())
        shot = Image.open(os.path.join(a.shots, "previews_%d.png" % page)).convert("RGB")
        eng = shot.crop((x, y, x + w, y + h))
        ref = Renderer(docs[i - 1], 1).render().convert("RGB")
        diff = ImageChops.difference(eng, ref)
        mean = ImageStat.Stat(diff.convert("L")).mean[0]
        worst = max(worst, mean)
        print("%-24s %5.2f %s" % (docs[i - 1]["name"], mean, "OK" if mean <= LIMIT else "FAIL"))
        rows.append((eng, ref, diff))
    if a.save:
        width = max(e.width for e, _, _ in rows) * 3 + 20
        height = sum(e.height + 10 for e, _, _ in rows)
        sheet = Image.new("RGB", (width, height), (80, 80, 80))
        y = 0
        for e, r, d in rows:
            sheet.paste(e, (0, y))
            sheet.paste(r, (e.width + 10, y))
            sheet.paste(d, (e.width * 2 + 20, y))
            y += e.height + 10
        sheet.save(a.save)
    sys.exit(0 if worst <= LIMIT else 1)


if __name__ == "__main__":
    main()
