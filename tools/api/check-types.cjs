const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const options = {target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  lib:['lib.es2022.d.ts'],types:[],strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,noEmit:true};
const host={getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'};
for(const name of ['headless','client','app','app-client','common','generator','author']) {
  // Separate programs are essential: ambient client globals must not leak into headless.
  const program=ts.createProgram([path.join(root,`examples/direct/checks/${name}.ts`)],options);
  const errors=ts.getPreEmitDiagnostics(program);
  if(errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors,host));
}
console.log('Проверены 6 отдельных профилей API и авторский слой, включая ожидаемые ошибки типов.');
