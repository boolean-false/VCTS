#!/usr/bin/env python3
"""Compare real engine and webview pixels. No fixture fonts enter the release.
Requires Pillow and numpy. --font accepts any TTF/OTF in addition to pack fonts.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--content', type=Path, default=root.parent / 'game/content')
parser.add_argument('--engine', type=Path)
parser.add_argument('--font', type=Path, action='append', default=[])
parser.add_argument('--tolerance',type=int,default=1,help='Maximum per-channel color difference; positions must match exactly')
parser.add_argument('--out', type=Path, default=Path('/tmp/kompot-font-parity'))
args = parser.parse_args()
content = args.content.resolve()
if not args.engine:
    log = (content.parent / 'latest.log').read_text()
    exe = Path(re.search(r'executable path: (.+)', log)[1])
    args.engine = exe.parents[2] / 'AppRun'
args.out.mkdir(parents=True, exist_ok=True)
font_files = [content / 'kompot/fonts' / name for name in
              ['IBMPlexSans-Regular.ttf', 'IBMPlexSans-SemiBold.ttf', 'IBMPlexMono-Regular.ttf']]
font_files += args.font
sizes = [11, 13, 16, 24, 32, 44]
subprocess.run(['npm', 'run', 'build'], cwd=root, check=True)
with tempfile.TemporaryDirectory(prefix='kompot-font-parity-') as temporary:
    work = Path(temporary)
    fixture_content = work / 'content'
    fixture_content.mkdir()
    (fixture_content / 'kompot').symlink_to(content / 'kompot', target_is_directory=True)
    pack = fixture_content / 'parity'
    (pack / 'fonts').mkdir(parents=True)
    (pack / 'modules').mkdir()
    (pack / 'package.json').write_text(json.dumps({'id':'parity','title':'Font parity','version':'1.0','creator':'test'}))
    cases = []
    preload = []
    entries = []
    for index, font in enumerate(font_files):
        name = f'font{index}{font.suffix}'
        shutil.copy2(font, pack / 'fonts' / name)
        for slot,size in enumerate(sizes):
            resource = f'parity_face{index}_slot{slot}'
            preload.append({'name':resource,'path':'fonts/'+name,'size':size})
            entries.append(f'{{name="{resource}",file="parity/fonts/{name}",size={size},weight="face{index}"}}')
            cases.append({'name':f'font{index}_{size}','font':str(font),'resource':resource,'size':size})
    res=args.engine.parent / 'usr/share/VoxelCore/res'
    for source in (res / 'fonts').glob('font_*.png'):
        shutil.copy2(source,pack / 'fonts' / source.name.replace('font_', 'bitmap_'))
    preload.append({'name':'parity_bitmap','path':'fonts/bitmap'})
    entries.append('{name="parity_bitmap",file="parity/fonts/bitmap",size=16,kind="bitmap",weight="bitmap"}')
    cases.extend([{'name':'bitmap_external','font':str(res/'fonts/font_0.png'),'resource':'parity_bitmap','size':16},
                  {'name':'bitmap_normal','font':str(res/'fonts/font_0.png'),'resource':'normal','size':16}])
    (work / 'latest.log').write_text((content.parent / 'latest.log').read_text())
    # Deliberately overlapping colored cells exercise page order and tinting.
    for source in (res / 'fonts').glob('font_*.png'):
        img=Image.new('RGBA',Image.open(source).size,(180,70,40,128) if source.stem.endswith('_0') else (35,160,90,128))
        img.save(pack / 'fonts' / source.name.replace('font_', 'colored_'))
    preload.append({'name':'parity_colored','path':'fonts/colored'})
    entries.append('{name="parity_colored",file="parity/fonts/colored",size=16,kind="bitmap",weight="colored"}')
    cases.append({'name':'bitmap_colored','font':'generated colored PNG pages','resource':'parity_colored','size':16})
    (pack / 'preload.json').write_text(json.dumps({'fonts':preload}))
    (pack / 'cases.json').write_text(json.dumps(cases))
    source = '''local K=require "kompot:kompot"
K.fonts.register_family("parity:arbitrary",{ENTRIES})
local cases={}
local function add(name,font,size)
 local width,height=520,size*11+30
 local function content()
  K.Box({modifier=K.M:size(width,height):background("#252B31")},function()
   K.Column({modifier=K.M:padding(10),spacing=2},function()
    K.Text("AgjQy WMW iii 019 / []",{font=font})
    K.Text("Съешь ещё булок — ёж №42",{font=font})
    K.Text("AV To ffi fi é Å é",{font=font,color="#96C2EB88"})
    K.Text("space: X\\tY Z W 🙂",{font=font})
    K.Text("Один материал для всех размеров",{font=font,modifier=K.M:width(175),max_lines=2,ellipsis=true})
    K.Text("Agj",{font=font,modifier=K.M:offset(0.75,0.35)})
   end)
  end)
 end
 K.preview(name,{width=width,height=height,padding=0},content)
 cases[#cases+1]={name=name,width=width,height=height,content=content}
end
CALLS
return cases
'''.replace('ENTRIES', ','.join(entries)).replace('CALLS','\n'.join(f'add("{c["name"]}","{c["resource"]}",{c["size"]})' for c in cases))
    (pack / 'modules/cases.lua').write_text(source)
    user = work / 'game'
    (user / 'content').mkdir(parents=True)
    for name in ['kompot','parity']:
        (user / 'content' / name).symlink_to(fixture_content / name, target_is_directory=True)
    game_log = args.out / 'game.log'
    with game_log.open('w') as log:
        subprocess.run([str(args.engine),'--dir',str(user),'--test',str(content / 'kompot/tests/visual/font_parity.lua')],
                       stdout=log,stderr=subprocess.STDOUT,check=True,timeout=180)
    native = args.out / 'game'
    preview = args.out / 'preview'
    shutil.copytree(user / 'export',native,dirs_exist_ok=True)
    env = dict(os.environ, KOMPOT_CONTENT=str(fixture_content),KOMPOT_SNAPSHOTS=str(preview),KOMPOT_TEST_ENTRY='font-parity')
    subprocess.run(['node','out/scripts/run-extension-tests.js'],cwd=root,env=env,check=True,timeout=180)
    reports = []
    for case in cases:
        name = case['name']
        game_doc = json.loads((native / (name+'.json')).read_text())
        preview_doc = json.loads((preview / (name+'.json')).read_text())
        def layout(doc):
            return [[p.get(k) for k in ['text','x','y','w','h','font','font_size','advances']] for p in doc['prims'] if p['kind']=='text']
        a = np.array(Image.open(native / (name+'.png')).convert('RGB')).astype(int)
        b = np.array(Image.open(preview / (name+'.png')).convert('RGB')).astype(int)
        difference = np.abs(a-b)
        bad = np.any(difference>args.tolerance,axis=2)
        exact = np.any(difference>0,axis=2)
        result = dict(case, layout_equal=layout(game_doc)==layout(preview_doc),different_pixels=int(exact.sum()),
                      pixels_above_tolerance=int(bad.sum()),max_channel_difference=int(difference.max()))
        reports.append(result)
        if bad.any():
            Image.fromarray(np.minimum(difference*4,255).astype('uint8')).save(args.out / (name+'-diff.png'))
        print(name,Path(case['font']).name,'layout',result['layout_equal'],'bad pixels',result['pixels_above_tolerance'],'max',result['max_channel_difference'])
    (args.out / 'report.json').write_text(json.dumps(reports,indent=2))
    failures = [r for r in reports if not r['layout_equal'] or r['pixels_above_tolerance']]
    print(f'{len(reports)-len(failures)}/{len(reports)} cases within {args.tolerance}/255; report: {args.out / "report.json"}')
    raise SystemExit(bool(failures))
