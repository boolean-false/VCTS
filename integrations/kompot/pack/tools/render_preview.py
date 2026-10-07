#!/usr/bin/env python3
"""Эталонный отрисовщик превью Kompot: JSON (kompot-preview/1) -> PNG.

Показывает, как внешний инструмент (плагин VS Code) рисует превью без
движка. Формат описан в kompot/docs/PREVIEW.md.

    python3 render_preview.py preview.json out.png [--scale 2]

Требуется Pillow.
"""
import argparse
import base64
import json
import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

PACK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.dirname(PACK)  # каталог паков: пути шрифтов - от него
SS = 4  # суперсэмплинг фигур
TEXT_DY = -1.5  # сдвиг базовой линии относительно центра строки, в пикселях макета


def hex_rgba(s):
    s = s.lstrip("#")
    if len(s) == 6:
        s += "ff"
    return tuple(int(s[i:i + 2], 16) for i in range(0, 8, 2))


class Renderer:
    def __init__(self, doc, scale):
        self.doc = doc
        self.k = scale
        w, h = round(doc["width"] * scale), round(doc["height"] * scale)
        self.img = Image.new("RGBA", (w, h), hex_rgba(doc.get("background", "#000000")))
        self.clips = {"": (0.0, 0.0, (0.0, 0.0, float(doc["width"]), float(doc["height"])))}
        self.fonts = {}
        self.icons = {}

    # --- утилиты -----------------------------------------------------------

    def font(self, p):
        key = (p["font_file"], p["font_size"])
        if key not in self.fonts:
            self.fonts[key] = ImageFont.truetype(os.path.join(CONTENT, p["font_file"]), round(p["font_size"] * self.k))
        return self.fonts[key]

    def place(self, p):
        """Абсолютный прямоугольник примитива и прямоугольник обрезки."""
        ox, oy, rect = self.clips.get(p["clip"], self.clips[""])
        return ox + p["x"], oy + p["y"], rect

    def composite(self, layer, x, y, clip):
        """Накладывает слой (в пикселях результата) с обрезкой."""
        k = self.k
        mask = Image.new("L", self.img.size, 0)
        ImageDraw.Draw(mask).rectangle([round(clip[0] * k), round(clip[1] * k),
                                        round(clip[2] * k) - 1, round(clip[3] * k) - 1], fill=255)
        full = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        full.paste(layer, (round(x * k), round(y * k)))
        a = ImageChops.multiply(full.getchannel("A"), mask)
        full.putalpha(a)
        self.img = Image.alpha_composite(self.img, full)

    def shape(self, w, h, radius, color, width=None):
        """Скруглённый прямоугольник (заливка или обводка) со сглаживанием."""
        k = self.k * SS
        W, H = max(1, round(w * k)), max(1, round(h * k))
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        is_cut = isinstance(radius, dict) and radius.get("kind") == "cut"
        def mask(width_px, height_px, radii):
            result = Image.new("L", (width_px, height_px), 255)
            for i, value in enumerate(radii):
                r = max(0, round(value * k))
                if not r:
                    continue
                if is_cut:
                    cut_mask = Image.new("L", result.size, 255)
                    a = (0,0) if i==0 else (width_px-1,0) if i==1 else (width_px-1,height_px-1) if i==2 else (0,height_px-1)
                    dx,dy = (1 if i in (0,3) else -1), (1 if i in (0,1) else -1)
                    ImageDraw.Draw(cut_mask).polygon([a,(a[0]+dx*r,a[1]),(a[0],a[1]+dy*r)],fill=0)
                    result = ImageChops.darker(result, cut_mask)
                    continue
                circle = Image.new("L", (2*r, 2*r), 0)
                ImageDraw.Draw(circle).ellipse((0, 0, 2*r-1, 2*r-1), fill=255)
                right, bottom = i in (1, 2), i in (2, 3)
                corner = circle.crop((r if right else 0, r if bottom else 0,
                                      2*r if right else r, 2*r if bottom else r))
                cut = Image.new("L", result.size, 255)
                cut.paste(corner, (width_px-r if right else 0, height_px-r if bottom else 0))
                result = ImageChops.darker(result, cut)
            return result

        if isinstance(radius, dict):
            radii = [radius.get(name, 0) for name in ("top_left", "top_right", "bottom_right", "bottom_left")]
            a, b, c, e = radii
            factor = min([1] + [length/total for length, total in
                               ((w,a+b),(w,e+c),(h,a+e),(h,b+c)) if total > 0])
            radii = [r*factor for r in radii]
        else:
            radii = [min(radius, w/2, h/2)] * 4
        outer = mask(W, H, radii)
        if width is not None:
            bw = max(0, round(width*k))
            inner = Image.new("L", (W,H), 0)
            if W>2*bw and H>2*bw:
                inner.paste(mask(W-2*bw,H-2*bw,[max(0,r-width*(2-math.sqrt(2) if is_cut else 1)) for r in radii]), (bw,bw))
            outer = ImageChops.subtract(outer, inner)
        layer.paste(color, (0,0,W,H))
        layer.putalpha(ImageChops.multiply(outer, Image.new("L", (W,H), color[3])))
        return layer.resize((max(1, round(w * self.k)), max(1, round(h * self.k))), Image.LANCZOS)

    # --- примитивы ---------------------------------------------------------

    def draw(self, p):
        kind = p["kind"]
        if p["w"] <= 0 or p["h"] <= 0:
            if kind != "clip":
                return
        x, y, clip = self.place(p)
        if kind == "clip":
            r = (max(clip[0], x), max(clip[1], y), min(clip[2], x + p["w"]), min(clip[3], y + p["h"]))
            self.clips[p["key"]] = (x, y, r)
        elif kind == "layer":
            bx, by, bw, bh = p["source_bounds"]
            children = [dict(q, x=q["x"]-bx, y=q["y"]-by) if not q.get("clip") else q for q in p["prims"]]
            source = Renderer({"width": bw, "height": bh, "background": "#00000000", "prims": children}, self.k)
            for child in children:
                source.draw(child)
            if "mask_shape" in p or "mask_radius" in p:
                mask = self.shape(p["w"], p["h"], p.get("mask_shape", p.get("mask_radius")), (255,255,255,255))
                full = Image.new("L", source.img.size, 0)
                full.paste(mask.getchannel("A"), (round(-bx*self.k), round(-by*self.k)))
                source.img.putalpha(ImageChops.multiply(source.img.getchannel("A"), full))
            a,b,c,d,tx,ty = p["transform"]
            tx,ty = tx+a*bx+c*by,ty+b*bx+d*by
            det = a*d-b*c
            if abs(det) > 1e-12:
                k = self.k
                # Map destination pixels in the document to the layer source.
                inverse = (d/det,-c/det,(-d*(x+tx)+c*(y+ty))*k/det,
                           -b/det,a/det,(b*(x+tx)-a*(y+ty))*k/det)
                layer = source.img.transform(self.img.size, Image.Transform.AFFINE, inverse, Image.Resampling.NEAREST)
                self.composite(layer, 0, 0, clip)
        elif kind == "rect":
            self.composite(self.shape(p["w"], p["h"], p.get("shape", p.get("radius", 0)), hex_rgba(p["color"])), x, y, clip)
        elif kind == "border":
            self.composite(self.shape(p["w"], p["h"], p.get("shape", p.get("radius", 0)), hex_rgba(p["color"]), p.get("width", 1)), x, y, clip)
        elif kind == "shadow":
            b = p.get("blur", 0)
            k = self.k
            layer = Image.new("RGBA", (round(p["w"] * k), round(p["h"] * k)), (0, 0, 0, 0))
            inner = self.shape(p["w"] - 2 * b, p["h"] - 2 * b, p.get("shape", p.get("radius", 0)), hex_rgba(p["color"]))
            layer.paste(inner, (round(b * k), round(b * k)))
            layer = layer.filter(ImageFilter.GaussianBlur(b * k / 2))
            self.composite(layer, x, y, clip)
        elif kind == "text":
            self.text(p["text"], p, x, y, p["h"], hex_rgba(p["color"]), clip, p.get("advances"))
        elif kind == "field":
            text = p.get("text") or ""
            color = hex_rgba(p["color"])
            if not text and p.get("hint"):
                text = p["hint"]
                color = color[:3] + (color[3] // 2,)
            if text:
                multiline = p.get("lines", 1) > 1
                rows = text.split("\n") if multiline else [text.split("\n")[0]]
                pad = p.get("pad", 8)
                lh = p.get("line_height", p.get("font_size", 14) * 1.3) if multiline else p["h"]
                gutter = (len(str(len(rows))) + 2) * p.get("font_size", 14) * 0.6 if p.get("line_numbers") else 0
                clip = (max(clip[0], x), max(clip[1], y), min(clip[2], x + p["w"]), min(clip[3], y + p["h"]))
                if clip[2] <= clip[0] or clip[3] <= clip[1]:
                    return
                for i, row in enumerate(rows):
                    top = y + (pad + i * lh if multiline else 0)
                    if top >= y + p["h"]:
                        break
                    if gutter:
                        self.text(str(i + 1), p, x + pad, top, lh, color[:3] + (color[3] // 2,), clip)
                    self.text(row, p, x + pad + gutter, top, lh, color, clip)
        elif kind == "nine_patch":
            self.nine_patch(p, x, y, clip)
        elif kind == "image":
            self.image(p, x, y, clip)
        elif kind == "canvas" and p.get("pixels"):
            w, h = max(1, int(p["w"])), max(1, int(p["h"]))
            layer = Image.frombytes("RGBA", (w, h), base64.b64decode(p["pixels"]))
            tint = hex_rgba(p.get("color", "#ffffffff"))
            if tint[3] < 255:
                layer.putalpha(layer.getchannel("A").point(lambda a: a * tint[3] // 255))
            layer = layer.resize((round(p["w"] * self.k), round(p["h"] * self.k)), Image.NEAREST)
            self.composite(layer, x, y, clip)

    def text(self, text, p, x, y, lh, color, clip, advances=None):
        font = self.font(p)
        k = self.k
        asc, desc = font.getmetrics()
        width = sum(advances) * k if advances else font.getlength(text)
        layer = Image.new("RGBA", (round(width) + 4 * round(k), max(round(lh * k), asc + desc) + 2 * round(k)), (0, 0, 0, 0))
        top = (round(lh * k) - (asc + desc)) / 2 + TEXT_DY * k
        d = ImageDraw.Draw(layer)
        if advances and len(advances) == len(text):
            # позиции символов - по ширинам движка (так же раскладывает движок)
            pen = 0.0
            for ch, adv in zip(text, advances):
                d.text((round(pen), top), ch, font=font, fill=color)
                pen += adv * k
        else:
            d.text((0, top), text, font=font, fill=color)
        self.composite(layer, x, y, clip)

    def image_source(self, p):
        src = p.get("src", "")
        relative = src.replace(":", "/", 1).split("/")
        if not relative or any(not part or part in (".", "..") for part in relative):
            return
        # "atlas:name" и "texture/path" -> textures/<путь>.png
        path = None
        for pack in sorted(os.listdir(CONTENT)):
            candidate = os.path.join(CONTENT, pack, "textures", *relative) + ".png"
            if os.path.exists(candidate):
                path = candidate
                break
        if not path:
            return
        if path not in self.icons:
            self.icons[path] = Image.open(path).convert("RGBA")
        return self.icons[path]

    def nine_patch(self, p, x, y, clip):
        sw, sh = p["source_size"]
        if p.get("source_pixels"):
            source = Image.frombytes("RGBA", (sw, sh), base64.b64decode(p["source_pixels"]))
        else:
            source = self.image_source(p)
        if source is None:
            return
        left, top, right, bottom = p["border"]
        scale = p.get("scale", 1)
        w, h = max(0, int(p["w"])), max(0, int(p["h"]))
        fx, fy = min(1, w / max(1, (left + right) * scale)), min(1, h / max(1, (top + bottom) * scale))
        dx, dy = [0, int(left * scale * fx), w - int(right * scale * fx), w], [0, int(top * scale * fy), h - int(bottom * scale * fy), h]
        sx, sy = [0, left, sw - right, sw], [0, top, sh - bottom, sh]
        layer = Image.new("RGBA", (max(1, w), max(1, h)))
        for row in range(3):
            for col in range(3):
                mode = p.get("center", "stretch") if row == col == 1 else p.get("edges", "stretch")
                dw, dh = dx[col+1] - dx[col], dy[row+1] - dy[row]
                cw, ch = sx[col+1] - sx[col], sy[row+1] - sy[row]
                if mode == "none" or min(dw, dh, cw, ch) <= 0:
                    continue
                cell = source.crop((sx[col], sy[row], sx[col+1], sy[row+1]))
                # Nearest sampling matches the GPU, including fractional scale
                # and a final partial repeat. Cache rows rather than allocating
                # an intermediate image proportional to 1 / scale.
                repeat_x, repeat_y = col == 1 and mode == "tile", row == 1 and mode == "tile"
                xs = [int((i + .5) / scale if repeat_x else (i + .5) * cw / dw) % cw for i in range(dw)]
                pixels, rows, output = cell.tobytes(), {}, []
                for i in range(dh):
                    iy = int((i + .5) / scale if repeat_y else (i + .5) * ch / dh) % ch
                    if iy not in rows:
                        rows[iy] = b"".join(pixels[(iy*cw+ix)*4:(iy*cw+ix)*4+4] for ix in xs)
                    output.append(rows[iy])
                cell = Image.frombytes("RGBA", (dw, dh), b"".join(output))
                layer.paste(cell, (dx[col], dy[row]))
        tint = hex_rgba(p.get("color", "#ffffffff"))
        channels = [channel.point(lambda v, t=t: v * t // 255) for channel, t in zip(layer.split(), tint)]
        layer = Image.merge("RGBA", channels).resize((max(1, round(w * self.k)), max(1, round(h * self.k))), Image.Resampling.NEAREST)
        self.composite(layer, x, y, clip)

    def image(self, p, x, y, clip):
        icon = self.image_source(p)
        if icon is None:
            return
        u0, v0, u1, v1 = p.get("region") or (0, 0, 1, 1)
        width, height = icon.size
        icon = icon.crop((min(u0, u1) * width, (1 - max(v0, v1)) * height,
                          max(u0, u1) * width, (1 - min(v0, v1)) * height))
        if u1 < u0:
            icon = icon.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if v1 < v0:
            icon = icon.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        sampling = Image.Resampling.NEAREST if p.get("src", "").startswith("kompot_ui_icons:") else Image.Resampling.LANCZOS
        icon = icon.resize((max(1, round(p["w"] * self.k)), max(1, round(p["h"] * self.k))), sampling)
        tint = hex_rgba(p.get("color", "#ffffffff"))
        r, g, b, a = icon.split()
        r = r.point(lambda v: v * tint[0] // 255)
        g = g.point(lambda v: v * tint[1] // 255)
        b = b.point(lambda v: v * tint[2] // 255)
        a = a.point(lambda v: v * tint[3] // 255)
        self.composite(Image.merge("RGBA", (r, g, b, a)), x, y, clip)

    def render(self):
        for p in self.doc["prims"]:
            self.draw(p)
        return self.img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--scale", type=float, default=2)
    args = ap.parse_args()
    with open(args.input, encoding="utf-8") as f:
        doc = json.load(f)
    if doc.get("format") != "kompot-preview/1":
        sys.exit("unknown format: %s" % doc.get("format"))
    Renderer(doc, args.scale).render().save(args.output)


if __name__ == "__main__":
    main()
