const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createProject}=require('../vcts-template.cjs');
const {buildProject}=require('../vcts-project.cjs');
const {watch}=require('../vcts.cjs');
const {explain}=require('../vcts-diagnostics.cjs');
function fixture(t,kind='mod') {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-project-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const dir=path.join(root,'project');createProject(dir,{kind,id:'sample'});
  return {dir,config:path.join(dir,'vcts.config.json'),source:path.join(dir,'src/sample/world.ts')};
}
test('fresh templates build outside toolchain and game selects only its own content',t=>{
  for(const kind of ['mod','game']) {
    const f=fixture(t,kind),result=buildProject(f.config);
    assert(result.outputs.has('content/sample/scripts/world.lua'));
    assert(result.outputs.has('project-index.json'));
    assert(result.outputs.has('content/sample/modules/world.lua.map'));
    assert(result.index.modules.find(m=>m.id==='sample:world').exports.some(e=>e.name==='create'));
    if(kind==='game') {
      assert.deepEqual(result.config.project.basePacks,['sample']);
      assert(result.outputs.has('content/sample/generators/flat.files/script.lua'));
      assert(Buffer.isBuffer(result.outputs.get('content/sample/textures/blocks/floor.png')));
    }
    assert.throws(()=>createProject(f.dir),/already exists/);
  }
});
test('failed compilation, asset collisions and manual edits retain previous output',t=>{
  const f=fixture(t),result=buildProject(f.config);
  const output=path.join(result.outDir,'content/sample/modules/world.lua'),before=fs.readFileSync(output,'utf8');
  const source=fs.readFileSync(f.source,'utf8');fs.writeFileSync(f.source,source+'\nconst broken:number="text";');
  assert.throws(()=>buildProject(f.config),/not assignable/);assert.equal(fs.readFileSync(output,'utf8'),before);
  fs.writeFileSync(f.source,source);
  const config=JSON.parse(fs.readFileSync(f.config));config.assets.push({from:'tests/start.lua',to:'content/sample/modules/world.lua'});fs.writeFileSync(f.config,JSON.stringify(config));
  assert.throws(()=>buildProject(f.config),/duplicate output/);assert.equal(fs.readFileSync(output,'utf8'),before);
  config.assets.pop();fs.writeFileSync(f.config,JSON.stringify(config));fs.writeFileSync(output,'-- manual');
  assert.throws(()=>buildProject(f.config),/Refusing to overwrite/);assert.equal(fs.readFileSync(output,'utf8'),'-- manual');
});
test('Lua diagnostics map to original TypeScript and identify changed source snapshots',async t=>{
  const f=fixture(t),result=buildProject(f.config),lua=result.outputs.get('content/sample/modules/world.lua');
  const line=lua.split('\n').findIndex(l=>l.includes('invalid counter save'))+1;
  const message=`[string "sample:modules/world.lua"]:${line}: error`;
  assert((await explain(message,result.outDir)).includes(`${f.source}:14:`));
  fs.appendFileSync(f.source,'\n// change after build\n');
  assert((await explain(message,result.outDir)).includes('built source snapshot'));
  fs.appendFileSync(path.join(result.outDir,'content/sample/modules/world.lua'),'\n-- manual\n');
  assert((await explain(message,result.outDir)).includes('source map does not match Lua'));
});
test('watch rebuilds new files, preserves output on errors and recovers after repair',async t=>{
  const f=fixture(t);const events=[];
  const stop=watch(f.config,{interval:30,onResult:(error,result)=>events.push({error,result})});t.after(stop);
  const waitFor=async count=>{const start=Date.now();while(events.length<count){if(Date.now()-start>10000)throw new Error('watch timeout');await new Promise(r=>setTimeout(r,25));}};
  assert(events[0].result);
  const added=path.join(f.dir,'src/sample/new.ts');fs.writeFileSync(added,'export const value=42;');await waitFor(2);
  const output=path.join(f.dir,'build/content/sample/modules/new.lua');assert(fs.existsSync(output));
  const before=fs.readFileSync(output,'utf8');fs.writeFileSync(added,'export const value:number="text";');await waitFor(3);
  assert(events[2].error);assert.equal(fs.readFileSync(output,'utf8'),before);
  fs.writeFileSync(added,'export const value=43;');await waitFor(4);assert(events[3].result);assert.notEqual(fs.readFileSync(output,'utf8'),before);
  fs.unlinkSync(added);await waitFor(5);assert(!fs.existsSync(output));
});

