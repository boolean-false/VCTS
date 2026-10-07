import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {runHost} from '../../src/host';
export async function run(): Promise<void> {
    try {
        const content=process.env.KOMPOT_CONTENT!,output=process.env.KOMPOT_SNAPSHOTS!;
        const api=await vscode.extensions.getExtension('BooleanFalse.kompot-lens')!.activate();
        const doc=await vscode.workspace.openTextDocument(path.join(content,'parity/modules/cases.lua'));
        await vscode.window.showTextDocument(doc,vscode.ViewColumn.One);
        const rendered=api.preview.waitRendered();
        await vscode.commands.executeCommand('kompot.openPreview');
        const count=await Promise.race([rendered,new Promise((_,reject)=>setTimeout(()=>reject(new Error('transform preview timeout')),60000))]);
        assert.equal(count,9);assert.equal(api.preview.rasterError,'');
        const result=await runHost('render',content,['parity:cases'],[],[],{sandbox:false,fontMetrics:api.preview.fontMetrics});
        assert.ok(result.ok,result.error);
        const images=await api.preview.snapshot();fs.mkdirSync(output,{recursive:true});
        for(const preview of result.previews) {
            assert.equal(preview.error,null,preview.name);
            assert.deepEqual(preview.font_requests,[]);
            fs.writeFileSync(path.join(output,preview.name+'.png'),Buffer.from(images[preview.name].split(',')[1],'base64'));
            fs.writeFileSync(path.join(output,preview.name+'.json'),JSON.stringify(preview));
        }
        fs.writeFileSync(process.env.KOMPOT_REPORT!,`ok   ${count} transform and motion webview snapshots\n`);
    } catch(e) {
        fs.writeFileSync(process.env.KOMPOT_REPORT!,`FAIL transforms: ${e.stack || e}\n`);throw e;
    }
}
