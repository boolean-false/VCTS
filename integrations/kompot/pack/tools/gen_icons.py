#!/usr/bin/env python3
"""Генерирует пиксельные иконки Kompot UI: textures/kompot_ui_icons/*.png.

Каждый символ рисуется на целочисленной сетке 16x16 и увеличивается до
32x32 без сглаживания. Белые пиксели окрашиваются цветом компонента.

    python3 tools/gen_icons.py
"""
import math
import os
from PIL import Image, ImageDraw

SIZE = 32
PIXELS = 16
GRID = 24                   # координаты исходных описаний
SCALE = PIXELS / GRID
STROKE = 1
WHITE = (255, 255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), "..", "textures", "kompot_ui_icons")


def P(x, y):
    return (round(x * SCALE), round(y * SCALE))


class Icon:
    def __init__(self):
        self.im = Image.new("RGBA", (PIXELS, PIXELS), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def dot(self, x, y, r=None):
        r = max(0, round((r or 1) * SCALE / 2))
        cx, cy = P(x, y)
        self.d.rectangle((cx - r, cy - r, cx + r, cy + r), fill=WHITE)

    def line(self, *pts, closed=False):
        pts = [P(x, y) for x, y in pts]
        if closed:
            pts = pts + [pts[0]]
        self.d.line(pts, fill=WHITE, width=STROKE)

    def circle(self, x, y, r, fill=False):
        cx, cy = P(x, y)
        rr = round(r * SCALE)
        if fill:
            self.d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=WHITE)
        else:
            self.d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=WHITE, width=STROKE)

    def arc(self, x, y, r, a0, a1, steps=24):
        pts = []
        for i in range(steps + 1):
            a = math.radians(a0 + (a1 - a0) * i / steps)
            pts.append((x + r * math.cos(a), y + r * math.sin(a)))
        self.line(*pts)

    def poly(self, *pts):
        self.d.polygon([P(x, y) for x, y in pts], fill=WHITE)

    def rect(self, x0, y0, x1, y1, radius=2, fill=False):
        box = (*P(x0, y0), *P(x1, y1))
        if fill:
            self.d.rectangle(box, fill=WHITE)
        else:
            self.d.rectangle(box, outline=WHITE, width=STROKE)

    def save(self, name):
        self.im.resize((SIZE, SIZE), Image.Resampling.NEAREST).save(os.path.join(OUT, name + ".png"))


def star_points(cx, cy, r1, r2, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = r1 if i % 2 == 0 else r2
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def heart_points(cx, cy, s):
    pts = []
    for i in range(64):
        t = i / 64 * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * s, cy + y * s))
    return pts


ICONS = {}


def icon(fn):
    ICONS[fn.__name__] = fn
    return fn


@icon
def add(i): i.line((12, 5), (12, 19)); i.line((5, 12), (19, 12))
@icon
def remove(i): i.line((5, 12), (19, 12))
@icon
def close(i): i.line((6, 6), (18, 18)); i.line((18, 6), (6, 18))
@icon
def check(i): i.line((5, 12.5), (10, 17.5), (19.5, 7))
@icon
def chevron_left(i): i.line((15, 5), (8, 12), (15, 19))
@icon
def chevron_right(i): i.line((9, 5), (16, 12), (9, 19))
@icon
def chevron_up(i): i.line((5, 15), (12, 8), (19, 15))
@icon
def chevron_down(i): i.line((5, 9), (12, 16), (19, 9))
@icon
def arrow_back(i): i.line((19, 12), (5, 12)); i.line((11, 6), (5, 12), (11, 18))
@icon
def arrow_forward(i): i.line((5, 12), (19, 12)); i.line((13, 6), (19, 12), (13, 18))
@icon
def arrow_up(i): i.line((12, 19), (12, 5)); i.line((6, 11), (12, 5), (18, 11))
@icon
def arrow_down(i): i.line((12, 5), (12, 19)); i.line((6, 13), (12, 19), (18, 13))
@icon
def menu(i): i.line((4, 6), (20, 6)); i.line((4, 12), (20, 12)); i.line((4, 18), (20, 18))
@icon
def more_vert(i): i.dot(12, 5, 1.8); i.dot(12, 12, 1.8); i.dot(12, 19, 1.8)
@icon
def more_horiz(i): i.dot(5, 12, 1.8); i.dot(12, 12, 1.8); i.dot(19, 12, 1.8)
@icon
def search(i): i.circle(10.5, 10.5, 6); i.line((15, 15), (20, 20))
@icon
def home(i): i.line((4, 11), (12, 4), (20, 11)); i.line((6, 9.5), (6, 20), (18, 20), (18, 9.5)); i.line((10, 20), (10, 14), (14, 14), (14, 20))


