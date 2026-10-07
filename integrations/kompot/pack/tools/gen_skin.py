#!/usr/bin/env python3
"""Build the editable Kompot UI surface tiles.

Kompot UI tints the neutral midtone by the current component color, retaining
the same borders and repeated grain at any window size.

The grain avoids anything the eye can lock onto when the tile repeats:
- no blotches on a regular lattice: random blocks still show their straight
  edges as a grid, so the low-frequency variation is soft value noise;
- speckles never touch each other, so random clumps do not form shapes that
  reappear with every tile;
- surfaces that grow large get a large tile (256 px), and all noise wraps
  around the tile period, so neighbouring tiles join without seams.
Noise comes from a seeded generator: the output is reproducible.
"""
import math
import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'textures' / 'kompot_ui_skin'
BORDER = 4
SEED = 7
# Speckles: 2x2 px cells, share of dark and light ones and their shade.
SPECK = 2
DARK, LIGHT = 0.03, 0.02
DARK_SHADE, LIGHT_SHADE = -4, 3
# Soft variation: (cells per tile period, amplitude in shade units).
OCTAVES = ((4, 1.0), (16, 0.8))
# name: (reference, midtone, repeated center size). The center is the grain
# period; it must be divisible by SPECK and by every OCTAVES cell count.
SURFACES = {
    'panel': (70, 140, 256),
    'button': (116, 200, 64),
    'button_pressed': (65, 140, 64),
    'inset': (38, 140, 256),
}


def byte(value):
    return max(0, min(255, math.floor(value + 0.5)))


def specks(rng, period):
    """Evenly spread speckles: no two touch, including across the tile edge."""
    n = period // SPECK
    field = [[0] * n for _ in range(n)]
    want_dark, want_light = int(n * n * DARK), int(n * n * LIGHT)
    cells = [(y, x) for y in range(n) for x in range(n)]
    rng.shuffle(cells)
    for y, x in cells:
        if want_dark == 0 and want_light == 0:
            break
        if any(field[(y + dy) % n][(x + dx) % n] for dy in (-1, 0, 1) for dx in (-1, 0, 1)):
            continue
        if want_dark:
            field[y][x], want_dark = DARK_SHADE, want_dark - 1
        else:
            field[y][x], want_light = LIGHT_SHADE, want_light - 1
    return field


def value_noise(rng, period, cells):
    """Smooth noise in -1..1 that wraps around the period."""
    grid = [[rng.uniform(-1, 1) for _ in range(cells)] for _ in range(cells)]
    size = period / cells

    def at(px, py):
        gx, gy = px / size, py / size
        x0, y0 = math.floor(gx), math.floor(gy)
        fx, fy = gx - x0, gy - y0
        sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)

        def v(i, j):
            return grid[j % cells][i % cells]

        top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx
        bottom = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx
        return top + (bottom - top) * sy

    return at


def grain_field(period):
    rng = random.Random(SEED)
    speck = specks(rng, period)
    octaves = [(value_noise(rng, period, cells), amp) for cells, amp in OCTAVES]

    def grain(px, py):
        # px, py are relative to the tile start and wrap by the period
        px, py = px % period, py % period
        # soft variation is sampled per speckle cell to stay on the pixel grid
        qx, qy = px - px % SPECK, py - py % SPECK
        soft = sum(noise(qx, qy) * amp for noise, amp in octaves)
        return speck[py // SPECK][px // SPECK] + soft

    return grain


def make(name, reference, midtone, period):
    assert period % SPECK == 0 and all(period % cells == 0 for cells, _ in OCTAVES), name
    size = period + BORDER * 2
    image = Image.new('RGBA', (size, size))
    inset = name in ('inset', 'button_pressed')
    grain_at = grain_field(period)
    for y in range(size):
        for x in range(size):
            left, top, right, bottom = x, y, size - x - 1, size - y - 1
            d = min(left, top, right, bottom)
            corner = min(left, right) < 2 and min(top, bottom) < 2
            if name == 'panel' and corner:
                continue
            # the edges repeat along their length with the same period as the
            # center, so they sample the same wrapping field
            grain = grain_at(x - BORDER, y - BORDER)
            if name == 'inset':
                grain = grain * 0.4
            shade = grain
            if d < 2:
                shade = -20 if name == 'panel' else -39
            elif d < 4:
                upper = min(left, top) < min(right, bottom)
                shade = ((11 if upper else -10) if name == 'panel' else (25 if upper != inset else -23)) + grain
            elif inset and top < 6:
                shade = -12 + grain
            value = byte(midtone + shade * midtone / reference)
            image.putpixel((x, y), (value, value, value, 255))
    return image


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (reference, midtone, period) in SURFACES.items():
        make(name, reference, midtone, period).save(OUT / (name + '.png'))
    print(f'{len(SURFACES)} skin tiles -> {OUT}')


if __name__ == '__main__':
    main()