test('pack destinations contain only the selected pack; preflight protects both outputs',t=>{
  const f=fixture(t),game=path.join(path.dirname(f.dir),'VoxelCore'),target=path.join(game,'content/sample');
  fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(game,'project.toml'),'existing game');
  fs.mkdirSync(path.join(game,'content/neighbour'),{recursive:true});fs.writeFileSync(path.join(game,'content/neighbour/own.txt'),'neighbour');
  fs.writeFileSync(path.join(target,'notes.txt'),'manual notes');
  const config=JSON.parse(fs.readFileSync(f.config));config.packOutDirs={sample:target};
  fs.mkdirSync(path.join(f.dir,'resources'));fs.writeFileSync(path.join(f.dir,'resources/pixel.png'),Buffer.from([0,255,1]));
  config.assets.push({from:'resources',to:'content/sample/textures'});fs.writeFileSync(f.config,JSON.stringify(config));
  buildProject(f.config,{write:false});assert(!fs.existsSync(path.join(target,'package.json')));
  const result=buildProject(f.config);
  const lua=path.join(target,'modules/world.lua'),localLua=path.join(result.outDir,'content/sample/modules/world.lua');
  assert.equal(fs.readFileSync(lua,'utf8'),fs.readFileSync(localLua,'utf8'));
  assert.deepEqual(fs.readFileSync(path.join(target,'textures/pixel.png')),Buffer.from([0,255,1]));
  assert.equal(fs.readFileSync(path.join(game,'project.toml'),'utf8'),'existing game');
  assert.equal(fs.readFileSync(path.join(game,'content/neighbour/own.txt'),'utf8'),'neighbour');
  assert(!fs.existsSync(path.join(target,'content')));assert(!fs.existsSync(path.join(target,'project.toml')));
  assert(!fs.existsSync(path.join(target,'start.lua')));assert(!fs.existsSync(path.join(target,'project-index.json')));
  const before=fs.readFileSync(localLua,'utf8');fs.appendFileSync(f.source,'\nexport const added=42;');fs.writeFileSync(lua,'-- manual change');
  assert.throws(()=>buildProject(f.config),/Refusing to overwrite/);assert.equal(fs.readFileSync(localLua,'utf8'),before);
  // Test builds do not write installed content, even if it has manual modifications.
  buildProject(f.config,{deploy:false});assert.equal(fs.readFileSync(lua,'utf8'),'-- manual change');
  // Restore the last owned bytes and verify watch/build can recover.
  fs.writeFileSync(lua,before);buildProject(f.config);assert(fs.readFileSync(lua,'utf8').includes('added'));
  const added=path.join(f.dir,'src/sample/temporary.ts');fs.writeFileSync(added,'export const value=1;');buildProject(f.config);
  assert(fs.existsSync(path.join(target,'modules/temporary.lua')));fs.unlinkSync(added);buildProject(f.config);
  assert(!fs.existsSync(path.join(target,'modules/temporary.lua')));assert.equal(fs.readFileSync(path.join(target,'notes.txt'),'utf8'),'manual notes');
});

test('pack destinations reject missing packs, overlaps, source aliases and unowned files',t=>{
  const f=fixture(t),config=JSON.parse(fs.readFileSync(f.config));
  function reject(map,pattern){config.packOutDirs=map;fs.writeFileSync(f.config,JSON.stringify(config));assert.throws(()=>buildProject(f.config),pattern);assert(!fs.existsSync(path.join(f.dir,'build')));}
  reject({missing:'elsewhere'},/Unknown pack/);reject(null,/must map/);reject({sample:''},/Invalid pack/);
  reject({sample:f.dir},/overlaps project/);reject({sample:'build/content/sample'},/overlaps project/);
  reject({sample:'src/sample/output'},/overlaps source/);
  const alias=path.join(f.dir,'source-alias');fs.symlinkSync(path.join(f.dir,'src/sample'),alias,'dir');reject({sample:alias},/overlaps source/);
  const target=path.join(path.dirname(f.dir),'installed');fs.mkdirSync(target);fs.writeFileSync(path.join(target,'package.json'),'manual');reject({sample:target},/Refusing to overwrite/);
  const dangling=path.join(f.dir,'dangling');fs.symlinkSync(path.join(f.dir,'missing-target'),dangling);reject({sample:dangling},/Output symlink/);
});

