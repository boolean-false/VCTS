// First-install workflow: no Lua, no Kompot, user LuaLS config, then dependency/pack changes.
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {parse} from 'jsonc-parser';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(check: () => boolean | Promise<boolean>, what: string) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) { if (await check()) return; await sleep(250); }
    throw new Error('timeout: ' + what);
}
export async function run() {
    const root = vscode.workspace.workspaceFolders![0].uri.fsPath;
    const packs = path.dirname(root);
    const core = path.join(process.env.KOMPOT_CONTENT!, 'kompot');
    const manifest = path.join(root, 'package.json');
    const rcFile = path.join(root, '.luarc.jsonc');
    const otherPlugin = path.join(root, 'user-plugin.lua');
    const otherLibrary = path.join(root, 'user-library');
    const previousPath = process.env.PATH;
    const results: string[] = [];
    const rc = () => parse(fs.readFileSync(rcFile, 'utf8'));
    const libs = () => rc()['workspace.library'] || [];
    fs.mkdirSync(path.join(root, 'modules'), {recursive:true});
    fs.mkdirSync(otherLibrary, {recursive:true});
    fs.writeFileSync(manifest, JSON.stringify({id:'setup_mod',dependencies:[]}));
    fs.writeFileSync(otherPlugin, 'function ResolveRequire() return nil end\n');
    fs.writeFileSync(path.join(otherLibrary,'custom.lua'), '---@class UserLibraryType\n---@field kept boolean\n');
    fs.writeFileSync(rcFile, '// Keep the user configuration\n' + JSON.stringify({
        'runtime.plugin':otherPlugin, 'workspace.library':[otherLibrary], 'runtime.version':'LuaJIT',
    },null,2));
    const file = path.join(root,'modules/main.lua');
    fs.writeFileSync(file, `local K = require "kompot:kompot"
local UI = require "kompot:ui"
K.preview("Setup", {width=240,height=80,theme=UI.theme}, function()
    local n = K.state(0)
    UI.Button({text="Count " .. n.value,on_click=function() n.value=n:peek()+1 end})
end)
`);
    const typedFile = path.join(root,'modules/types.lua');
    fs.writeFileSync(typedFile, 'local K = require "kompot:kompot"\nK.Column({spacing="wrong"})\nK.\n');
    let api: any;
    try {
        process.env.PATH = '';
        const extension = vscode.extensions.getExtension('BooleanFalse.kompot-lens')!;
        api = await extension.activate();
        const doc = await vscode.workspace.openTextDocument(file);
        await vscode.window.showTextDocument(doc);
        await sleep(1000);
        assert.deepEqual(libs(), [otherLibrary]);
        results.push('ok   unrelated project keeps its LuaLS configuration');

        fs.writeFileSync(manifest, JSON.stringify({id:'setup_mod',dependencies:['kompot']}));
        await until(()=>libs().some((v:string)=>v.endsWith('/luals/kompot/library')), 'dependency enables bundled types');
        assert.ok(libs().includes(otherLibrary));
        assert.ok(rc()['runtime.plugin'].includes(otherPlugin));
        results.push('ok   dependency change enables annotations and preserves user libraries/plugins');

        const typed = await vscode.workspace.openTextDocument(typedFile);
        await vscode.window.showTextDocument(typed);
        const pos = new vscode.Position(2, 2);
        const labels = async () => {
            const completion = await vscode.commands.executeCommand<vscode.CompletionList>('vscode.executeCompletionItemProvider', typed.uri, pos);
            return (completion?.items || []).map(i=>typeof i.label==='string'?i.label:i.label.label);
        };
        await until(async()=> (await labels()).includes('Column'), 'LuaLS completion without Kompot');
        await until(()=>vscode.languages.getDiagnostics(typed.uri).some(d=>/spacing|number/.test(d.message)), 'LuaLS checks types without Kompot');
        results.push('ok   LuaLS completion and type diagnostics work before Kompot is installed');

        const installed = path.join(packs,'kompot');
        fs.mkdirSync(path.join(installed,'annotations'),{recursive:true});
        for (const name of ['modules','fonts','textures']) if(fs.existsSync(path.join(core,name))) fs.symlinkSync(path.join(core,name),path.join(installed,name),'dir');
        for (const name of ['kompot.lua','ui.lua']) fs.copyFileSync(path.join(core,'annotations',name),path.join(installed,'annotations',name));
        fs.appendFileSync(path.join(installed,'annotations/kompot.lua'), '\n---@class KompotApi\n---@field setup_probe fun():string\n');
        fs.copyFileSync(path.join(core,'package.json'),path.join(installed,'package.json'));
        await until(()=>libs().includes(path.join(installed,'annotations')), 'installation selects pack annotations');
        assert.ok(!libs().includes(path.join(extension.extensionPath,'luals/kompot/library')));
        await until(async()=> (await labels()).includes('setup_probe'), 'installed pack version overrides bundled types');
        results.push('ok   installing sibling Kompot updates annotations automatically to the installed version');

        await vscode.window.showTextDocument(doc);
        const rendered = api.preview.waitRendered();
        await vscode.commands.executeCommand('kompot.openPreview',doc.uri);
        assert.equal(await Promise.race([rendered,sleep(20000).then(()=>{throw new Error('preview timeout');})]),1);
        assert.ok(api.preview.rasterFontCount>0,api.preview.rasterError);
        api.preview.interactive('Setup');
        await until(()=>api.preview.lastDoc?.name==='Setup','interactive session');
        const initial=api.preview.frames;
        api.preview.input('Setup',10,10,true);
        api.preview.input('Setup',10,10,false);
        await until(()=>api.preview.frames>initial,'input frame');
        api.preview.interactive(null);
        results.push('ok   real webview fonts and interactive preview work with an empty PATH');

        const alternate = path.join(packs,'selected-packs');
        fs.mkdirSync(alternate,{recursive:true});
        const relocated = path.join(alternate,'kompot');
        fs.renameSync(installed,relocated);
        await vscode.workspace.getConfiguration('kompot',doc.uri).update('contentPath',alternate,vscode.ConfigurationTarget.WorkspaceFolder);
        await until(()=>libs().includes(path.join(relocated,'annotations')), 'selected content updates LuaLS');
        const selectedRender=api.preview.waitRendered();
        await vscode.commands.executeCommand('kompot.refresh');
        assert.equal(await Promise.race([selectedRender,sleep(20000).then(()=>{throw new Error('selected content preview timeout');})]),1);
        results.push('ok   remembered content setting loads a pack outside the project and refreshes fonts/types');
        fs.rmSync(relocated,{recursive:true,force:true});
        await until(()=>libs().includes(path.join(extension.extensionPath,'luals/kompot/library')), 'pack removal restores bundled types');
        await vscode.workspace.getConfiguration('kompot',doc.uri).update('contentPath',undefined,vscode.ConfigurationTarget.WorkspaceFolder);
        fs.writeFileSync(manifest,JSON.stringify({id:'setup_mod',dependencies:[]}));
        await until(()=>libs().length===1 && libs()[0]===otherLibrary,'dependency removal removes only Kompot config');
        assert.deepEqual(rc()['runtime.plugin'],[otherPlugin]);
        results.push('ok   pack/dependency removal restores user configuration without a reload');
    } catch (error) { results.push('FAIL setup: ' + ((error as Error).stack || error)); }
    finally { process.env.PATH=previousPath; api?.preview.dispose(); }
    const report=results.join('\n')+'\n';
    if(process.env.KOMPOT_REPORT)fs.writeFileSync(process.env.KOMPOT_REPORT,report);
    console.log(report);
    if(results.some(r=>r.startsWith('FAIL')))throw new Error(report);
}
