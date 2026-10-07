import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_fonts', ROOT / 'tools/prepare_fonts.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrepareFontsTest(unittest.TestCase):
    def test_roundtrip_preserves_unrelated_resources_and_measured_metrics(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'package.json').write_text('{"id":"fixture"}')
            (root / 'face.ttf').write_bytes((ROOT / 'fonts/IBMPlexSans-Regular.ttf').read_bytes())
            manifest = {'pack': 'fixture', 'metrics_module': 'fixture:font_metrics',
                'families': {'ui': {'sizes': [12, 14],
                'faces': {'regular': {'file': 'face.ttf'}}}}}
            (root / 'fonts.json').write_text(json.dumps(manifest))
            (root / 'preload.json').write_text('{"atlases":[{"name":"icons"}],"fonts":[]}')
            def write():
                for path, content in module.prepare(root / 'fonts.json').items():
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(content)
            write()
            metrics = root / 'modules/font_metrics.lua'
            metrics.write_text('return {fixture_ui_regular_14={lh=21,[65]=9}}\n')
            write()
            self.assertIn('[65]=9', metrics.read_text())
            self.assertIn('F.register_metrics(require "fixture:font_metrics")',
                (root / 'modules/font_families.lua').read_text())
            preload = json.loads((root / 'preload.json').read_text())
            self.assertEqual(preload['atlases'], [{'name': 'icons'}])
            self.assertEqual(len(preload['fonts']), 2)
            manifest['families']['ui']['sizes'] = [14]
            (root / 'fonts.json').write_text(json.dumps(manifest))
            write()
            self.assertEqual(len(json.loads((root / 'preload.json').read_text())['fonts']), 1)
            self.assertIn('fixture/face.ttf', (root / 'modules/font_families.lua').read_text())
            manifest['families']['ui']['faces']['regular']['file'] = '../outside.ttf'
            (root / 'fonts.json').write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                module.prepare(root / 'fonts.json')


if __name__ == '__main__':
    unittest.main()
