const ts = require('typescript');
const path = require('node:path');
const {available}=require('../local-fixtures.cjs');
const localFixtures=available();
const root = path.resolve(__dirname,'../..');
const options = {target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  lib:['lib.es2022.d.ts'],types:[],strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,noEmit:true};
const host={getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'};
for(const name of ['headless','client','app','app-client','common','generator','author']) {
  // Отдельные программы не допускают утечки клиентских глобальных объектов в headless.
  const files=localFixtures?[path.join(root,`tests/fixtures/direct/checks/${name}.ts`)]:
    name==='author'?['sdk/headless.d.ts','sdk/author/core.ts','sdk/author/network.ts'].map(file=>path.join(root,file)):
    [path.join(root,`sdk/${name}.d.ts`)];
  const program=ts.createProgram(files,options);
  const errors=ts.getPreEmitDiagnostics(program);
  if(errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors,host));
}
console.log('Проверены 6 отдельных профилей API и авторский слой.'+(localFixtures?' Проверены ожидаемые ошибки типов.':' Проверки сценариев пропущены: tests/fixtures не входит в поставку.'));
