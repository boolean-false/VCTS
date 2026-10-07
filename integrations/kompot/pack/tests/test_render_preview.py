import base64
import importlib.util
import os
import tempfile
import unittest

from PIL import Image, ImageChops


SPEC = importlib.util.spec_from_file_location(
    "render_preview", os.path.join(os.path.dirname(__file__), "..", "tools", "render_preview.py"))
render_preview = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(render_preview)


class ImageRegionTest(unittest.TestCase):
    def test_cut_shape_and_mask_use_the_resolved_shape_field(self):
        renderer = render_preview.Renderer({"width": 80, "height": 60, "background": "#00000000"}, 1)
        shape = {"kind": "cut", "top_left": 20, "top_right": 0, "bottom_right": 0, "bottom_left": 0}
        fill = renderer.shape(80,60,shape,(255,255,255,255))
        self.assertEqual(fill.getpixel((6,6))[3],0)
        self.assertEqual(fill.getpixel((79,59))[3],255)
        rect = {"kind": "rect", "key": "r", "clip": "", "x": 0, "y": 0,
                "w": 80, "h": 60, "color": "#FFFFFFFF"}
        renderer.draw({"kind": "layer", "key": "l", "clip": "", "x": 0, "y": 0,
                       "w": 80, "h": 60, "source_bounds": [0,0,80,60], "transform": [1,0,0,1,0,0],
                       "mask_shape": shape, "prims": [rect]})
        self.assertEqual(renderer.img.getpixel((6,6))[3],0)
        self.assertEqual(renderer.img.getpixel((40,30))[3],255)


    def test_asymmetric_shape_and_nested_mask(self):
        renderer = render_preview.Renderer({"width": 80, "height": 60, "background": "#00000000"}, 1)
        shape = renderer.shape(80, 60, {"top_left": 20}, (255,255,255,255))
        self.assertEqual(shape.getpixel((0, 0))[3], 0)
        self.assertEqual(shape.getpixel((79, 59))[3], 255)
        rect = {"kind": "rect", "key": "r", "clip": "", "x": 0, "y": 0,
                "w": 80, "h": 60, "color": "#FFFFFFFF"}
        layer = {"kind": "layer", "key": "l", "clip": "", "x": 0, "y": 0,
                 "w": 80, "h": 60, "source_bounds": [0,0,80,60], "transform": [1,0,0,1,0,0],
                 "mask_radius": {"bottom_right": 20}, "prims": [rect]}
        renderer.draw(dict(layer, key="outer", mask_radius={"top_left": 20}, prims=[layer]))
        self.assertEqual(renderer.img.getpixel((0, 0))[3], 0)
        self.assertEqual(renderer.img.getpixel((79, 59))[3], 0)
        self.assertEqual(renderer.img.getpixel((79, 0))[3], 255)
        self.assertEqual(renderer.img.getpixel((40, 30))[3], 255)

    def test_nine_patch_preserves_corners_and_repeats_partial_center(self):
        source = Image.new("RGBA", (4, 4), (10, 20, 30, 255))
        source.putpixel((0, 0), (255, 0, 0, 255))
        source.putpixel((3, 0), (0, 255, 0, 255))
        source.putpixel((0, 3), (0, 0, 255, 255))
        source.putpixel((3, 3), (255, 255, 255, 255))
        source.putpixel((1, 1), (50, 50, 50, 255))
        source.putpixel((2, 1), (100, 100, 100, 255))
        doc = {"width": 9, "height": 7, "background": "#00000000", "prims": [{
            "kind": "nine_patch", "key": "p", "clip": "", "x": 0, "y": 0, "w": 9, "h": 7,
            "source_size": [4, 4], "source_pixels": base64.b64encode(source.tobytes()).decode(),
            "border": [1, 1, 1, 1], "center": "tile", "edges": "stretch", "scale": 1,
        }]}
        image = render_preview.Renderer(doc, 1).render()
        for dest, src in [((0, 0), (0, 0)), ((8, 0), (3, 0)), ((0, 6), (0, 3)), ((8, 6), (3, 3))]:
            self.assertEqual(image.getpixel(dest), source.getpixel(src))
        for x in range(1, 8):
            self.assertEqual(image.getpixel((x, 1)), source.getpixel((1 + (x-1) % 2, 1)))
        doc["prims"][0]["center"] = "none"
        image = render_preview.Renderer(doc, 1).render()
        self.assertEqual(image.getpixel((3, 3))[3], 0)

    def test_multiline_field_keeps_blank_rows_and_clips_long_text(self):
        doc = {"width": 180, "height": 130, "background": "#000000FF", "prims": [{
            "kind": "field", "key": "f", "clip": "", "x": 10, "y": 10,
            "w": 100, "h": 90, "lines": 4, "line_height": 24, "pad": 5,
            "text": "first\n\n" + "last" * 30 + "\nclipped", "color": "#FFFFFFFF",
            "font_file": "kompot/fonts/IBMPlexMono-Regular.ttf", "font_size": 14,
        }]}
        result = render_preview.Renderer(doc, 1).render()
        mask = ImageChops.difference(result.convert("RGB"), Image.new("RGB", result.size))
        self.assertIsNotNone(mask.crop((10, 15, 110, 39)).getbbox())
        self.assertIsNone(mask.crop((10, 39, 110, 63)).getbbox(), "blank row collapsed")
        self.assertIsNotNone(mask.crop((10, 63, 110, 87)).getbbox())
        self.assertIsNone(mask.crop((110, 0, 180, 130)).getbbox(), "text escaped field width")
        self.assertIsNone(mask.crop((0, 100, 180, 130)).getbbox(), "text escaped field height")
        doc["prims"][0]["y"] = 200
        offscreen = render_preview.Renderer(doc, 1).render()
        self.assertIsNone(ImageChops.difference(offscreen.convert("RGB"),
                                             Image.new("RGB", offscreen.size)).getbbox())

    def test_region_uses_bottom_origin_uv(self):
        with tempfile.TemporaryDirectory() as content:
            textures = os.path.join(content, "pack", "textures", "atlas")
            os.makedirs(textures)
            icon = Image.new("RGBA", (2, 2))
            icon.putdata([(255, 0, 0, 255), (0, 255, 0, 255),
                          (0, 0, 255, 255), (255, 255, 0, 255)])
            icon.save(os.path.join(textures, "test.png"))
            old_content = render_preview.CONTENT
            render_preview.CONTENT = content
            try:
                doc = {"width": 1, "height": 1, "prims": [{
                    "kind": "image", "key": "i", "clip": "", "src": "atlas:test",
                    "x": 0, "y": 0, "w": 1, "h": 1, "region": [0, 0.5, 0.5, 1],
                }]}
                result = render_preview.Renderer(doc, 1).render()
                self.assertEqual(result.getpixel((0, 0)), (255, 0, 0, 255))
                doc["width"] = doc["height"] = 2
                doc["prims"][0].update(w=2, h=2, region=[0, 1, 1, 0])
                flipped = render_preview.Renderer(doc, 1).render()
                self.assertEqual(flipped.getpixel((0, 0)), (0, 0, 255, 255))
            finally:
                render_preview.CONTENT = old_content


if __name__ == "__main__":
    unittest.main()
