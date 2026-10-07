// Интеграционные тесты в VS Code: превью (с PNG-снимками webview),
// обновление после сохранения, интерактивный режим, дополнение, наведение, CodeLens.
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

const CONTENT = process.env.KOMPOT_CONTENT!;
const SNAPSHOTS = process.env.KOMPOT_SNAPSHOTS;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
    return Promise.race([p, sleep(ms).then(() => { throw new Error('timeout: ' + what); })]) as Promise<T>;
}

async function waitForCount(preview: any, expected: number): Promise<void> {
    const until = Date.now() + 20000;
    while (Date.now() < until) {
        const count = await withTimeout(preview.waitRendered(), until - Date.now(), 'render count ' + expected);
        if (count === expected) return;
    }
    throw new Error('timeout: render count ' + expected);
}

export async function run(): Promise<void> {
    const results: string[] = [];
    const check = async (name: string, fn: () => Promise<void>) => {
        try {
            await fn();
            results.push('ok   ' + name);
        } catch (e) {
            results.push('FAIL ' + name + ': ' + ((e as Error).stack || e));
        }
    };

    const ext = vscode.extensions.getExtension('BooleanFalse.kompot-lens')!;
    assert.ok(ext, 'extension found');
    const api = await ext.activate();

    await check('TTF fonts measure layout before drawing and stay at 16 px', async () => {
        const file = path.join(CONTENT, 'kompot/modules/_lens_font_check.lua');
        fs.writeFileSync(file, `local K = require "kompot:kompot"
local UI = require "kompot:ui"
K.preview("Font check", {width=400,height=120}, function()
    local n = K.state(0)
    K.Column(function()
        UI.Button({text="Следующий кадр", on_click=function() n.value=n:peek()+1 end})
        K.Text("Wi " .. n.value, {font="kompot_16"})
    end)
end)`);
        try {
            const doc = await vscode.workspace.openTextDocument(file);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            const rendered = api.preview.waitRendered();
            await vscode.commands.executeCommand('kompot.openPreview');
            assert.equal(await withTimeout(rendered, 20000, 'TTF render'), 1);
            assert.ok(api.preview.rasterFontCount > 0, 'FreeType loaded and fonts rasterized: ' + api.preview.rasterError);
            api.preview.interactive('Font check');
            for (let i = 0; i < 60 && api.preview.lastDoc?.name !== 'Font check'; i++) await sleep(100);
            const frame = api.preview.lastDoc;
            assert.equal(frame?.name, 'Font check');
            const label = frame.prims.find((p: any) => p.text === 'Следующий кадр');
            assert.equal(label.font_size, 16);
            assert.equal(label.h, 24);
            assert.equal(label.advances[9], 8, 'space uses half the font size');
            assert.equal(label.font_metrics, 'measured');
            assert.ok(new Set(label.advances).size > 3, 'different widths for proportional glyphs');
            assert.deepEqual(frame.font_requests, [], 'all used glyphs measured before interactive frame');
            const button = frame.prims.find((p: any) => p.kind === 'nine_patch');
            assert.equal(button.h, 36);
            assert.equal(button.w, label.advances.reduce((a: number, b: number) => a + b, 0) + 28);
            assert.equal(button.w, 163, 'matches native FreeType measurement in VoxelCore');
            await sleep(250);
            const images = await withTimeout(api.preview.snapshot(), 10000, 'font snapshot') as Record<string,string>;
            if (SNAPSHOTS) {
                fs.mkdirSync(SNAPSHOTS, {recursive:true});
                fs.writeFileSync(path.join(SNAPSHOTS, 'Font_check.png'), Buffer.from(images['Font check'].split(',')[1], 'base64'));
            }
            api.preview.interactive(null);
        } finally { fs.unlinkSync(file); }
    });

    await check('padding/background order keeps both surfaces in a sufficiently tall preview', async () => {
        const file = path.join(CONTENT, 'kompot/modules/_lens_order_check.lua');
        fs.writeFileSync(file, `local K = require "kompot:kompot"
local UI = require "kompot:ui"
local M = K.M
K.preview("Padding order", {width=360,height=260,theme=UI.theme}, function()
    K.Column({modifier=M:fill_max_width(),spacing=12}, function()
        K.Text("background -> padding")
        K.Box({modifier=M:background("#386F94"):padding(20)},function() K.Text("Внутренний отступ") end)
        K.Text("padding -> background")
        K.Box({modifier=M:padding(20):background("#386F94")},function() K.Text("Внешний отступ") end)
    end)
end)`);
        try {
            const doc = await vscode.workspace.openTextDocument(file);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            const rendered = api.preview.waitRendered();
            await vscode.commands.executeCommand('kompot.openPreview');
            assert.equal(await withTimeout(rendered, 20000, 'padding render'), 1);
            api.preview.interactive('Padding order');
            for (let i=0; i<60 && api.preview.lastDoc?.name !== 'Padding order'; i++) await sleep(100);
            const frame = api.preview.lastDoc;
            assert.equal(frame?.name, 'Padding order');
            const backgrounds = frame.prims.filter((p:any) => p.kind === 'rect' && p.color === '#386F94FF');
            assert.deepEqual(backgrounds.map((p:any) => p.h), [64,24]);
            const second = frame.prims.find((p:any) => p.text === 'Внешний отступ');
            assert.equal(backgrounds[1].w, second.w);
            assert.equal(backgrounds[1].y, second.y);
            await sleep(250);
            const images = await withTimeout(api.preview.snapshot(), 10000, 'padding snapshot') as Record<string,string>;
            if (SNAPSHOTS) {
                fs.mkdirSync(SNAPSHOTS, {recursive:true});
                fs.writeFileSync(path.join(SNAPSHOTS, 'Padding_order.png'), Buffer.from(images['Padding order'].split(',')[1], 'base64'));
            }
            api.preview.interactive(null);
        } finally { fs.unlinkSync(file); }
    });

    await check('narrow raster panel uses the engine font and source pixels', async () => {
        const file=path.join(CONTENT,'kompot/modules/_lens_material_check.lua');
        fs.writeFileSync(file, `local K=require "kompot:kompot"
local UI=require "kompot:ui"
K.preview("Material reference",{width=120,height=120,padding=0,theme=UI.theme},function()
 local material=K.remember(function()
  return K.nine_patch(K.raster({width=16,height=16,key="test:material",draw=function(cv)
   cv:clear(50,65,50,255)
   cv:rect(0,0,16,2,100,120,85,255)
   cv:rect(0,2,2,12,100,120,85,255)
   cv:rect(0,14,16,2,20,30,20,255)
   cv:rect(14,2,2,12,20,30,20,255)
   cv:rect(4,4,2,2,65,80,60,255)
  end}),{border=2,center="tile",scale=2})
 end)
 K.Box({modifier=K.M:size(120,120):background_image(material):padding(12)},function()
  K.Text("Один материал для всех размеров")
 end)
end)`);
        try {
            const doc=await vscode.workspace.openTextDocument(file);
            await vscode.window.showTextDocument(doc,vscode.ViewColumn.One);
            const rendered=api.preview.waitRendered();
            await vscode.commands.executeCommand('kompot.openPreview');
            assert.equal(await withTimeout(rendered,20000,'material render'),1);
            api.preview.interactive('Material reference');
            for(let i=0;i<60 && api.preview.lastDoc?.name!=='Material reference';i++) await sleep(100);
            const frame=api.preview.lastDoc;
            assert.equal(frame?.name,'Material reference');
            const texts=frame.prims.filter((p:any)=>p.kind==='text');
            assert.deepEqual(texts.map((p:any)=>[p.text,p.x,p.y,p.w,p.h]),
                [['Один',12,12,39,24],['материал',12,36,73,24],['для всех',12,60,70,24],['размеров',12,84,73,24]]);
            await sleep(250);
            const images=await withTimeout(api.preview.snapshot(),10000,'material bitmap') as Record<string,string>;
            if(SNAPSHOTS){fs.mkdirSync(SNAPSHOTS,{recursive:true});fs.writeFileSync(path.join(SNAPSHOTS,'Material_reference.png'),Buffer.from(images['Material reference'].split(',')[1],'base64'));}
            api.preview.interactive(null);
        } finally {fs.unlinkSync(file);}
    });

    // --- превью Kompot, снимки PNG ---
    const files = [
        'kompot/modules/ui/previews.lua',
    ];
    if (fs.existsSync(path.join(CONTENT, 'kompot_material/modules/material/previews.lua'))) {
        files.push('kompot_material/modules/material/previews.lua');
    }
    for (const rel of files) {
        await check('preview ' + rel, async () => {
            const doc = await vscode.workspace.openTextDocument(path.join(CONTENT, rel));
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            const rendered = api.preview.waitRendered();
            await vscode.commands.executeCommand('kompot.openPreview');
            const count = await withTimeout(rendered, 20000, "render " + rel) as number;
            assert.ok(count > 0, 'previews rendered: ' + count);
            assert.equal(api.preview.isOpen, true, 'preview view is visible');
            assert.equal(vscode.window.tabGroups.all.some(g => g.tabs.some(t => t.input instanceof vscode.TabInputWebview)),
                false, 'preview does not create an editor tab');
            await sleep(500);
            const images = await withTimeout(api.preview.snapshot(), 10000, 'snapshot') as Record<string, string>;
            assert.equal(Object.keys(images).length, count);
            if (rel === files[0]) {
                await check('refresh keeps scroll position', async () => {
                    const bottom = await withTimeout(api.preview.scroll(Number.MAX_SAFE_INTEGER), 10000, 'scroll to bottom') as {top: number; max: number};
                    assert.ok(bottom.max > 100, 'Kompot previews need a scrollbar');
                    assert.ok(bottom.top > 100, 'scroll reached lower previews');
                    const refreshed = api.preview.waitRendered();
                    await vscode.commands.executeCommand('kompot.refresh');
                    await withTimeout(refreshed, 20000, 'refreshed preview');
                    const after = await withTimeout(api.preview.scroll(), 10000, 'scroll position after refresh') as {top: number; max: number};
                    assert.ok(after.top > 100, `scroll reset to ${after.top}`);
                    assert.ok(Math.abs(after.top - bottom.top) < 50, `scroll shifted ${bottom.top} -> ${after.top}`);
                });
            }
            if (SNAPSHOTS) {
                fs.mkdirSync(SNAPSHOTS, {recursive: true});
                for (const [name, url] of Object.entries(images)) {
                    fs.writeFileSync(path.join(SNAPSHOTS, name.replace(/[^\wА-Яа-яЁё]+/g, '_') + '.png'),
                        Buffer.from(url.split(',')[1], 'base64'));
                }
            }
        });
    }

    // --- снимок окна VS Code с панелью (Hyprland + grim, только это окно) ---
    const shot = async (file: string) => {
        if (!process.env.KOMPOT_WINDOW_SHOT) return;
        await sleep(800);
        const {execSync} = require('node:child_process');
        try {
            const clients = JSON.parse(execSync('hyprctl clients -j', {encoding: 'utf8'}));
            const w = clients.find((c: any) => /Extension Development Host/.test(c.title));
            if (w) execSync(`grim -g "${w.at[0]},${w.at[1]} ${w.size[0]}x${w.size[1]}" "${path.join(process.env.KOMPOT_WINDOW_SHOT!, file)}"`);
        } catch (e) {
            console.log('window shot failed: ' + e);
        }
    };
    await shot('window_contour.png');

    // --- обновление после сохранения: несохранённый текст не запускается ---
    const scratchFile = path.join(CONTENT, 'kompot', 'modules', 'ui', '_studio_test.lua');
    fs.writeFileSync(scratchFile, [
        'local K = require "kompot:kompot"',
        'local UI = require "kompot:ui"',
        'local M = K.M',
        '',
        'K.preview("Тест: кнопка", {width = 200, height = 60, theme = UI.theme()}, function()',
        '    UI.Button({text = "Нажми", variant = "primary"})',
        'end)',
        '',
    ].join('\n'));
    try {
        const doc = await vscode.workspace.openTextDocument(scratchFile);
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

        await check('preview updates on save, not while typing', async () => {
            let rendered = api.preview.waitRendered();
            await vscode.commands.executeCommand('kompot.openPreview');
            assert.equal(await withTimeout(rendered, 20000, 'first render'), 1);
            assert.equal(vscode.window.activeTextEditor?.document.uri.fsPath, scratchFile, 'source stays in the editor');
            await editor.edit(b => b.insert(new vscode.Position(8, 0),
                'K.preview("Тест: флажок", {width = 200, height = 40, theme = UI.theme()}, function()\n    UI.Checkbox({checked = true, label = "Да"})\nend)\n'));
            assert.ok(doc.isDirty, 'change is not saved');
            await sleep(450);
            assert.equal(Object.keys(await withTimeout(api.preview.snapshot(), 10000, 'unsaved snapshot')).length, 1);
            const updated = waitForCount(api.preview, 2);
            assert.equal(await doc.save(), true, 'save succeeded');
            await updated;
        });

        await check('interactive preview reacts to the pointer', async () => {
            api.preview.interactive('Тест: кнопка');
            for (let i = 0; i < 40 && api.preview.frames === 0; i++) await sleep(100);
            assert.ok(api.preview.frames > 0, 'first frame');
            // кнопка в левом верхнем углу (отступ превью 16)
            api.preview.input('Тест: кнопка', 40, 28, false);
            for (let i = 0; i < 40 && api.preview.lastDoc?.cursor !== 'pointer'; i++) await sleep(100);
            assert.equal(api.preview.lastDoc?.cursor, 'pointer', 'hover over the button');
            await shot('window_interactive.png');
            api.preview.input('Тест: кнопка', 190, 55, false);
            for (let i = 0; i < 40 && api.preview.lastDoc?.cursor === 'pointer'; i++) await sleep(100);
            assert.notEqual(api.preview.lastDoc?.cursor, 'pointer', 'pointer left the button');
            api.preview.interactive(null);
        });

        await check('completion: components, props, values, modifiers', async () => {
            const completeItems = async (code: string, trigger?: string) => {
                const end = new vscode.Position(doc.lineCount, 0);
                await editor.edit(b => b.insert(end, '\n' + code));
                const last = doc.lineAt(doc.lineCount - 1);
                const list = await vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider', doc.uri, last.range.end, trigger);
                await editor.edit(b => b.delete(new vscode.Range(end, doc.lineAt(doc.lineCount - 1).range.end)));
                return list.items;
            };
            const complete = async (code: string) => (await completeItems(code)).map(i =>
                typeof i.label === 'string' ? i.label : i.label.label);
            const duplicateLabels = (labels: string[]) => labels.filter((name, i) => labels.indexOf(name) < i);
            const uiMembers = await complete('UI.');
            assert.ok(uiMembers.includes('ToolButton'), 'UI.');
            assert.deepEqual(duplicateLabels(uiMembers), [], `duplicate UI members: ${uiMembers.join(', ')}`);
            const portableUi = await complete('local Widgets = K.ui(); Widgets.');
            assert.deepEqual(duplicateLabels(portableUi), [], `duplicate K.ui() members: ${portableUi.join(', ')}`);
            const columns = await complete('K.');
            assert.deepEqual(duplicateLabels(columns), [], `duplicate K members: ${columns.join(', ')}`);
            assert.equal(columns.filter(label => label === 'Column').length, 1, 'LuaLS Column');
            assert.equal(columns.filter(label => label === 'Column (блок)').length, 1, 'Lens Column block');
            const props = await complete('UI.Button({');
            assert.ok(props.some(label => label === 'variant' || label === 'variant?'), `props: ${props.join(', ')}`);
            const variants = await complete('UI.Button({variant = "');
            assert.ok(variants.includes('"danger"'), `enum values: ${variants.join(', ')}`);
            const equalsItems = await completeItems('UI.Button({variant =', '=');
            const primary = equalsItems.find(i => i.label === 'primary' || i.label === '"primary"');
            assert.ok(primary, `enum at equals: ${equalsItems.map(i => i.label).join(', ')}`);
            assert.ok((await complete('UI.Button({enabled =')).includes('true'), 'boolean values');
            const modifierStart = await complete('UI.Button({modifier = ');
            assert.equal(modifierStart.filter(label => label === 'M:').length, 1, 'modifier chain snippet');
            const afterQuote = 'local s = "it\'s"; UI.Bu';
            const tool = (await completeItems(afterQuote)).find(i => i.label === 'Button');
            assert.ok(tool, 'completion after quoted text');
            assert.ok((await complete('K.Box({modifier = M:padding(4):')).includes('block_pointer'), 'modifiers');
            assert.ok((await complete('K.Icon("')).includes('rocket'), 'icons');
        });

        await check('hover and definition', async () => {
            const text = doc.getText();
            const p = doc.positionAt(text.indexOf('Button') + 2);
            const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', doc.uri, p);
            const md = hovers.map(h => h.contents.map(c => (c as vscode.MarkdownString).value).join('\n')).join('\n');
            assert.match(md, /KompotUiApi\.Button/);
            assert.equal(hovers.length, 1, `duplicate hovers: ${hovers.map(h => h.contents.map(c => (c as vscode.MarkdownString).value).join(' | ')).join(' / ')}`);
            const defs = await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', doc.uri, p);
            const locations = defs.map(d => d instanceof vscode.Location ? d.uri.fsPath : (d as vscode.LocationLink).targetUri.fsPath);
            assert.equal(locations.filter(file => file.endsWith('components/buttons.lua')).length, 1,
                `Kompot implementation definition: ${locations.join(', ')}`);
        });

        await check('preview errors become diagnostics', async () => {
            const rendered = api.preview.waitRendered();
            await editor.edit(b => b.insert(new vscode.Position(doc.lineCount, 0),
                '\nK.preview("Тест: ошибка", {width = 100, height = 40, theme = UI.theme()}, function()\n    local t = nil\n    K.Text(t.x)\nend)\n'));
            await doc.save();
            await withTimeout(rendered, 20000, 'render with error');
            await sleep(200);
            const diags = vscode.languages.getDiagnostics(doc.uri).filter(d => d.source === 'Kompot');
            assert.ok(diags.length >= 1, 'diagnostic');
            const line = doc.getText().split('\n').findIndex(l => l.includes('K.Text(t.x)'));
            assert.equal(diags[0].range.start.line, line, 'points at the failing line');
            assert.match(diags[0].message, /Тест: ошибка/);
        });

        await check('color swatches for K.hex', async () => {
            await editor.edit(b => b.insert(new vscode.Position(doc.lineCount, 0), '\nlocal accent = K.hex("#FF8000")\n'));
            const colors = await vscode.commands.executeCommand<vscode.ColorInformation[]>('vscode.executeDocumentColorProvider', doc.uri);
            assert.ok(colors.some(c => Math.abs(c.color.red - 1) < 0.01 && Math.abs(c.color.green - 0.502) < 0.01));
        });

        await check('code lens above previews', async () => {
            const lenses = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', doc.uri);
            assert.ok(lenses.length >= 1 && lenses[0].command?.command === 'kompot.openPreview');
        });

        await check('syntax error keeps the last successful preview', async () => {
            const before = await withTimeout(api.preview.snapshot(), 10000, 'previous preview') as Record<string, string>;
            const rendered = api.preview.waitRendered();
            await editor.edit(b => b.insert(new vscode.Position(doc.lineCount, 0), '\nK.preview(\n'));
            await doc.save();
            await withTimeout(rendered, 20000, 'syntax error render');
            const after = await withTimeout(api.preview.snapshot(), 10000, 'retained preview') as Record<string, string>;
            assert.deepEqual(Object.keys(after), Object.keys(before));
        });

        await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    } finally {
        fs.rmSync(scratchFile, {force: true});
    }

    const report = results.join('\n');
    console.log('\n' + report + '\n');
    if (process.env.KOMPOT_REPORT) fs.writeFileSync(process.env.KOMPOT_REPORT, report + '\n');
    if (results.some(r => r.startsWith('FAIL'))) throw new Error('Kompot Lens tests failed:\n' + report);
}
