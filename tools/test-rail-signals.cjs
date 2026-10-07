const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const {buildProject}=require('./vcts-project.cjs');const {resolveRuntime}=require('./vc-runtime.cjs');
const {runHeadless}=require('./api/headless.cjs');const root=path.resolve(__dirname,'..');
const config=path.join(root,'examples/rail-signals/vcts.config.json');
const result=buildProject(config,{deploy:false});
if(process.argv.includes('--visual')){
 const runtime=resolveRuntime();const user=path.join(root,'build/rail-signals-visual-user-'+Date.now());fs.mkdirSync(user,{recursive:true});
 const run=spawnSync(runtime.executable,['--res',runtime.resources,'--dir',user,'--project',result.outDir,'--script',path.join(result.outDir,'preview.lua')],{cwd:user,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
 const log=(run.stdout||'')+(run.stderr||'');fs.mkdirSync(path.join(root,'build/logs'),{recursive:true});fs.writeFileSync(path.join(root,'build/logs/signals-visual.log'),log);
 if(run.error||run.status!==0||log.split('\n').some(line=>line.startsWith('[E]')&&!line.includes('Cocoa: Regular windows do not have icons on macOS'))||!log.includes('RAIL_SIGNALS_VISUAL_PASS'))throw new Error(run.error?.message||log.slice(-5000));
 console.log('PASS graphical runtime, red/green models: '+path.join(user,'export')); 
}else{
 const evidence=runHeadless({project:result.outDir,script:'start.lua',marker:'RAIL_SIGNALS_PASS',evidencePath:'export/signals-evidence.json',logName:'rail-signals',inventory:JSON.parse(fs.readFileSync(path.join(root,'sdk/api/inventory.json')))});
 console.log('PASS Rail Signals: '+evidence.cases.length+' native checks on VC '+evidence.runtime.manifest.version);
}
