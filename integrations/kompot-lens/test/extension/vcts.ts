import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(check:()=>boolean,what:string){const end=Date.now()+30000;while(Date.now()<end){if(check())return;await sleep(200);}throw new Error('timeout: '+what);}
export async function run(){
 const results:string[]=[];let api:any;let doc:vscode.TextDocument|undefined;
 try{
  const root=vscode.workspace.workspaceFolders![0].uri.fsPath;
  const source=path.join(root,'src/kompot_ts/screen.ts');
  doc=await vscode.workspace.openTextDocument(source);await vscode.window.showTextDocument(doc);
  await vscode.workspace.getConfiguration('kompot').update('vctsPath',process.env.VCTS_ROOT,vscode.ConfigurationTarget.Global);
  await vscode.workspace.getConfiguration('kompot').update('previewUpdateMode','live',vscode.ConfigurationTarget.Global);
  api=await vscode.extensions.getExtension('BooleanFalse.kompot-lens')!.activate();
  const rendered=api.preview.waitRendered();await vscode.commands.executeCommand('kompot.openPreview',doc.uri);
  assert.equal(await Promise.race([rendered,sleep(30000).then(()=>{throw new Error('TS webview timeout '+JSON.stringify({visible:api.preview.view?.visible,vcts:api.preview.vcts?.module,fonts:api.preview.fontSignatures,metrics:Object.keys(api.preview.fontMetrics),revision:api.preview.revision}));})]),1);
  assert.ok(api.preview.rasterFontCount>0,api.preview.rasterError);results.push('ok   TypeScript preview renders with Kompot fonts in real VSCode webview');
  const lenses=await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider',doc.uri);
  assert.ok(lenses?.some(l=>l.command?.command==='kompot.openPreview'));results.push('ok   TypeScript CodeLens opens preview');
  api.preview.interactive('TS форма и состояние');await until(()=>api.preview.lastDoc?.prims?.some((p:any)=>p.text==='Нажато: 0'),'initial interactive');
  const button=api.preview.lastDoc.prims.find((p:any)=>p.text==='Нажато: 0');const x=button.x+button.w/2,y=button.y+button.h/2;
  api.preview.input(api.preview.lastDoc.name,x,y,true);await sleep(100);api.preview.input(api.preview.lastDoc.name,x,y,false);
  await until(()=>api.preview.lastDoc.prims.some((p:any)=>p.text==='Нажато: 1'),'TS click');results.push('ok   TypeScript callback updates state in interactive preview');
  api.preview.interactive(null);
  const original=doc.getText();const start=original.indexOf('Danila');const edit=new vscode.WorkspaceEdit();edit.replace(doc.uri,new vscode.Range(doc.positionAt(start),doc.positionAt(start+6)),'LiveTS');
  const live=api.preview.waitRendered();await vscode.workspace.applyEdit(edit);assert.equal(await Promise.race([live,sleep(30000).then(()=>{throw new Error('live timeout');})]),1);
  api.preview.interactive('TS форма и состояние');await until(()=>api.preview.lastDoc?.prims?.some((p:any)=>p.text==='Привет, LiveTS!'),'unsaved state');
  assert.ok(doc.isDirty);assert.ok(fs.readFileSync(source,'utf8').includes('Danila'));results.push('ok   unsaved TypeScript changes render without changing disk source');
  const snapshots=await api.preview.snapshot();const dir=process.env.KOMPOT_SNAPSHOTS;if(dir){fs.mkdirSync(dir,{recursive:true});for(const [name,data] of Object.entries(snapshots))fs.writeFileSync(path.join(dir,'vcts-'+name.replace(/[^a-z0-9]/gi,'_')+'.png'),Buffer.from((data as string).split(',')[1],'base64'));}
  api.preview.interactive(null);
  const errorLine=doc.getText().split('\n').findIndex(line=>line.includes('const count'));
  const failure=new vscode.WorkspaceEdit();failure.insert(doc.uri,new vscode.Position(errorLine,0),'    throw new Error("VCTS_EDITOR_FAILURE"); ');
  await vscode.workspace.applyEdit(failure);
  await until(()=>vscode.languages.getDiagnostics(doc!.uri).some(d=>d.source==='Kompot'&&d.message.includes('VCTS_EDITOR_FAILURE')&&d.range.start.line===errorLine),'runtime error maps to TS editor line');
  results.push('ok   runtime exception is underlined on the original TypeScript line');
 }catch(error){results.push('FAIL vcts: '+((error as Error).stack||error));}
 finally{api?.preview.dispose();if(doc?.isDirty){await vscode.window.showTextDocument(doc);await vscode.commands.executeCommand('workbench.action.files.revert');}}
 const report=results.join('\n')+'\n';if(process.env.KOMPOT_REPORT)fs.writeFileSync(process.env.KOMPOT_REPORT,report);console.log(report);if(results.some(r=>r.startsWith('FAIL')))throw new Error(report);
}
