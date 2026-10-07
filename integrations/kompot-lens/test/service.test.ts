// Языковой сервис на настоящих паках (нужны каталог content с kompot и Lua).
import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {Service} from '../src/service';
import {Catalogs} from '../src/catalog';
import {runHost, findLua} from '../src/host';

const CONTENT = process.env.KOMPOT_CONTENT || path.resolve(__dirname, '../../../game/content');
const skip = !fs.existsSync(path.join(CONTENT, 'kompot', 'package.json')) || !findLua() ? 'нет паков Kompot или Lua' : false;
const hasMaterial = fs.existsSync(path.join(CONTENT, 'kompot_material', 'package.json'));
const FILE = path.join(CONTENT, 'kompot', 'modules', 'studio_test.lua');

const HEAD = `local K = require "kompot:kompot"
local UI = require "kompot:ui"
local MD = require "kompot_material:material"
local M = K.M
local Widgets = K.ui()
local c = K.theme().colors
`;

function service() {
    const catalogs = new Catalogs((content, modules) => runHost('introspect', content, modules, [], []));
    return new Service(catalogs);
}

async function complete(s: Service, code: string) {
    const text = HEAD + code;
    return s.complete(FILE, text, text.length);
}

test('members of a design system module', {skip}, async () => {
    const s = service();
    const items = await complete(s, 'UI.');
    const button = items.find(i => i.label === 'Button')!;
    assert.ok(button, 'UI.Button');
    assert.equal(button.kind, 'component');
    assert.equal(button.insert, 'Button({$1})$0');
    assert.match(button.doc!, /UI\.Button\(/);
    assert.ok(button.doc!.includes('При нажатии'), 'documentation read from the current Kompot source');
    assert.ok(items.some(i => i.label === 'ToolButton'));
    assert.deepEqual(await complete(s, 'UI.ACCENTS.'), [], 'removed built-in accent presets');
    const k = await complete(s, 'K.');
    assert.ok(k.some(i => i.label === 'poll' && /getter/.test(i.detail!)), 'K.poll with signature');
    assert.ok(k.some(i => i.label === 'Box'));
});

test('LuaLS owns static Kompot members while Lens keeps project values and block snippets', {skip}, async () => {
    const s = new Service(new Catalogs((content, modules) => runHost('introspect', content, modules, [], [])), () => ({}), true);
    const k = await complete(s, 'K.');
    assert.equal(k.find(i => i.label === 'Column (блок)')?.insert, 'Column({$1}, function()\n\t$0\nend)');
    assert.ok(!k.some(i => i.label === 'poll'), 'LuaLS provides static functions');
    assert.deepEqual(await complete(s, 'K.M:'), [], 'LuaLS provides modifier methods');
    assert.deepEqual(await complete(s, 'K.Column({'), [], 'LuaLS provides typed properties');
    assert.deepEqual(await complete(s, 'UI.'), [], 'LuaLS provides built-in UI members');
    assert.deepEqual(await complete(s, 'Widgets.Button({'), [], 'LuaLS provides portable UI properties');
    assert.ok(!(await complete(s, 'Widgets.')).some(i => i.label === 'Button'), 'LuaLS provides portable UI members');
    const hoverText = HEAD + 'UI.Button({text = "OK"})\nWidgets.Button({text = "OK"})';
    assert.equal(await s.hover(FILE, hoverText, hoverText.indexOf('UI.Button') + 5), null,
        'LuaLS provides built-in hover');
    assert.equal(await s.signature(FILE, HEAD + 'UI.Button(', (HEAD + 'UI.Button(').length), null,
        'LuaLS provides built-in signature');
    const colors = await complete(s, 'K.Text("x", {color = ');
    assert.ok(colors.some(i => i.kind === 'color'), 'theme colors remain project-aware');
    const modules = await complete(s, 'require "kompot:');
    assert.ok(modules.some(i => i.label === 'kompot:kompot'), 'pack modules remain project-aware');
});

test('modifier chains', {skip}, async () => {
    const s = service();
    for (const code of ['M:', 'K.Box({modifier = M:padding(8):', '(props.modifier or M):height(26):', 'K.M:']) {
        const items = await complete(s, code);
        assert.ok(items.some(i => i.label === 'background' && i.kind === 'method'), code);
        assert.ok(items.some(i => i.label === 'block_pointer'), code);
    }
    const bg = (await complete(s, 'M:')).find(i => i.label === 'background')!;
    assert.equal(bg.insert, 'background(${1:c}, ${2:shape})$0');
    assert.ok((await complete(s, 'M:')).some(i => i.label === 'focusable'), 'keyboard focus modifier');
});

test('core containers insert a body and offer Column layout properties', {skip}, async () => {
    const s = service();
    const text = 'local K = require "kompot:kompot"\n';
    const member = await s.complete(FILE, text + 'K.', (text + 'K.').length);
    for (const name of ['Box', 'Row', 'Column', 'FlowRow']) {
        assert.equal(member.find(i => i.label === name)?.insert, `${name}({$1}, function()\n\t$0\nend)`);
    }
    const props = await s.complete(FILE, text + 'K.Column({', (text + 'K.Column({').length);
    assert.ok(props.some(i => i.label === 'spacing'));
    assert.ok(props.some(i => i.label === 'arrangement'));
    const arrangement = await s.complete(FILE, text + 'K.Column({arrangement = "', (text + 'K.Column({arrangement = "').length);
    assert.ok(arrangement.some(i => i.label === 'between'));
});

test('props, enum values, styles, icons, colors', {skip}, async () => {
    const s = service();
    const props = await complete(s, 'K.Text("OK", {');
    assert.ok(props.some(i => i.label === 'style'));
    if (hasMaterial) {
        const md = await complete(s, 'MD.Button({');
        assert.ok(md.some(i => i.label === 'trailing_icon'), 'Material props');
    }
    const styles = await complete(s, 'K.Text("x", {style = "');
    assert.ok(styles.some(i => i.label === 'strong'), 'Kompot UI style');
    if (hasMaterial) assert.ok(styles.some(i => i.label === 'title_md'), 'Material style');
    const icons = await complete(s, 'K.Icon("');
    assert.ok(icons.some(i => i.label === 'add' && i.image && i.image.endsWith('add.png')));
    const image = await complete(s, 'K.Image("');
    assert.ok(image.some(i => i.label === 'kompot_ui_icons:add' && i.image?.endsWith('add.png')));
    const skins = await complete(s, 'K.nine_patch("');
    assert.ok(skins.some(i => i.label === 'kompot_ui_skin:panel' && i.image?.endsWith('panel.png')));
    const fits = await complete(s, 'K.Image("kompot_ui_icons:add", {fit = "');
    assert.deepEqual(fits.map(i => i.label), ['fill', 'contain', 'cover']);
    const previewFits = await complete(s, 'UI.Preview({fit = "');
    assert.deepEqual(previewFits.map(i => i.label), ['fill', 'contain', 'cover']);
    const iconProp = await complete(s, 'UI.Button({icon = "');
    assert.ok(iconProp.some(i => i.label === 'check'));
    assert.deepEqual(await complete(s, 'UI.Panel({accent = "'), []);
    const accent = await complete(s, 'UI.Panel({accent = ');
    assert.ok(accent.some(i => i.label === 'brand' && i.color));
    const colors = await complete(s, 'c.');
    assert.ok(colors.some(i => i.label === 'panel_bg'));
    if (hasMaterial) assert.ok(colors.some(i => i.label === 'primary_container'));
    const colors2 = await complete(s, 'K.theme().colors.');
    assert.ok(colors2.some(i => i.label === 'on_surface'));
    const kompotColors = await complete(s, 'UI.theme().colors.');
    assert.ok(kompotColors.some(i => i.label === 'panel_bg'));
    assert.ok(!kompotColors.some(i => i.label === 'inverse_primary'));
    if (hasMaterial) {
        const materialColors = await complete(s, 'MD.theme().colors.');
        assert.ok(materialColors.some(i => i.label === 'inverse_primary'));
        assert.ok(!materialColors.some(i => i.label === 'panel_bg'));
    }
    const ui = await complete(s, 'Widgets.');
    assert.ok(ui.some(i => i.label === 'Segmented') && ui.some(i => i.label === 'Panel'));
    const uiProps = await complete(s, 'Widgets.Segmented({');
    assert.ok(uiProps.some(i => i.label === 'options'));
    const req = await complete(s, 'local X = require "kompot:');
    assert.ok(req.some(i => i.label === 'kompot:ui'));
});

test('value expressions provide usable Kompot snippets', {skip}, async () => {
    const s = service();
    const booleans = await complete(s, 'UI.Button({enabled = ');
    assert.deepEqual(booleans.map(i => i.label), []);
    const modifier = await complete(s, 'UI.Button({modifier = ');
    assert.equal(modifier[0]?.label, 'M:');
    assert.equal(modifier[0]?.insert, 'M:');
    assert.equal(modifier[0]?.filter, 'M');
    assert.equal(modifier[0]?.preselect, true);
    const color = await complete(s, 'K.Text("x", {color = ');
    assert.equal(color.find(i => i.label === 'on_surface')?.insert, 'K.theme().colors.on_surface');
    assert.ok(color.find(i => i.label === 'on_surface')?.color);
    const icon = await complete(s, 'UI.Button({icon = ');
    assert.equal(icon.find(i => i.label === 'check')?.insert, '"check"');
    const accent = await complete(s, 'UI.Panel({accent = ');
    assert.equal(accent.find(i => i.label === 'brand')?.insert, 'K.theme().colors.brand');
});

test('completion ignores unrelated APIs and aliases after the cursor', {skip}, async () => {
    const s = service();
    assert.deepEqual(await complete(s, 'obj:padding(8):'), []);
    assert.deepEqual(await complete(s, 'obj.Icon("'), []);
    assert.deepEqual(await complete(s, 'obj.colors.'), []);
    assert.deepEqual(await complete(s, 'UI.Button({style = "'), []);
    const text = 'UI.Bu\nlocal UI = require "kompot:ui"';
    assert.deepEqual(await s.complete(FILE, text, 'UI.Bu'.length), []);
    assert.equal(await s.hover(FILE, HEAD + 'obj:padding(8)', (HEAD + 'obj:padding(8)').indexOf('padding') + 2), null);
    const foreignChain = HEAD + 'obj:padding(8):background(c)';
    assert.equal(await s.hover(FILE, foreignChain, foreignChain.lastIndexOf('background') + 2), null);
    const onlyKompotUI = 'local UI = require "kompot:ui"\nUI.Button({';
    const props = await s.complete(FILE, onlyKompotUI, onlyKompotUI.length);
    assert.equal(props.find(i => i.label === 'modifier')?.insert, 'modifier = $0');
});

test('hover, signature help and definition', {skip}, async () => {
    const s = service();
    const text = HEAD + 'UI.Button({text = "OK"})\nK.Box({modifier = M:padding(8)})';
    const hover = await s.hover(FILE, text, text.indexOf('Button') + 2);
    assert.match(hover!, /UI\.Button\(p, content\)/);
    assert.ok(hover!.includes('При нажатии'), 'hover contains the current component documentation');
    const def = await s.definition(FILE, text, text.indexOf('Button') + 2);
    assert.ok(def && def.file.endsWith('components/buttons.lua') && def.line > 1);
    const sig = await s.signature(FILE, text.slice(0, text.lastIndexOf('8)') + 1) + ', ', text.lastIndexOf('8)') + 3);
    assert.equal(sig!.label, 'M:padding(a, b, c, d)');
    assert.equal(sig!.active, 1);
    const mhover = await s.hover(FILE, text, text.lastIndexOf('padding') + 2);
    assert.match(mhover!, /padding/);
    const chain = HEAD + 'M:padding(8):background("#123456")';
    assert.match((await s.hover(FILE, chain, chain.lastIndexOf('background') + 2))!, /background/);
});

test('shared Shape constructors are discovered by the language service', {skip}, async () => {
    const items=await complete(service(),'K.Shape.');
    for(const name of ['rectangle','circle','rounded','cut','px','percent']) {
        assert.ok(items.some(i=>i.label===name),name);
    }
});
