// Same external pack and text cases in VoxelCore and the real VS Code webview.
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {runHost} from '../../src/host';

export async function run(): Promise<void> {
    try {
        const content = process.env.KOMPOT_CONTENT!;
        const output = process.env.KOMPOT_SNAPSHOTS!;
        const expected = JSON.parse(fs.readFileSync(path.join(content,'parity/cases.json'),'utf8')).length;
        const ext = vscode.extensions.getExtension('BooleanFalse.kompot-lens')!;
        const api = await ext.activate();
        const doc = await vscode.workspace.openTextDocument(path.join(content,'parity/modules/cases.lua'));
        await vscode.window.showTextDocument(doc,vscode.ViewColumn.One);
        const rendered = api.preview.waitRendered();
        await vscode.commands.executeCommand('kompot.openPreview');
        const count = await Promise.race([rendered,new Promise((_,reject) => setTimeout(() => reject(new Error('font parity render timeout')),60000))]);
        assert.equal(count,expected);
        assert.equal(api.preview.rasterError,'');
        const result = await runHost('render',content,['parity:cases'],[],[],{sandbox:false,fontMetrics:api.preview.fontMetrics});
        assert.ok(result.ok,result.error);
        fs.mkdirSync(output,{recursive:true});
        const images = await api.preview.snapshot();
        for (const doc of result.previews) {
            assert.deepEqual(doc.font_requests,[]);
            fs.writeFileSync(path.join(output,doc.name+'.json'),JSON.stringify(doc));
            fs.writeFileSync(path.join(output,doc.name+'.png'),Buffer.from(images[doc.name].split(',')[1],'base64'));
        }
        // A bad resource must report an error rather than switch to a browser font.
        fs.writeFileSync(path.join(content,'parity/fonts/corrupt.ttf'),'not a font');
        const invalid=path.join(content,'parity/modules/corrupt.lua');
        fs.writeFileSync(invalid,`local K=require "kompot:kompot"
K.fonts.register_family("parity:corrupt",{{name="corrupt",file="parity/fonts/corrupt.ttf",size=16}})
K.preview("invalid",{},function()K.Text("Hello",{font="corrupt"})end)`);
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(invalid),vscode.ViewColumn.One);
        const failedRender=api.preview.waitRendered();
        await vscode.commands.executeCommand('kompot.openPreview');
        const failureCount=await Promise.race([failedRender,new Promise((_,reject)=>setTimeout(()=>reject(new Error('invalid font timeout')),20000))]);
        assert.equal(failureCount,0);
        assert.ok(api.preview.rasterError);
        fs.writeFileSync(process.env.KOMPOT_REPORT!,`ok   ${count} external font parity snapshots\n`);
    } catch(e) {
        fs.writeFileSync(process.env.KOMPOT_REPORT!,`FAIL font parity: ${e.stack || e}\n`);
        throw e;
    }
}