@icon
def settings(i):
    i.circle(12, 12, 3.2)
    for k in range(8):
        a = math.radians(k * 45)
        i.line((12 + 6.2 * math.cos(a), 12 + 6.2 * math.sin(a)), (12 + 8.6 * math.cos(a), 12 + 8.6 * math.sin(a)))
    i.circle(12, 12, 6.2)


@icon
def person(i): i.circle(12, 8, 3.8); i.arc(12, 21, 7.5, 200, 340)
@icon
def group(i): i.circle(9, 8.5, 3.2); i.arc(9, 20.5, 6, 200, 340); i.circle(16.5, 7.5, 2.6); i.arc(17, 18, 4.8, 225, 330)
@icon
def heart(i): i.poly(*heart_points(12, 12.5, 0.52))
@icon
def heart_outline(i): i.line(*heart_points(12, 12.5, 0.5), closed=True)
@icon
def star(i): i.poly(*star_points(12, 12.8, 9, 4))
@icon
def star_outline(i): i.line(*star_points(12, 12.8, 8.5, 3.8), closed=True)
@icon
def bell(i): i.line((6, 17), (6, 11)); i.arc(12, 11, 6, 180, 360); i.line((18, 11), (18, 17)); i.line((4.5, 17), (19.5, 17)); i.line((10, 20.5), (14, 20.5))
@icon
def trash(i): i.line((4, 6.5), (20, 6.5)); i.line((9, 6.5), (9.5, 4), (14.5, 4), (15, 6.5)); i.line((6.5, 6.5), (7.5, 20), (16.5, 20), (17.5, 6.5)); i.line((10.5, 10), (10.5, 16.5)); i.line((13.5, 10), (13.5, 16.5))
@icon
def edit(i): i.line((5, 19), (5.5, 15), (15.5, 5), (19, 8.5), (9, 18.5), (5, 19)); i.line((13, 7.5), (16.5, 11))
@icon
def info(i): i.circle(12, 12, 8.5); i.line((12, 11), (12, 16.5)); i.dot(12, 7.8, 1.4)
@icon
def warning(i): i.line((12, 4), (21, 19.5), (3, 19.5), closed=True); i.line((12, 9.5), (12, 14)); i.dot(12, 17, 1.3)
@icon
def error(i): i.circle(12, 12, 8.5); i.line((12, 7.5), (12, 13)); i.dot(12, 16.5, 1.4)
@icon
def lock(i): i.rect(5, 10.5, 19, 20, 2); i.arc(12, 10.5, 4, 180, 360); i.line((8, 10.5), (8, 9.5)); i.line((16, 10.5), (16, 9.5))
@icon
def eye(i): i.arc(12, 20, 11, 225, 315); i.arc(12, 4, 11, 45, 135); i.circle(12, 12, 3)
@icon
def sun(i):
    i.circle(12, 12, 4)
    for k in range(8):
        a = math.radians(k * 45)
        i.line((12 + 6.8 * math.cos(a), 12 + 6.8 * math.sin(a)), (12 + 9 * math.cos(a), 12 + 9 * math.sin(a)))
@icon
def moon(i):
    i.circle(12, 12, 8.5, fill=True)
    cx, cy = P(16.5, 8)
    r = 7.2 * SCALE
    i.d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 0, 0, 0))
