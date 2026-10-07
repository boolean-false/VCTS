const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {selectSuites}=require('../suite-selection.cjs');
test('Отсутствующие интеграции отмечаются в отчёте, строгий режим завершается ошибкой',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-suites-'));
 try {
  const selection=selectSuites(root);
  assert.equal(selection.railcore,false);
  assert.deepEqual(selection.unavailable.map(item=>item.name),['railcore','project-external-api']);
  assert.throws(()=>selectSuites(root,{requireIntegrations:true}),/Отсутствуют исходники/);
  fs.mkdirSync(path.join(root,'examples/railcore'),{recursive:true});
  assert.equal(selectSuites(root).railcore,false);
  fs.writeFileSync(path.join(root,'examples/railcore/vcts.config.json'),'{}');
  // Ошибки объявленного примера нельзя пропускать.
  assert.deepEqual(selectSuites(root,{requireIntegrations:true}),{railcore:true,unavailable:[]});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
