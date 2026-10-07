#!/usr/bin/env python3
"""Prepare native font resources and preview registration from fonts.json.

python3 tools/prepare_fonts.py /path/to/pack/fonts.json [--check]
Only build-time Python is required; the game loads generated Lua and preload.json.
"""
import argparse
import json
import re
from pathlib import Path

IDENT = re.compile(r"^[a-zA-Z0-9_-]+$")


def quote(value):
    # Lua accepts JSON quotes/escapes for these validated paths and identifiers.
    return json.dumps(value, ensure_ascii=False)


def prepare(manifest_path):
    root = manifest_path.parent.resolve()
    manifest = json.loads(manifest_path.read_text())
    pack = manifest['pack']
    if not IDENT.fullmatch(pack):
        raise ValueError('pack must contain letters, digits, underscores or hyphens')
    meta = json.loads((root / 'package.json').read_text())
    if meta['id'] != pack:
        raise ValueError('manifest pack must match package.json id')
    groups, entries, names = {}, [], set()
    for family, spec in manifest['families'].items():
        if not IDENT.fullmatch(family):
            raise ValueError('invalid family name')
        groups[pack + ':' + family] = []
        for weight, face in spec['faces'].items():
            if not IDENT.fullmatch(weight):
                raise ValueError('invalid weight name')
            path = Path(face['file'])
            resolved = (root / path).resolve()
            if path.is_absolute() or not resolved.is_relative_to(root) or not resolved.is_file():
                raise ValueError('font must be an existing file inside its pack: ' + str(path))
            if any(c in path.as_posix() for c in '\\"\n\r'):
                raise ValueError('unsupported character in font path')
            prefix = face.get('prefix', f'{pack}_{family}_{weight}')
            if not IDENT.fullmatch(prefix):
                raise ValueError('invalid font resource prefix')
            for size in spec['sizes']:
                if type(size) is not int or size <= 0 or size > 256:
                    raise ValueError('font sizes must be integers in 1..256')
                name = f'{prefix}_{size}'
                if name in names:
                    raise ValueError('duplicate font resource: ' + name)
                names.add(name)
                entry = {'name': name, 'path': path.as_posix(), 'size': size}
                entries.append(entry)
                groups[pack + ':' + family].append({
                    'name': name, 'file': pack + '/' + path.as_posix(), 'size': size, 'weight': weight})
    if not entries:
        raise ValueError('no font resources')
    preload_path = root / 'preload.json'
    preload = json.loads(preload_path.read_text()) if preload_path.exists() else {}
    index_path = root / 'fonts.generated.json'
    owned = set(json.loads(index_path.read_text())) if index_path.exists() else set()
    current = preload.get('fonts', [])
    expected = {e['name']: e for e in entries}
    for e in current:
        if e['name'] in names and e['name'] not in owned and e != expected[e['name']]:
            raise ValueError('conflicting manually declared resource: ' + e['name'])
    preload['fonts'] = [e for e in current if e['name'] not in owned | names] + entries
    module = ['-- Font-family файлик сгенерин скрптиком',
              'local F = require "kompot:kompot/fonts"']
    for family, faces in groups.items():
        module.append('F.register_family(' + quote(family) + ', {')
        for f in faces:
            module.append('    {' + ', '.join(k + ' = ' + (str(v) if isinstance(v, int) else quote(v))
                                             for k, v in f.items()) + '},')
        module.append('})')
    metrics_module = manifest.get('metrics_module')
    if metrics_module is not None:
        if not re.fullmatch(r'[a-zA-Z0-9_-]+:[a-zA-Z0-9_/-]+', metrics_module):
            raise ValueError('invalid metrics_module')
        module.append('F.register_metrics(require ' + quote(metrics_module) + ')')
    module.append('return {fonts = {' + ', '.join(quote(e['name']) for e in entries) + '}}')
    template = (Path(__file__).resolve().parents[1] / 'tests/visual/font_metrics.lua').read_text()
    start = template.index('local FONTS = {}')
    end = template.index('local CPS = {}', start)
    template = template[:start] + 'local FONTS = {' + ', '.join(quote(e['name']) for e in entries) + '}\n\n' + template[end:]
    template = template.replace('app.config_packs({"base", "kompot"})',
                                'app.config_packs({' + ', '.join(quote(p) for p in dict.fromkeys(['base', 'kompot', pack])) + '})')
    template = template.replace('"kompot_metrics"', quote(pack + '_font_metrics'))
    template = template.replace('app.sleep(0.5)', 'app.sleep(3)')
    template = template.replace('export:font_metrics.lua', 'export:' + pack + '_font_metrics.lua')
    template = '-- Generated font measurement probe. Run with the installed VoxelCore.\n' + template
    files = {preload_path: json.dumps(preload, ensure_ascii=False, indent=4) + '\n',
             index_path: json.dumps(sorted(names), indent=2) + '\n',
             root / 'modules/font_families.lua': '\n'.join(module) + '\n',
             root / 'tests/visual/font_metrics.generated.lua': template}
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--check', action='store_true', help='verify generated files without writing')
    args = parser.parse_args()
    try:
        files = prepare(args.manifest.resolve())
        changed = [p for p, data in files.items() if not p.exists() or p.read_text() != data]
        if args.check:
            if changed:
                parser.exit(1, 'Outdated generated files:\n' + '\n'.join(map(str, changed)) + '\n')
        else:
            for p in changed:
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(files[p])
        print(f'{len(files)} files checked; {len(changed)} ' + ('outdated' if args.check else 'updated'))
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