@icon
def palette(i): i.arc(12, 12, 8.5, 20, 300); i.line((12 + 8.5 * math.cos(math.radians(20)), 12 + 8.5 * math.sin(math.radians(20))), (15, 15), (13, 19.5)); i.dot(8, 10, 1.5); i.dot(11.5, 7, 1.5); i.dot(15.5, 8.5, 1.5)
@icon
def grid(i): i.rect(4, 4, 11, 11, 1.5); i.rect(13, 4, 20, 11, 1.5); i.rect(4, 13, 11, 20, 1.5); i.rect(13, 13, 20, 20, 1.5)
@icon
def list(i): i.dot(5, 6, 1.4); i.dot(5, 12, 1.4); i.dot(5, 18, 1.4); i.line((9, 6), (20, 6)); i.line((9, 12), (20, 12)); i.line((9, 18), (20, 18))
@icon
def folder(i): i.line((3.5, 18.5), (3.5, 6), (9, 6), (11, 8.5), (20.5, 8.5), (20.5, 18.5), closed=True)
@icon
def file(i): i.line((6, 3.5), (14, 3.5), (18.5, 8), (18.5, 20.5), (6, 20.5), closed=True); i.line((13.5, 3.5), (13.5, 8.5), (18.5, 8.5))
@icon
def play(i): i.poly((8, 5), (19, 12), (8, 19))
@icon
def pause(i): i.rect(6.5, 5, 10, 19, 1, fill=True); i.rect(14, 5, 17.5, 19, 1, fill=True)
@icon
def refresh(i): i.arc(12, 12, 7.5, -60, 250); i.line((18.5, 3.5), (16, 5.8), (19.5, 7.5))
@icon
def download(i): i.line((12, 4), (12, 15)); i.line((7, 10.5), (12, 15.5), (17, 10.5)); i.line((5, 19.5), (19, 19.5))
@icon
def upload(i): i.line((12, 16), (12, 5)); i.line((7, 9.5), (12, 4.5), (17, 9.5)); i.line((5, 19.5), (19, 19.5))
@icon
def send(i): i.line((4, 5), (20.5, 12), (4, 19), (7, 12), closed=True); i.line((7, 12), (13, 12))
@icon
def chat(i): i.line((4, 5), (20, 5), (20, 16), (10, 16), (6, 20), (6, 16), (4, 16), closed=True)
@icon
def calendar(i): i.rect(4, 5.5, 20, 20, 2); i.line((4, 10), (20, 10)); i.line((8.5, 3.5), (8.5, 7)); i.line((15.5, 3.5), (15.5, 7))
@icon
def clock(i): i.circle(12, 12, 8.5); i.line((12, 7), (12, 12), (15.5, 14))
@icon
def chart(i): i.line((4, 20), (20, 20)); i.line((7, 17), (7, 12)); i.line((12, 17), (12, 6)); i.line((17, 17), (17, 10))
@icon
def bolt(i): i.poly((13.5, 2.5), (5.5, 13.5), (11, 13.5), (9.5, 21.5), (18.5, 10), (12.5, 10))
@icon
def cube(i): i.line((12, 3.5), (19.5, 7.5), (19.5, 16.5), (12, 20.5), (4.5, 16.5), (4.5, 7.5), closed=True); i.line((4.5, 7.5), (12, 11.5), (19.5, 7.5)); i.line((12, 11.5), (12, 20.5))
@icon
def drag(i):
    for x in (9, 15):
        for y in (6, 12, 18):
            i.dot(x, y, 1.6)
@icon
def filter(i): i.line((4, 6), (20, 6)); i.line((7, 12), (17, 12)); i.line((10, 18), (14, 18))
@icon
def copy(i): i.rect(8.5, 8.5, 19.5, 19.5, 2); i.line((15.5, 6), (15.5, 4.5), (4.5, 4.5), (4.5, 15.5), (6, 15.5))
@icon
def link(i): i.arc(8, 16, 4, 45, 315); i.arc(16, 8, 4, 225, 495); i.line((9.5, 14.5), (14.5, 9.5))
@icon
def globe(i):
    i.circle(12, 12, 8.5)
    i.line((3.5, 12), (20.5, 12))
    x0, y0 = P(8.2, 3.5)
    x1, y1 = P(15.8, 20.5)
    i.d.ellipse((x0, y0, x1, y1), outline=WHITE, width=int(STROKE))
@icon
def sparkle(i): i.poly(*star_points(11, 13, 8.5, 2.2, 4, -90)); i.poly(*star_points(18.5, 5.5, 3.5, 1, 4, -90))
@icon
def rocket(i): i.line((12, 3), (16, 8), (16, 16), (8, 16), (8, 8), closed=True); i.line((8, 12), (5, 15.5), (8, 16.5)); i.line((16, 12), (19, 15.5), (16, 16.5)); i.line((10.5, 19), (12, 21.5), (13.5, 19)); i.circle(12, 9.5, 1.6)
@icon
def inbox(i): i.line((3.5, 13), (6.5, 5), (17.5, 5), (20.5, 13), (20.5, 19.5), (3.5, 19.5), closed=True); i.line((3.5, 13), (8.5, 13), (10, 15.5), (14, 15.5), (15.5, 13), (20.5, 13))
@icon
def tune(i): i.line((4, 7), (20, 7)); i.line((4, 17), (20, 17)); i.circle(9, 7, 2.2, fill=True); i.circle(15, 17, 2.2, fill=True)
@icon
def radio_on(i): i.circle(12, 12, 8.5); i.circle(12, 12, 4.2, fill=True)
@icon
def radio_off(i): i.circle(12, 12, 8.5)
@icon
def circle(i): i.circle(12, 12, 9, fill=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in ICONS.items():
        ic = Icon()
        fn(ic)
        ic.save(name)
    print(f"{len(ICONS)} icons -> {os.path.normpath(OUT)}")


if __name__ == "__main__":
    main()
