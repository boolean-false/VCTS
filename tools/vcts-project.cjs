const fs=require('node:fs');
const path=require('node:path');
const {buildModules}=require('./vc-modules.cjs');
const {prepareBuild}=require('./build-modules.cjs');
const {loadDependencies}=require('./vcts-dependencies.cjs');
const {buildMinimalLualibBundle}=require('typescript-to-lua/dist/LuaLib');
const tstl=require('typescript-to-lua'),ts=require('typescript');
const inside=(parent,child)=>{const rel=path.relative(parent,child);return rel!=='' && rel!=='..' && !rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
const portable=value=>typeof value==='string'&&/^[a-zA-Z0-9_./-]+$/.test(value)&&!path.isAbsolute(value)&&!value.split('/').some(p=>!p||p==='.'||p==='..');
// Compare real locations even when a target's parent is a symlink or does not exist.
function physicalPath(file) {
  let ancestor=path.resolve(file),tail=[];
  while(!fs.existsSync(ancestor)) {
    const parent=path.dirname(ancestor);if(parent===ancestor)break;
    tail.unshift(path.basename(ancestor));ancestor=parent;
  }
  return path.join(fs.realpathSync(ancestor),...tail);
}
const overlaps=(a,b)=>a===b||inside(a,b)||inside(b,a);
function buildProject(configFile,{write=true,deploy=true,sourceOverrides=[]}={}) {
  configFile=path.resolve(configFile);
  const root=path.dirname(configFile),config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  if(config.schemaVersion!==1 || !['mod','game'].includes(config.kind))throw new Error('Expected schemaVersion 1, kind mod or game');
  if(!config.outDir || !Array.isArray(config.units)||!config.units.length)throw new Error('outDir and nonempty units required');
  const external=loadDependencies(config,root);
  const outDir=path.resolve(root,config.outDir);
  if(external.dependencies.some(pack=>overlaps(physicalPath(outDir),physicalPath(pack.dir))))throw new Error('Build output overlaps an external dependency');
  if(outDir===root||inside(outDir,root))throw new Error('Output must not contain the source project');
  const outputs=new Map(),folded=new Set(),packs=new Map(),features=new Map(),watchFiles=new Set([configFile,...external.files]),modules=new Map();
  function add(name,value) {
    if(!portable(name)||folded.has(name.toLowerCase()))throw new Error(`Invalid/duplicate output: ${name}`);
    folded.add(name.toLowerCase());outputs.set(name,value);
  }
  for(const unit of config.units) {
    const result=buildModules(configFile,{sourceMaps:true,...unit,sourceOverrides,externalModules:external.bindings,outDir:config.outDir});
    for(const module of result.moduleIndex)modules.set(module.id,module);
    for(const file of [...result.sourceFiles,result.tsconfig])watchFiles.add(file);
    for(const [id,set] of result.features) {const union=features.get(id)||new Set();for(const item of set)union.add(item);features.set(id,union);}
    for(const pack of unit.packs) {
      const source=fs.realpathSync(path.resolve(root,pack.root));
      if(source===outDir||inside(source,outDir)||inside(outDir,source))throw new Error('Output and source roots overlap');
      const old=packs.get(pack.id);
      const info={...pack,source};
      if(old && (old.source!==source||JSON.stringify(old.manifest)!==JSON.stringify(pack.manifest)))throw new Error(`Inconsistent pack across units: ${pack.id}`);
      packs.set(pack.id,info);
    }
    for(const [file,code] of result.outputs) {
      if(file.endsWith('/modules/__vcts_lualib.lua'))continue;
      const name=`content/${file}`;
      if(outputs.has(name)&&outputs.get(name)===code)continue;
      add(name,code);
    }
  }
  for(const [id,set] of features)if(set.size)add(`content/${id}/modules/__vcts_lualib.lua`,buildMinimalLualibBundle(set,tstl.LuaTarget.LuaJIT,ts.sys));
  for(const [id,pack] of packs) {
    const manifest={id,title:id,version:'0.1.0',creator:'VCTS',dependencies:[...(pack.dependencies||[])],...pack.manifest};
    if(manifest.id!==id)throw new Error(`Manifest ID mismatch: ${id}`);
    add(`content/${id}/package.json`,JSON.stringify(manifest,null,2)+'\n');
  }
  const assetSources=[];
  for(const asset of config.assets||[]) {
    if(!portable(asset.to))throw new Error(`Invalid asset destination: ${asset.to}`);
    const source=path.resolve(root,asset.from);
    assetSources.push(physicalPath(source));
    const excluded=asset.exclude||[];
    if(!Array.isArray(excluded)||excluded.some(name=>!portable(name)))throw new Error(`Invalid asset exclude: ${asset.from}`);
    function copy(file,name,relative='') {
      if(excluded.some(item=>relative===item||relative.startsWith(item+'/')))return;
      const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw new Error(`Asset symlink: ${file}`);
      if(stat.isDirectory())for(const entry of fs.readdirSync(file).sort())copy(path.join(file,entry),`${name}/${entry}`,relative?`${relative}/${entry}`:entry);
      else if(stat.isFile())add(name,fs.readFileSync(file));else throw new Error(`Not a regular asset: ${file}`);
    }
    copy(source,asset.to);
  }
  if(config.kind==='game'||config.test) {
    const project=config.project||{};
    const name=project.name||'vcts_project';
    if(!/^[a-zA-Z0-9_-]+$/.test(name))throw new Error('Portable project.name required');
    const basePacks=project.basePacks||['base',...packs.keys()];
    if(!Array.isArray(basePacks)||basePacks.some(p=>typeof p!=='string'))throw new Error('project.basePacks must be string array');
    add('project.toml',`name=${JSON.stringify(name)}\ntitle=${JSON.stringify(project.title||name)}\nbase_packs=${JSON.stringify([...new Set([...basePacks,...external.dependencies.map(p=>p.id)])])}\npermissions=${JSON.stringify(project.permissions||[])}\n`);
  }
  const index={schemaVersion:1,kind:config.kind,units:config.units.map(unit=>({tsconfig:unit.tsconfig,entries:[...(unit.scripts||[]),...(unit.components||[]),...(unit.generators||[]),...(unit.layouts||[])]})),dependencies:external.dependencies.map(p=>({id:p.id,path:p.dir,version:p.manifest.version,modules:p.modules.map(m=>({id:m.id,declaration:m.declaration,apiVersion:m.apiVersion}))})),modules:[...modules.values()].sort((a,b)=>a.id.localeCompare(b.id))};
  add('project-index.json',JSON.stringify(index,null,2)+'\n');
  const destinations=config.packOutDirs===undefined?{}:config.packOutDirs;
  if(!destinations||typeof destinations!=='object'||Array.isArray(destinations))throw new Error('packOutDirs must map pack IDs to destination directories');
  const deployments=[];
  for(const [id,target] of Object.entries(destinations)) {
    if(!packs.has(id))throw new Error(`Unknown pack in packOutDirs: ${id}`);
    if(typeof target!=='string'||!target.trim())throw new Error(`Invalid pack destination: ${id}`);
    if(/^Users\//.test(target))throw new Error(`Pack ${id}: path starts with Users/. Did you mean /Users/?`);
    const dir=path.resolve(root,target),real=physicalPath(dir),projectRoot=physicalPath(root);
    if(real===projectRoot||inside(real,projectRoot)||overlaps(real,physicalPath(outDir)))throw new Error(`Pack destination overlaps project/build: ${id}`);
    if(external.dependencies.some(pack=>overlaps(real,physicalPath(pack.dir))))throw new Error(`Pack destination overlaps an external dependency: ${id}`);
    if([...packs.values()].some(pack=>overlaps(real,pack.source))||assetSources.some(source=>overlaps(real,source)))throw new Error(`Pack destination overlaps source/resources: ${id}`);
    if([...watchFiles].some(file=>physicalPath(file)===real||inside(real,physicalPath(file))))throw new Error(`Pack destination contains an input file: ${id}`);
    if(deployments.some(item=>overlaps(real,item.real)))throw new Error(`Pack destinations overlap: ${id}`);
    const prefix=`content/${id}/`;
    deployments.push({id,outDir:dir,real,outputs:new Map([...outputs].filter(([name])=>name.startsWith(prefix)).map(([name,value])=>[name.slice(prefix.length),value]))});
  }
  const result={outputs,outDir,config,configFile,index,watchFiles:[...watchFiles],deployments,externalDependencies:external.dependencies};
  if(write){const commits=[prepareBuild(result),...(deploy?deployments.map(item=>prepareBuild(item)):[])];for(const commit of commits)commit();}
  return result;
}
module.exports={buildProject,portable};
