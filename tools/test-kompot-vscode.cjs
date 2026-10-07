const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {preparePreview}=require('./kompot-preview.cjs');
const root=path.resolve(__dirname,'..'),plugin=path.join(root,'integrations/kompot-lens');
async function main(){
 const compiled=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build','--prefix',plugin],{cwd:root,stdio:'inherit',timeout:60000});if(compiled.error||compiled.status!==0)throw new Error(compiled.error?.message||'Build Kompot Lens first; run npm run kompot:setup');
 const preview=await preparePreview(path.join(root,'examples/kompot/vcts.config.json'),path.join(root,'examples/kompot/src/kompot_ts/screen.ts'));
 try{
  const mac='/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code';const logs=path.join(root,'build/logs');fs.mkdirSync(logs,{recursive:true});
  const result=spawnSync(process.execPath,[path.join(plugin,'out/scripts/run-extension-tests.js')],{cwd:root,stdio:'inherit',timeout:90000,env:{...process.env,VSCODE_PATH:process.env.VSCODE_PATH||(fs.existsSync(mac)?mac:'code'),VCTS_ROOT:root,KOMPOT_CONTENT:preview.content,KOMPOT_WORKSPACE:path.join(root,'examples/kompot'),KOMPOT_TEST_ENTRY:'vcts',KOMPOT_REPORT:path.join(logs,'kompot-vscode.txt'),KOMPOT_SNAPSHOTS:path.join(root,'build/kompot-snapshots')}});
  if(result.error||result.status!==0)throw new Error(result.error?.message||'VSCode integration checks failed');
 }finally{fs.rmSync(preview.temporary,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
