import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
export async function run(): Promise<void> {
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kompot-corners-webview-'));
    try {
        fs.symlinkSync(path.join(process.env.KOMPOT_CONTENT!,'kompot'),path.join(temp,'kompot'),'dir');
        const pack=path.join(temp,'corners_check');
        fs.mkdirSync(path.join(pack,'modules'),{recursive:true});
        fs.writeFileSync(path.join(pack,'package.json'),JSON.stringify({id:'corners_check',title:'Corners check',version:'1.0.0'}));
        const file=path.join(pack,'modules','cases.lua');
        fs.writeFileSync(file,`local K=require "kompot:kompot"
K.preview("Corners",{width=360,height=220,padding=0},function()
 local corners={top_left=24,top_right=8,bottom_right=0,bottom_left=16}
 K.Box({modifier=K.M:size(360,220):background("#202830")},function()
  K.Box({modifier=K.M:offset(20,20):size(100,70):shadow(6,corners):background("#4080D0",corners):border(3,"#FFFFFF",corners)})
  K.Box({modifier=K.M:offset(140,20):size(100,70):clip(corners):background("#FF8040")},function()
   K.Box({modifier=K.M:offset(-10,30):size(130,50):background("#40D080")})
  end)
  K.Box({modifier=K.M:offset(260,25):size(70):rotate(15):clip(corners):background("#C050D0")})
  K.Box({modifier=K.M:offset(20,120):size(100,70):clip(corners):padding(8):clip({bottom_right=24}):background("#50C0D0")})
  K.Box({modifier=K.M:offset(150,120):size(70):background("#F0D060",{top_left=70,bottom_right=70})})
 end)
end)
local S=K.Shape
K.preview("Shapes",{width=420,height=320,padding=0},function()
    K.Box({modifier=K.M:size(420,320):background("#202830")},function()
        K.Box({modifier=K.M:offset(20,20):size(100,60):background("#4080D0",S.rectangle()):border(3,"#FFFFFF",S.rectangle())})
        K.Box({modifier=K.M:offset(150,20):size(100,60):background("#50C0A0",S.circle()):border(3,"#FFFFFF",S.circle())})
        local rounded=S.rounded({top_left=S.percent(50),top_right=8,bottom_left=S.px(16)})
        K.Box({modifier=K.M:offset(280,20):size(100,60):background("#F0C050",rounded):border(3,"#FFFFFF",rounded)})
        local cut=S.cut({top_left=S.percent(50),top_right=8,bottom_left=16})
        K.Box({modifier=K.M:offset(20,120):size(100,70):shadow(6,cut):background("#4080D0",cut):border(3,"#FFFFFF",cut)})
        K.Box({modifier=K.M:offset(160,120):size(80,70):rotate(15):clip(S.cut(20)):background("#C050D0")})
        K.Box({modifier=K.M:offset(280,120):size(100,70):clip(S.cut(25)):padding(4):clip(S.circle()):background("#50C0D0")})
        K.Box({modifier=K.M:offset(20,230):size(80,60):background("#FF8040",S.cut(20)):clip(S.cut(20)):background("#FF8040")})
        K.Box({modifier=K.M:offset(150,230):size(80,60):clip(S.cut(S.percent(50))):background("#50C0A0")})
    end)
end)`);
        const api=await vscode.extensions.getExtension('BooleanFalse.kompot-lens')!.activate();
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(file),vscode.ViewColumn.One);
        const rendered=api.preview.waitRendered();
        await vscode.commands.executeCommand('kompot.openPreview');
        const count=await Promise.race([rendered,new Promise((_,reject)=>setTimeout(()=>reject(new Error('corners preview timeout')),60000))]);
        assert.equal(count,2);assert.equal(api.preview.rasterError,'');
        const images=await api.preview.snapshot();
        assert.ok(images.Corners?.startsWith('data:image/png;base64,'));
        const output=process.env.KOMPOT_SNAPSHOTS || temp;
        fs.mkdirSync(output,{recursive:true});
        fs.writeFileSync(path.join(output,'corners-webview.png'),Buffer.from(images.Corners.split(',')[1],'base64'));
        assert.ok(images.Shapes?.startsWith('data:image/png;base64,'));
        fs.writeFileSync(path.join(output,'shapes-webview.png'),Buffer.from(images.Shapes.split(',')[1],'base64'));
        fs.writeFileSync(process.env.KOMPOT_REPORT!,'ok   shared Shape, percentage sizes, cut borders, shadows and nested masks in webview\n');
    } catch(e) {
        fs.writeFileSync(process.env.KOMPOT_REPORT!,`FAIL corners: ${e.stack || e}\n`);throw e;
    } finally { fs.rmSync(temp,{recursive:true,force:true}); }
}
