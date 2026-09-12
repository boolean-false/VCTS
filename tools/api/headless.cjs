const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {resolveRuntime}=require('../vc-runtime.cjs');
const root=path.resolve(__dirname,'../..');
function runHeadless({project,script='start.lua',marker,evidencePath,logName,inventory}) {
  const runtime=resolveRuntime();
  const user=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-headless-'));
  const logs=path.join(root,'build/logs');fs.mkdirSync(logs,{recursive:true});
  const saved=path.join(logs,`${logName}-evidence.json`);fs.rmSync(saved,{force:true});
  try {
    const run=spawnSync(runtime.executable,['--headless','--res',runtime.resources,'--dir',user,'--project',project,'--script',path.join(project,script)],{cwd:user,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
    const log=(run.stdout||'')+(run.stderr||'');fs.writeFileSync(path.join(logs,`${logName}.log`),log);
    if(run.error || run.status!==0 || /^\[E\]/m.test(log) || !log.includes(marker)) throw new Error(`${run.error?.message||`VC exit ${run.status}`}; see ${logName}.log\n${log.slice(-5000)}`);
    const evidence=JSON.parse(fs.readFileSync(path.join(user,evidencePath),'utf8'));
    const digest=name=>crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');
    evidence.sourceHashes=inventory.sourceHashes;
    evidence.runtime={executable:fs.realpathSync(runtime.executable),sha256:digest(runtime.executable),manifest:runtime.manifest,
      resources:Object.fromEntries(Object.keys(inventory.sourceHashes).filter(name=>name.startsWith('res/')).map(name=>[name,digest(path.join(runtime.resources,name.slice(4)))]))};
    evidence.runtime.resourceDifferences=Object.keys(evidence.runtime.resources).filter(name=>evidence.runtime.resources[name]!==inventory.sourceHashes[name]);
    evidence.declarations=Object.fromEntries(inventory.symbols.filter(s=>s.declaration).map(s=>[s.id,s.declaration]));
    evidence.userdataDeclarations=inventory.surfaces.userdata.flatMap(s=>s.declarations).filter(s=>s.declaration);
    fs.writeFileSync(saved,JSON.stringify(evidence,null,2)+'\n');
    return evidence;
  } finally {fs.rmSync(user,{recursive:true,force:true});}
}
module.exports={runHeadless};
