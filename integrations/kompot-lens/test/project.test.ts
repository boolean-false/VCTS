import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {findContent, findPack, moduleName, usesKompot, findTexture, listImageSources} from '../src/project';
import {runHost, Session} from '../src/host';

const content = process.env.KOMPOT_CONTENT || path.resolve(__dirname, '../../../game/content');
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kompot-project-'));
    const pack = path.join(root, 'my_mod');
    fs.mkdirSync(path.join(pack, 'modules'), {recursive: true});
    fs.writeFileSync(path.join(pack, 'package.json'), JSON.stringify({id: 'my_mod', dependencies: ['kompot']}));
    return {root, pack, file: path.join(pack, 'modules', 'main.lua'), cleanup: () => fs.rmSync(root, {recursive:true,force:true})};
}
test('dependency enables a standalone pack and containing workspace before Kompot is installed', () => {
    const f = fixture();
    try {
        assert.equal(usesKompot(f.pack), true);
        assert.equal(usesKompot(f.root), true);
        assert.equal(findContent(f.file), null);
        assert.deepEqual(findPack(f.file), {root:f.pack,id:'my_mod'});
        assert.equal(moduleName(f.file, content), 'my_mod:main');
        assert.equal(moduleName(path.join(f.pack, 'outside.lua'), content), null);
        fs.writeFileSync(path.join(f.pack, 'package.json'), JSON.stringify({id:'my_mod',dependencies:[]}));
        assert.equal(usesKompot(f.root), false);
    } finally { f.cleanup(); }
});
test('Kompot installed beside a pack is detected without configuration', () => {
    const f = fixture();
    try {
        fs.mkdirSync(path.join(f.root,'kompot'));
        fs.writeFileSync(path.join(f.root,'kompot/package.json'), '{"id":"kompot"}');
        assert.equal(findContent(f.file), f.root);
    } finally { f.cleanup(); }
});
test('bundled Lua renders an external pack with an empty PATH and reads UTF-8 source', async () => {
    const f = fixture(); const previous = process.env.PATH;
    try {
        fs.writeFileSync(f.file, `local K = require 'kompot:kompot'
K.preview('Без Lua', {width=120,height=40}, function() K.Text('Привет') end)`);
        process.env.PATH = '';
        const result = await runHost('render', content, ['my_mod:main'], [], [], {projectFile:f.file});
        assert.equal(result.ok, true, result.error);
        assert.equal(result.previews[0].name, 'Без Lua');
        assert.ok(result.previews[0].prims.some(p=>p.text==='Привет'));
    } finally { process.env.PATH=previous; f.cleanup(); }
});
test('bundled interactive Lua exchanges multiple frames without PATH', async () => {
    const f = fixture(); const previous = process.env.PATH; let session: Session;
    try {
        fs.writeFileSync(f.file, `local K = require 'kompot:kompot'
K.preview('Frames', {width=120,height=40}, function() K.Text('Hello') end)`);
        process.env.PATH='';
        session=new Session(content,['my_mod:main'],'Frames',[],{projectFile:f.file});
        await new Promise<void>((resolve,reject)=>{
            const timer=setTimeout(()=>reject(new Error('session timeout')),5000); let count=0;
            session.onExit=error=>{if(error){clearTimeout(timer);reject(new Error(error));}};
            session.onDocument=doc=>{
                assert.equal(doc.name,'Frames');
                if(++count===3){clearTimeout(timer);resolve();}
                else session.frame(.1,-1,-1,false,false,0);
            };
        });
    } finally { session?.dispose(); process.env.PATH=previous; f.cleanup(); }
});

test('atlas entries and texture paths resolve from packs and engine resources', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kompot-images-'));
    try {
        const content = path.join(root, 'content');
        const res = path.join(root, 'res');
        const file = path.join(content, 'pack', 'textures', 'icons', 'add.png');
        const engine = path.join(res, 'textures', 'gui', 'panel.png');
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.mkdirSync(path.dirname(engine), {recursive: true});
        fs.writeFileSync(file, '');
        fs.writeFileSync(engine, '');
        assert.equal(findTexture('icons:add', content, res), file);
        assert.equal(findTexture('icons/add', content, res), file);
        assert.equal(findTexture('gui/panel', content, res), engine);
        assert.equal(findTexture('../secret', content, res), null);
        const names = listImageSources(content, res).map(x => x.name);
        assert.ok(names.includes('icons:add') && names.includes('icons/add') && names.includes('gui/panel'));
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

test('npm project named kompot is not mistaken for a content pack',()=>{
 const f=fixture();try{fs.mkdirSync(path.join(f.root,'kompot'));fs.writeFileSync(path.join(f.root,'kompot/package.json'),'{"name":"kompot-ts-example","private":true}');assert.equal(findContent(f.file),null);}finally{f.cleanup();}
});
