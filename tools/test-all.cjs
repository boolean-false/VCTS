const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {selectSuites}=require('./suite-selection.cjs');
const selection=selectSuites(root,{requireIntegrations:process.argv.includes('--require-integrations')});
for(const item of selection.unavailable)console.log(`Не проверяется ${item.name}: ${item.reason}`);
const commands=[
 ['Выбор доступных наборов проверок',['--test','tools/tests/suite-selection.test.cjs']],
 ['TypeScript design',['node_modules/typescript/bin/tsc','--noEmit','-p','design/tsconfig.json']],
 ['VC loader',['tools/check-vc-loader.cjs']],
 ['Module entries / ownership / UI dispatch',['--test','tools/tests/vc-modules.test.cjs']],
 ['Terminal interface',['--test','tools/tests/vcts-tui.test.cjs']],
 ['Templates / watch / diagnostics',['--test','tools/tests/vcts-project.test.cjs']],
 ['API inventory',['tools/api/inventory.cjs','--check']],
 ['API profiles / author contracts',['tools/api/check-types.cjs']],
 ['Inventory and engine HTTP wrapper regressions',['--test','tools/tests/api-inventory.test.cjs','tools/tests/network-wrappers.test.cjs']],
 ['Direct native API / entities / codecs / crypto',['tools/api/test-engine.cjs']],
 ['HTTP / TCP / UDP / permission',['tools/api/test-network.cjs']],
 ['Generator states / fragments',['tools/api/test-generation.cjs']],
 ['CPU Canvas',['tools/api/test-canvas.cjs']],
 ['Author layer',['tools/api/test-author.cjs']],
 ['Mod template',['tools/vcts.cjs','test','examples/starter-mod/vcts.config.json']],
 ['Standalone game without base',['tools/vcts.cjs','test','examples/starter-game/vcts.config.json']],
 ['Kompot declarations',['tools/kompot-types.cjs','--check']],
 ['Kompot TS sample',['tools/vcts.cjs','build','examples/kompot/vcts.config.json']],
 ['UI build (graphics not invoked)',['tools/vcts.cjs','build','examples/ui/vcts.config.json']],
 ['Existing block-state SDK integration',['tools/run-demo.cjs','test']],
 ['RailCore migration / Lua and TS addons',['tools/test-railcore.cjs']],
 ['Independent consumer of ready RailCore',['tools/vcts.cjs','test','examples/external-api/vcts.config.json']],
];
for(const [name,args] of commands) {
  if(!selection.railcore && (args[0]==='tools/test-railcore.cjs' || args.includes('examples/external-api/vcts.config.json')))continue;
  console.log(`\nChecking: ${name}`);
  const run=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',timeout:180000});
  if(run.error||run.status!==0){console.error(run.error?.message||`${name} failed (${run.status})`);process.exit(1);}
}
const logs=path.join(root,'build/logs');
const names=['direct-api','network','generation','canvas','author','project-starter-mod','project-starter-game',...(selection.railcore ? ['railcore','project-external-api'] : [])];
const evidence=names.map(name=>({name,data:JSON.parse(fs.readFileSync(path.join(logs,`${name}-evidence.json`),'utf8'))}));
const summary={unavailableSuites:selection.unavailable,vcts:'1.0.0',runtime:'0.32.1',headlessChecks:evidence.reduce((sum,item)=>sum+item.data.cases.length,0),
 suites:evidence.map(({name,data})=>({name,checks:data.cases.length,resourceDifferences:data.runtime.resourceDifferences})),
 limitations:['Graphical rendering, actual UI interaction and audio output were not tested.','Presence checks are separate from behavioral checks.','The API inventory does not claim every dynamic export or every core-module export.']};
fs.writeFileSync(path.join(logs,'v1-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(`\nPASS VCTS 1.0.0: ${summary.headlessChecks} selected headless behavior checks; all selected build, loader, type, watch and template checks passed; ${selection.unavailable.length} unavailable suites.`);
