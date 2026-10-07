#!/usr/bin/env python3
"""Measure and verify font metrics using an existing engine, without modifying it.

check_fonts.py pack/fonts.json --engine /path/to/AppRun [--install-metrics]
Results go to pack/font-check/. Uses an isolated temporary user profile.
"""
import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from prepare_fonts import prepare

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('manifest', type=Path)
parser.add_argument('--engine', type=Path, required=True)
parser.add_argument('--install-metrics', action='store_true')
args = parser.parse_args()
manifest_path = args.manifest.resolve()
root = manifest_path.parent
manifest = json.loads(manifest_path.read_text())
pack = manifest['pack']
metrics_module = manifest.get('metrics_module')
if args.install_metrics and not metrics_module:
    parser.error('set metrics_module in fonts.json before installing measured metrics')
engine = args.engine.resolve()
if not engine.is_file():
    parser.error('engine executable does not exist')
for path, text in prepare(manifest_path).items():
    if not path.exists() or path.read_text() != text:
        parser.error('generated files are outdated; run prepare_fonts.py first')
kompot = Path(__file__).resolve().parents[1]
output = root / 'font-check'
output.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='kompot-font-check-') as tmp:
    user = Path(tmp)
    content = user / 'content'
    content.mkdir()
    sources = {'kompot': kompot, pack: root}
    linked = set()
    def link(name):
        if name in linked or name in ('base', 'core'):
            return
        source = sources.get(name, root.parent / name)
        if not (source / 'package.json').is_file():
            parser.error('dependency pack not found: ' + name)
        (content / name).symlink_to(source, target_is_directory=True)
        linked.add(name)
        for dep in json.loads((source / 'package.json').read_text()).get('dependencies', []):
            link(dep)
    link('kompot')
    link(pack)
    log = output / 'font_metrics.log'
    with log.open('w') as stream:
        result = subprocess.run([str(engine), '--dir', str(user), '--test',
            str(root / 'tests/visual/font_metrics.generated.lua')],
            stdout=stream, stderr=subprocess.STDOUT, timeout=120)
    if result.returncode:
        parser.exit(1, f'Engine test failed; see {log}\n')
    source = user / 'export' / (pack + '_font_metrics.lua')
    if not source.is_file() or 'worst additivity error: 0' not in log.read_text():
        parser.exit(1, f'Metrics verification failed; see {log}\n')
    metrics = output / source.name
    shutil.copy2(source, metrics)
    if args.install_metrics:
        owner, path = metrics_module.split(':', 1)
        if owner != pack:
            parser.error('refusing to install metrics into a different pack')
        target = root / 'modules' / (path + '.lua')
        if not target.resolve().is_relative_to(root):
            parser.error('metrics path escapes pack')
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(metrics, target)
print(output)
