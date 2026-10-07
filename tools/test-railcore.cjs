const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {buildProject}=require('./vcts-project.cjs');
const {emitTypes}=require('./railcore-types.cjs');
const {runHeadless}=require('./api/headless.cjs');
const root=path.resolve(__dirname,'..');
emitTypes({check:true});
const result=buildProject(path.join(root,'examples/railcore/vcts.config.json'),{deploy:false});
const parity=spawnSync(process.env.LUAJIT||'luajit',[path.join(root,'examples/railcore/tests/parity.lua'),path.join(root,'examples/railcore/tests/original'),path.join(result.outDir,'content/rail_core')],{encoding:'utf8',timeout:30000});
if(parity.error||parity.status!==0)throw new Error(parity.error?.message||parity.stdout+parity.stderr);
console.log(parity.stdout.trim());
const count=Number(parity.stdout.match(/RAILCORE_PARITY_PASS (\d+)/)?.[1]);if(!count)throw new Error('Parity marker missing');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'sdk/api/inventory.json')));
const evidence=runHeadless({project:result.outDir,script:'start.lua',marker:'RAILCORE_TS_PASS',evidencePath:'export/railcore-evidence.json',logName:'railcore',inventory});
const report={parityScenarios:count,headlessChecks:evidence.cases.length,source:'tomac/rail_core 1.0.2',runtime:evidence.runtime.manifest.version,
  limitations:['Visual models, HUD input and native passenger experience need a graphical play-through.','Floating-point scenarios match the Lua baseline within 1e-7; this is not exhaustive proof of identical behavior.']};
fs.writeFileSync(path.join(root,'build/logs/railcore-summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(`PASS RailCore TS: ${count} Lua/TS parity scenarios; ${evidence.cases.length} checks on VC ${report.runtime}`);