test('watch updates a pack destination and ignores its generated files inside the workspace',async t=>{
  const f=fixture(t),config=JSON.parse(fs.readFileSync(f.config));config.packOutDirs={sample:'installed/sample'};fs.writeFileSync(f.config,JSON.stringify(config));
  const events=[];const stop=watch(f.config,{interval:30,onResult:(error,result)=>events.push({error,result})});t.after(stop);
  const waitFor=async count=>{const start=Date.now();while(events.length<count){if(Date.now()-start>10000)throw new Error('watch timeout');await new Promise(r=>setTimeout(r,25));}};
  const target=path.join(f.dir,'installed/sample/modules/world.lua');assert(fs.existsSync(target));
  await new Promise(r=>setTimeout(r,120));assert.equal(events.length,1);
  fs.appendFileSync(f.source,'\nexport const changed=7;');await waitFor(2);assert(events[1].result);assert(fs.readFileSync(target,'utf8').includes('changed'));
  await new Promise(r=>setTimeout(r,120));assert.equal(events.length,2);
  const before=fs.readFileSync(target,'utf8');fs.appendFileSync(f.source,'\nconst broken:number="wrong";');await waitFor(3);assert(events[2].error);assert.equal(fs.readFileSync(target,'utf8'),before);
});

function externalFixture(t){
 const f=fixture(t),dependency=path.join(path.dirname(f.dir),'external');fs.mkdirSync(path.join(dependency,'types'),{recursive:true});fs.mkdirSync(path.join(dependency,'modules'));
 fs.writeFileSync(path.join(dependency,'package.json'),JSON.stringify({id:'external',version:'2.0.0',dependencies:[]}));
 fs.writeFileSync(path.join(dependency,'types/api.d.ts'),'export declare const version:1; export declare function double(this:void,value:number):number;');
 fs.writeFileSync(path.join(dependency,'types/vcts.json'),JSON.stringify({schemaVersion:1,modules:{api:{declaration:'api.d.ts',apiVersion:1}}}));
 fs.writeFileSync(path.join(dependency,'modules/api.lua'),'return {version=1,double=function(value) return value*2 end}');
 return {...f,dependency};
}
test('external Lua API resolves in editor and build without copying its source; real VC test stages it',t=>{
 const {connectDependency,testProject}=require('../vcts-dependencies.cjs');const f=externalFixture(t);
 connectDependency(f.config,f.dependency);
 const source='import * as api from "external:api"; export function probe(this:void):number{return api.double(21);} export function create(this:void):VC.WorldCallbacks{return {};}';fs.writeFileSync(f.source,source);
 const result=buildProject(f.config);const lua=result.outputs.get('content/sample/modules/world.lua');
 assert(lua.includes('require("external:api")'));assert(![...result.outputs.keys()].some(n=>n.startsWith('content/external/')));
 assert.equal(result.index.dependencies[0].version,'2.0.0');assert(result.index.modules.find(m=>m.id==='sample:world').imports.includes('external:api'));
 const ts=require('typescript'),file=path.join(f.dir,'tsconfig.json');const config=ts.readConfigFile(file,ts.sys.readFile);const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,f.dir);assert.equal(ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames,parsed.options)).length,0);
 const staged=testProject(result);assert(fs.existsSync(path.join(staged.project,'content/external/modules/api.lua')));const temp=staged.project;staged.dispose();assert(!fs.existsSync(temp));
 fs.writeFileSync(path.join(f.dir,'tests/start.lua'),'app.config_packs({"sample"})\napp.new_world("vcts-smoke","42","core:default")\nassert(require("sample:world").probe()==42,"external dot-call ABI")\nfile.write("world:probe.json",json.tostring({cases={"opaque external Lua API","independent consumer"}}))\napp.close_world(true)\nprint("VCTS_PROJECT_PASS")\n');
 const run=require('node:child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../vcts.cjs'),'test',f.config],{encoding:'utf8',timeout:30000});assert.equal(run.status,0,run.stdout+run.stderr);assert(run.stdout.includes('2 project checks'));
 assert(!fs.existsSync(path.join(result.outDir,'content/external')));assert.equal(fs.readFileSync(path.join(f.dependency,'modules/api.lua'),'utf8'),'return {version=1,double=function(value) return value*2 end}');
});
test('external dependency diagnostics retain output on package/API mismatch and missing runtime',t=>{
 const {connectDependency}=require('../vcts-dependencies.cjs');const f=externalFixture(t);connectDependency(f.config,f.dependency);fs.writeFileSync(f.source,'import * as api from "external:api"; export function create(this:void):VC.WorldCallbacks{api.double(1);return {};}');
 const result=buildProject(f.config),output=path.join(result.outDir,'content/sample/modules/world.lua'),before=fs.readFileSync(output,'utf8');
 const manifest=path.join(f.dependency,'package.json');fs.writeFileSync(manifest,JSON.stringify({id:'external',version:'3.0.0'}));assert.throws(()=>buildProject(f.config),/expected package version 2.0.0/);assert.equal(fs.readFileSync(output,'utf8'),before);
 fs.writeFileSync(manifest,JSON.stringify({id:'external',version:'2.0.0',dependencies:['missing']}));assert.throws(()=>buildProject(f.config),/requires missing dependency missing/);
 fs.writeFileSync(manifest,JSON.stringify({id:'external',version:'2.0.0'}));const metadata=path.join(f.dependency,'types/vcts.json');fs.writeFileSync(metadata,JSON.stringify({schemaVersion:1,modules:{api:{declaration:'api.d.ts',apiVersion:2}}}));assert.throws(()=>buildProject(f.config),/expected API version 1/);
 fs.writeFileSync(metadata,JSON.stringify({schemaVersion:1,modules:{api:{declaration:'api.d.ts',apiVersion:1}}}));fs.unlinkSync(path.join(f.dependency,'modules/api.lua'));assert.throws(()=>buildProject(f.config),/runtime Lua module missing/);
 assert.equal(fs.readFileSync(output,'utf8'),before);
});
test('untyped Lua packs receive an explicit manual contract and probable absolute-path typos are rejected',t=>{
 const {connectDependency,scaffoldTypes}=require('../vcts-dependencies.cjs');const f=externalFixture(t);fs.rmSync(path.join(f.dependency,'types'),{recursive:true});
 assert.throws(()=>connectDependency(f.config,f.dependency),/has no API declarations/);
 const contract=scaffoldTypes(f.config,f.dependency);assert(fs.readFileSync(contract,'utf8').includes('no API shape is guessed'));assert.throws(()=>scaffoldTypes(f.config,f.dependency),/already exist/);
 fs.writeFileSync(contract,'export declare function double(this:void,value:number):number;');fs.writeFileSync(f.source,'import * as api from "external:api"; export function create(this:void):VC.WorldCallbacks{api.double(1);return {};}');buildProject(f.config);
 const config=JSON.parse(fs.readFileSync(f.config));config.packOutDirs={sample:'Users/person/game/content/sample'};fs.writeFileSync(f.config,JSON.stringify(config));assert.throws(()=>buildProject(f.config),/Did you mean \/Users\//);
 delete config.packOutDirs;config.dependencies[0].path='Users/person/game/content/external';fs.writeFileSync(f.config,JSON.stringify(config));assert.throws(()=>buildProject(f.config),/Did you mean \/Users\//);
});

test('adding multiple external modules preserves inherited editor aliases and refreshes version locks',t=>{
 const {connectDependency}=require('../vcts-dependencies.cjs');const f=externalFixture(t);
 fs.mkdirSync(path.join(f.dir,'config'));fs.writeFileSync(path.join(f.dir,'config/base.json'),JSON.stringify({compilerOptions:{baseUrl:'..',ignoreDeprecations:'6.0',paths:{'local/*':['src/sample/*']}}}));
 const tsconfig=path.join(f.dir,'tsconfig.json'),value=JSON.parse(fs.readFileSync(tsconfig));value.extends='./config/base.json';fs.writeFileSync(tsconfig,JSON.stringify(value));
 fs.writeFileSync(path.join(f.dir,'src/sample/helper.ts'),'export const value=3;');
 connectDependency(f.config,f.dependency);
 const manual=path.join(f.dir,'motor.d.ts');fs.writeFileSync(manual,'export declare function run(this:void):number;');fs.writeFileSync(path.join(f.dependency,'modules/motor.lua'),'return {run=function() return 4 end}');
 connectDependency(f.config,f.dependency,{types:manual,module:'motor'});
 fs.writeFileSync(f.source,'import * as api from "external:api";import * as motor from "external:motor";import {value} from "local/helper";export function create(this:void):VC.WorldCallbacks{api.double(value);motor.run();return {};}');
 const ts=require('typescript'),read=ts.readConfigFile(tsconfig,ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(read.config,ts.sys,f.dir);const errors=ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames,parsed.options));assert.equal(errors.length,0,errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('; '));buildProject(f.config);
 fs.writeFileSync(path.join(f.dependency,'package.json'),JSON.stringify({id:'external',version:'2.1.0'}));fs.writeFileSync(path.join(f.dependency,'types/vcts.json'),JSON.stringify({schemaVersion:1,modules:{api:{declaration:'api.d.ts',apiVersion:2}}}));
 connectDependency(f.config,f.dependency);const result=buildProject(f.config);assert.equal(result.config.dependencies[0].version,'2.1.0');assert.equal(result.config.dependencies[0].apiVersions.api,2);assert(result.index.modules.find(m=>m.id==='external:api').exports.some(e=>e.name==='double'));
});

 test('исключения ресурсов позволяют заменить Lua-модуль и сохраняют соседние файлы',t=>{
  const f=fixture(t),config=JSON.parse(fs.readFileSync(f.config));
  const resources=path.join(f.dir,'resources');
  fs.mkdirSync(path.join(resources,'modules'),{recursive:true});
  fs.mkdirSync(path.join(resources,'history'),{recursive:true});
  fs.writeFileSync(path.join(resources,'modules/world.lua'),'return {}');
  fs.writeFileSync(path.join(resources,'modules/keep.lua'),'return {value=5}');
  fs.writeFileSync(path.join(resources,'history/old.txt'),'old');
  config.assets.push({from:'resources',to:'content/sample',exclude:['modules/world.lua','history']});
  fs.writeFileSync(f.config,JSON.stringify(config));
  const result=buildProject(f.config);
  assert.match(result.outputs.get('content/sample/modules/world.lua'),/create/);
  assert.equal(result.outputs.get('content/sample/modules/keep.lua').toString(),'return {value=5}');
  assert(!result.outputs.has('content/sample/history/old.txt'));
  config.assets.at(-1).exclude=['../outside'];fs.writeFileSync(f.config,JSON.stringify(config));
  assert.throws(()=>buildProject(f.config),/Invalid asset exclude/);
 });

test('project entry loads modules before content and receives the application API',async t=>{
  const f=fixture(t,'game'),config=JSON.parse(fs.readFileSync(f.config));
  const client=JSON.parse(fs.readFileSync(path.join(f.dir,'tsconfig.json')));
  client.include=['vendor/sdk/client.d.ts','src/sample/**/*.ts'];
  client.compilerOptions.paths={...client.compilerOptions.paths,'sample:service':['./src/sample/service.ts']};
  fs.writeFileSync(path.join(f.dir,'tsconfig.json'),JSON.stringify(client));
  fs.writeFileSync(path.join(f.dir,'app.tsconfig.json'),JSON.stringify({...client,include:['vendor/sdk/app-client.d.ts','src/project/**/*.ts']}));
  const dir=path.join(f.dir,'src/project');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'loading.ts'),'const values=[1,2,3]; export const sum=values.reduce((a,b)=>a+b,0);');
  fs.writeFileSync(path.join(dir,'start.ts'),'import {sum} from "./loading"; export function run(this:void,application:typeof app):void { if(sum!==6)throw "loading"; application.tick();application.load_content();const service=vcts_load<typeof import("../sample/service")>("sample:service");if(service.value!==42)throw "service";application.quit();}');
  fs.writeFileSync(path.join(dir,'client.ts'),'export function create(this:void){return {on_menu_setup:()=>{menu.visible=true;}};}');
  fs.writeFileSync(path.join(f.dir,'src/sample/service.ts'),'export const value=42;');
  config.assets=config.assets.filter(asset=>asset.to!=='start.lua');
  config.units[0].packs[0].public=['service.ts'];
  config.units.push({tsconfig:'app.tsconfig.json',packs:[{id:'project',scope:'project',root:'src/project',dependencies:['sample']},config.units[0].packs[0]],applications:[
    {kind:'start',source:'src/project/start.ts',factory:'run'},{kind:'client',source:'src/project/client.ts',factory:'create'},{kind:'module',name:'loading',source:'src/project/loading.ts'}]});
  fs.writeFileSync(f.config,JSON.stringify(config));
  const result=buildProject(f.config);
  assert(result.outputs.has('start.lua'));assert(result.outputs.has('project_client.lua'));assert(result.outputs.has('loading.lua'));
  const startLine=result.outputs.get('modules/start.lua').split('\n').findIndex(line=>line.includes('throw')||line.includes('error('))+1;
  assert((await explain(`[string \"project:modules/start.lua\"]:${startLine}: error`,result.outDir)).includes(path.join(dir,'start.ts')));
  assert(result.outputs.has('modules/loading.lua.map'));assert(result.outputs.has('modules/__vcts_lualib.lua'));
  assert(!result.outputs.has('content/project/package.json'));assert(!result.outputs.get('project.toml').includes('"project"'));
  const {spawnSync}=require('node:child_process');
  const resources=require('../vc-runtime.cjs').resolveRuntime().resources;
  const source=fs.readFileSync(path.join(resources,'scripts/stdmin.lua'),'utf8');
  const section=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)+start.length));
  const quote=value=>{let eq='';while(value.includes(`]${eq}]`))eq+='=';return `[${eq}[${value}]${eq}]`;};
  const sources=[...result.outputs].filter(([name])=>name.endsWith('.lua')).map(([name,code])=>{
    let id=`project:${name}`;
    if(name.startsWith('content/')){const parts=name.slice(8).split('/');id=parts.shift()+':'+parts.join('/');}
    return `sources[ ${quote(id)} ]=${quote(code)}`;
  }).join('\n');
  const lua=`local sources={}\n${sources}\nfile={isfile=function(p)return sources[p]~=nil end,read=function(p)return assert(sources[p],p)end}\n__vc_internals={}\nlocal packEnvs={}\n__vc__pack_envs=packEnvs\nlocal _debug_getinfo=debug.getinfo\n${section('function parse_path(path)','-- Lua has no parallelizm')}\n${section('package = {','function __vc_internals.register_compiler')}\n${section('local __internal_locked = false','function __scripts_cleanup')}\n`+
    `local events={}\nlocal application={tick=function()events[#events+1]='tick'end,load_content=function()packEnvs.sample=setmetatable({},{__index=_G});events[#events+1]='load'end,quit=function()events[#events+1]='quit'end}\n`+
    `local script=assert(loadstring(sources['project:start.lua']));setfenv(script,setmetatable({app=application},{__index=_G}));script();assert(table.concat(events,',')=='tick,load,quit');assert(app==nil);assert(require('project:loading').sum==6);assert(assert(loadstring(sources['project:loading.lua']))()==require('project:loading'));menu={visible=false};assert(loadstring(sources['project:project_client.lua']))();on_menu_setup();assert(menu.visible);`;
  const run=spawnSync(process.env.LUAJIT||'luajit',['-'],{input:lua,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const startFile=path.join(dir,'start.ts'),startSource=fs.readFileSync(startFile,'utf8');
  fs.appendFileSync(startFile,'\napp.tick();');assert.throws(()=>buildProject(f.config),/Передайте его в TS-фабрику/);fs.writeFileSync(startFile,startSource);
  config.packOutDirs.project=path.join(os.tmpdir(),'invalid-project-deploy');fs.writeFileSync(f.config,JSON.stringify(config));
  assert.throws(()=>buildProject(f.config),/cannot be deployed/);
  delete config.packOutDirs.project;config.kind='mod';fs.writeFileSync(f.config,JSON.stringify(config));assert.throws(()=>buildProject(f.config),/Project scope requires game/);
});
