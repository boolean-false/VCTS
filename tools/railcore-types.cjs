// Emit the public TS contract from the port; keep declarations synchronized.
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'../examples/railcore');
function emitTypes({check=false}={}) {
  const config=ts.readConfigFile(path.join(root,'tsconfig.json'),ts.sys.readFile);
  const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
  const program=ts.createProgram(parsed.fileNames,{...parsed.options,declaration:true,emitDeclarationOnly:true,noEmit:false});
  const diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)];
  if(diagnostics.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
  const files=new Map();
  const emit=program.emit(undefined,(name,text)=>{
    if(name===path.join(root,'src/rail_core/api.d.ts')||name===path.join(root,'src/rail_core/types.d.ts'))files.set(path.basename(name),text);
  });
  if(emit.emitSkipped||files.size!==2)throw new Error('Public declarations were not emitted');
  const dest=path.join(root,'content/types');fs.mkdirSync(dest,{recursive:true});
  for(const [name,text] of files){const file=path.join(dest,name);if(check){if(fs.readFileSync(file,'utf8')!==text)throw new Error('Stale RailCore public declaration: '+name);}else fs.writeFileSync(file,text);}
}
if(require.main===module)emitTypes({check:process.argv.includes('--check')});
module.exports={emitTypes};
