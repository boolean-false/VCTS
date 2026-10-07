const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const moduleName=name=>typeof name==='string'&&/^[A-Za-z0-9_/-]+$/.test(name)&&!name.split('/').some(p=>!p||p==='.'||p==='..')&&name!=='__vcts_lualib';
const packId=id=>typeof id==='string'&&/^[A-Za-z_][A-Za-z0-9_]{1,23}$/.test(id);
function readJson(file,label){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){throw new Error(`${label}: ${file}: ${error.message}`);}}
function readPack(dir){
 dir=path.resolve(dir);const manifest=readJson(path.join(dir,'package.json'),'Cannot read dependency package');
 const id=manifest.id||path.basename(dir);if(!packId(id))throw new Error(`Invalid dependency pack ID: ${id}`);
 return {id,dir,manifest};
}
function loadDependencies(config,root){
 if(config.dependencies!==undefined&&!Array.isArray(config.dependencies))throw new Error('dependencies must be an array of {id, path}');
 const dependencies=[],bindings=[],files=[],ids=new Set();
 for(const entry of config.dependencies||[]){
  if(!entry||!packId(entry.id)||typeof entry.path!=='string'||!entry.path.trim())throw new Error('Dependency requires a valid id and nonempty path');
  if(/^Users\//.test(entry.path))throw new Error(`Dependency ${entry.id}: path starts with Users/. Did you mean /Users/?`);
  const pack=readPack(path.resolve(root,entry.path));
  if(pack.id!==entry.id)throw new Error(`Dependency ID mismatch: expected ${entry.id}, found ${pack.id}`);
  if(ids.has(pack.id.toLowerCase()))throw new Error(`Duplicate dependency: ${pack.id}`);ids.add(pack.id.toLowerCase());
  if(entry.version!==undefined&&entry.version!==pack.manifest.version)throw new Error(`Dependency ${pack.id}: expected package version ${entry.version}, found ${pack.manifest.version}; review the API and rerun vcts add to update`);
  const metadataFile=path.join(pack.dir,'types/vcts.json');
  const metadata=fs.existsSync(metadataFile)?readJson(metadataFile,'Invalid API metadata'):{schemaVersion:1,modules:fs.existsSync(path.join(pack.dir,'types/api.d.ts'))?{api:{declaration:'api.d.ts'}}:{}};
  if(metadata.schemaVersion!==1||!metadata.modules||typeof metadata.modules!=='object'||Array.isArray(metadata.modules))throw new Error(`Dependency ${pack.id}: expected types/vcts.json schemaVersion 1 and modules object`);
  files.push(path.join(pack.dir,'package.json'));if(fs.existsSync(metadataFile))files.push(metadataFile);
  for(const field of ['types','apiVersions'])if(entry[field]!==undefined&&(!entry[field]||typeof entry[field]!=='object'||Array.isArray(entry[field])))throw new Error(`Dependency ${pack.id}: ${field} must be an object`);
  const definitions={...metadata.modules};
  for(const [name,declaration] of Object.entries(entry.types||{}))definitions[name]={...(definitions[name]||{}),declaration,custom:true};
  for(const [name,expected] of Object.entries(entry.apiVersions||{}))if(definitions[name]?.apiVersion!==expected)throw new Error(`Dependency ${pack.id}:${name}: expected API version ${expected}, found ${definitions[name]?.apiVersion??'unknown'} (types/vcts.json)`);
  pack.modules=[];
  for(const [name,definition] of Object.entries(definitions)){
   if(!moduleName(name)||!definition||typeof definition.declaration!=='string')throw new Error(`Invalid dependency module: ${pack.id}:${name}`);
   const declaration=path.resolve(definition.custom?root:path.join(pack.dir,'types'),definition.declaration);
   const rel=path.relative(path.join(pack.dir,'types'),declaration);
   if(!definition.custom&&(path.isAbsolute(definition.declaration)||rel==='..'||rel.startsWith('..'+path.sep)))throw new Error(`Dependency ${pack.id}:${name}: packaged declarations must stay inside types/`);
   if(!declaration.endsWith('.d.ts')||!fs.existsSync(declaration))throw new Error(`Dependency ${pack.id}:${name}: declaration missing: ${declaration}. Use vcts types or vcts add --types`);
   const source=path.join(pack.dir,'modules',name+'.lua');if(!fs.existsSync(source))throw new Error(`Dependency ${pack.id}:${name}: runtime Lua module missing: ${source}`);
   const binding={id:pack.id+':'+name,declaration:fs.realpathSync(declaration),source,packId:pack.id,apiVersion:definition.apiVersion};
   bindings.push(binding);pack.modules.push(binding);files.push(source,declaration);
  }
  dependencies.push(pack);
 }
 const local=new Set(config.units.flatMap(unit=>unit.packs.map(pack=>pack.id)));
 for(const dependency of dependencies)if([...local].some(id=>id.toLowerCase()===dependency.id.toLowerCase()))throw new Error(`Pack ${dependency.id} is both a source pack and an external dependency`);
 const known=new Set([...local,...dependencies.map(p=>p.id),'base','core']);
 for(const pack of [...config.units.flatMap(u=>u.packs),...dependencies.map(p=>({...p.manifest,id:p.id}))])for(const id of pack.dependencies||[])if(!known.has(id))throw new Error(`Pack ${pack.id} requires missing dependency ${id}; use vcts add <pack-folder>`);
 return {dependencies,bindings,files};
}
function connectDependency(configFile,folder,{types,module='api',resources=false}={}){
 const root=path.dirname(configFile),config=readJson(configFile,'Invalid project config'),pack=readPack(folder);
 const previous=(config.dependencies||[]).find(item=>item.id===pack.id);
 const entry={...previous,id:pack.id,path:path.relative(root,pack.dir)||'.'};
 delete entry.apiVersions;
 if(typeof pack.manifest.version==='string')entry.version=pack.manifest.version;
 if(types){if(!moduleName(module))throw new Error(`Invalid module name: ${module}`);entry.types={...entry.types,[module]:path.relative(root,path.resolve(types))};}
 const updated=[...(config.dependencies||[]).filter(item=>item.id!==pack.id),entry];
 const candidate={...config,dependencies:updated};
 for(const unit of candidate.units)for(const own of unit.packs)own.dependencies=[...new Set([...(own.dependencies||[]),pack.id])];
 const loaded=loadDependencies(candidate,root),selected=loaded.dependencies.find(p=>p.id===pack.id);
 if(!selected.modules.length&&!resources)throw new Error(`Pack ${pack.id} has no API declarations. Use vcts types <pack-folder>, vcts add <pack-folder> --types <api.d.ts>, or --resources for a content-only dependency`);
 entry.apiVersions=Object.fromEntries(selected.modules.filter(m=>m.apiVersion!==undefined).map(m=>[m.id.slice(pack.id.length+1),m.apiVersion]));
 // Update all editor programs too; build independently resolves the same bindings.
 const edits=[];
 for(const file of new Set(candidate.units.map(unit=>path.resolve(root,unit.tsconfig)))){
  const read=require('typescript').readConfigFile(file,require('typescript').sys.readFile);
  if(read.error)throw new Error(`Cannot read tsconfig: ${file}`);
  const ts=require('typescript'),parsed=ts.parseJsonConfigFileContent(read.config,ts.sys,path.dirname(file));
  if(parsed.errors.length)throw new Error(`Invalid tsconfig: ${file}: ${parsed.errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('; ')}`);
  const value=read.config;value.compilerOptions??={};
  const pathsRoot=parsed.options.baseUrl||path.dirname(file),originalRoot=parsed.options.baseUrl||parsed.options.pathsBasePath||path.dirname(file);
  value.compilerOptions.paths=Object.fromEntries(Object.entries(parsed.options.paths||{}).map(([key,targets])=>[key,targets.map(target=>path.relative(pathsRoot,path.resolve(originalRoot,target)).split(path.sep).join('/'))]));
  for(const key of Object.keys(value.compilerOptions.paths))if(key.startsWith(pack.id+':'))delete value.compilerOptions.paths[key];
  for(const binding of loaded.bindings)value.compilerOptions.paths[binding.id]=[path.relative(pathsRoot,binding.declaration).split(path.sep).join('/')];
  edits.push([file,JSON.stringify(value,null,2)+'\n']);
 }
 for(const [file,value] of edits)fs.writeFileSync(file,value);
 fs.writeFileSync(configFile,JSON.stringify(candidate,null,2)+'\n');return selected;
}
function scaffoldTypes(configFile,folder,module='api'){
 const root=path.dirname(configFile),pack=readPack(folder);if(!moduleName(module))throw new Error(`Invalid module name: ${module}`);
 const lua=path.join(pack.dir,'modules',module+'.lua');if(!fs.existsSync(lua))throw new Error(`Lua API missing: ${lua}`);
 const file=path.join(root,'vendor/external',pack.id,module+'.d.ts');if(fs.existsSync(file))throw new Error(`Types already exist: ${file}; edit them or use vcts add --types`);
 const source=fs.readFileSync(lua,'utf8');const hints=[...new Set([...source.matchAll(/(?:function\s+\w+[.:]|\b\w+\.)([A-Za-z_]\w*)\s*(?:\(|=\s*function)/g)].map(m=>m[1]))].slice(0,100);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,`// Manual contract for ${pack.id}:${module}. Lua source: ${lua}\n// Lua table functions normally need this:void; object methods may need self.\n// Example: export declare function name(this:void, value:number):boolean;\n// Multiple returns: LuaMultiReturn<[number,string]> (requires SDK extensions).\n// Possible names found by text scan (NOT validated exports): ${hints.join(', ')||'none'}\n// Fill in actual public signatures; no API shape is guessed automatically.\nexport {};\n`);
 connectDependency(configFile,folder,{types:file,module});return file;
}
function testProject(result){
 if(!result.externalDependencies?.length)return {project:result.outDir,dispose:()=>{}};
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-dependency-project-'));
 try{fs.cpSync(result.outDir,dir,{recursive:true});for(const pack of result.externalDependencies)fs.cpSync(pack.dir,path.join(dir,'content',pack.id),{recursive:true});}
 catch(error){fs.rmSync(dir,{recursive:true,force:true});throw error;}
 return {project:dir,dispose:()=>fs.rmSync(dir,{recursive:true,force:true})};
}
module.exports={loadDependencies,connectDependency,scaffoldTypes,testProject};
