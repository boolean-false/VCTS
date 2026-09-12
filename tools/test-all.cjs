const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createProject}=require('./vcts-template.cjs');
const {available}=require('./local-fixtures.cjs');
const localFixtures=available();
const root=path.resolve(__dirname,'..');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-suite-'));
try {
  // Проверяем свежие проекты, не зависящие от учебного репозитория.
  createProject(path.join(temporary,'starter-pack'),{kind:'pack',id:'starter'});
  createProject(path.join(temporary,'starter-project'),{kind:'project',id:'projectkit'});
  const commands=[
   ['VC loader',['tools/check-vc-loader.cjs']],
   ['Module entries / ownership / UI dispatch',['--test','tools/tests/vc-modules.test.cjs']],
   ['Terminal interface',['--test','tools/tests/vcts-tui.test.cjs']],
   ['Templates / watch / diagnostics',['--test','tools/tests/vcts-project.test.cjs']],
   ['API profiles / author contracts',['tools/api/check-types.cjs']],
   ['Inventory and engine HTTP wrapper regressions',['--test','tools/tests/api-inventory.test.cjs','tools/tests/network-wrappers.test.cjs']],
   ['Direct native API / entities / codecs / crypto',['tools/api/test-engine.cjs']],
   ['HTTP / TCP / UDP / permission',['tools/api/test-network.cjs']],
   ['Generator states / fragments',['tools/api/test-generation.cjs']],
   ['CPU Canvas',['tools/api/test-canvas.cjs']],
   ['Author layer',['tools/api/test-author.cjs']],
   ['Content pack template',['tools/vcts.cjs','test',path.join(temporary,'starter-pack/vcts.config.json')]],
   ['Project without base',['tools/vcts.cjs','test',path.join(temporary,'starter-project/vcts.config.json')]],
   ['UI build (graphics not invoked)',['tools/vcts.cjs','build','tests/fixtures/ui/vcts.config.json']],
  ];
  const fixtureSuites=new Set(['Module entries / ownership / UI dispatch','Direct native API / entities / codecs / crypto','HTTP / TCP / UDP / permission','Generator states / fragments','CPU Canvas','Author layer','UI build (graphics not invoked)']);
  for(const [name,args] of commands) {
    if(!localFixtures&&fixtureSuites.has(name)){
      console.log(`Пропуск ${name}: нужны локальные tests/fixtures.`);
      continue;
    }
    console.log(`\nChecking: ${name}`);
    const run=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',timeout:180000});
    if(run.error||run.status!==0)throw new Error(run.error?.message||`${name}: ошибка проверки (${run.status})`);
  }
  const logs=path.join(root,'build/logs');
  const names=[...(localFixtures?['direct-api','network','generation','canvas','author']:[]),'project-starter-pack','project-starter-project'];
  const evidence=names.map(name=>({name,data:JSON.parse(fs.readFileSync(path.join(logs,`${name}-evidence.json`),'utf8'))}));
  const summary={localFixtures,vcts:require('../package.json').version,runtime:'0.32.1',headlessChecks:evidence.reduce((sum,item)=>sum+item.data.cases.length,0),
   suites:evidence.map(({name,data})=>({name,checks:data.cases.length,resourceDifferences:data.runtime.resourceDifferences})),
   limitations:['Graphical rendering, actual UI interaction and audio output were not tested.','Presence checks are separate from behavioral checks.','The API inventory does not claim every dynamic export or every core-module export.']};
  fs.writeFileSync(path.join(logs,'v1-summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(`\nPASS VCTS ${summary.vcts}: ${summary.headlessChecks} selected headless behavior checks; all selected build, loader, type, watch and template checks passed.${localFixtures?'':' Local fixture suites were skipped.'}`);

} catch(error) {
  console.error(error.message);
  process.exitCode=1;
} finally {
  fs.rmSync(temporary,{recursive:true,force:true});
}
