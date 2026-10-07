#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {buildProject}=require('./vcts-project.cjs');
const {createProject}=require('./vcts-template.cjs');
const {connectDependency,scaffoldTypes,testProject}=require('./vcts-dependencies.cjs');
const {runHeadless}=require('./api/headless.cjs');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../sdk/api/inventory.json'),'utf8'));
function builtMessage(result){return `Built ${result.outputs.size} files: ${result.outDir}`+result.deployments.map(item=>`\nPack ${item.id}: ${item.outDir}`).join('');}
function signature(root,outDir,extra=[],packDirs=[]) {
  const files=new Set(extra);
  function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    const name=path.join(dir,entry.name);
    if(name===outDir||packDirs.includes(name)||['node_modules','.git'].includes(entry.name)||entry.isSymbolicLink())continue;
    if(entry.isDirectory())walk(name);else if(entry.isFile())files.add(name);
  }}
  walk(root);const hash=crypto.createHash('sha256');
  for(const file of [...files].sort()){hash.update(file);if(fs.existsSync(file))hash.update(fs.readFileSync(file));}
  return hash.digest('hex');
}
function watch(configFile,{onResult=()=>{},interval=500}={}) {
  const root=path.dirname(path.resolve(configFile));let previous,inputs=[],outDir,packDirs=[];
  const initial=JSON.parse(fs.readFileSync(configFile));outDir=path.resolve(root,initial.outDir);
  packDirs=Object.values(initial.packOutDirs||{}).filter(dir=>typeof dir==='string').map(dir=>path.resolve(root,dir));
  function poll(){
    let current;try{current=signature(root,outDir,inputs,packDirs);}catch(error){onResult(error);return;}
    if(current===previous)return;previous=current;
    try {const result=buildProject(configFile);inputs=result.watchFiles;outDir=result.outDir;packDirs=result.deployments.map(item=>item.outDir);previous=signature(root,outDir,inputs,packDirs);onResult(null,result);}catch(error){onResult(error);}
  }
  poll();const timer=setInterval(poll,interval);return ()=>clearInterval(timer);
}
async function main(args=process.argv.slice(2)) {
  if(!args.length&&process.stdin.isTTY&&process.stdout.isTTY)return require('./vcts-tui.cjs').launchTui();
  const command=args[0]||'help';
  if(command==='ui')return require('./vcts-tui.cjs').launchTui();
  if(command==='preview') {
    const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
    if(!args[1])throw new Error('Use vcts preview <source.ts> [--config config.json] [--overlays overrides.json]');
    const source=path.resolve(args[1]);
    const config=path.resolve(option('--config')||'vcts.config.json');
    const sourceOverrides=option('--overlays')?JSON.parse(fs.readFileSync(option('--overlays'),'utf8')):[];
    if(!Array.isArray(sourceOverrides)||sourceOverrides.some(item=>!item||typeof item.file!=='string'||typeof item.text!=='string'))throw new Error('overlays must be an array of {file,text}');
    console.log(JSON.stringify(await require('./kompot-preview.cjs').preparePreview(config,source,{sourceOverrides})));return;
  }
  if(command==='init') {
    const destination=args[1];if(!destination)throw new Error('Destination required');
    const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
    console.log(`Created ${createProject(destination,{kind:option('--kind')||'mod',id:option('--id')||'hello'})}`);return;
  }
  if(command==='add'||command==='types') {
    if(!args[1])throw new Error('Use vcts add|types <pack-folder> [--config config.json] [--types api.d.ts] [--module api] [--resources]');
    const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined;};
    const config=path.resolve(option('--config')||'vcts.config.json');
    const folder=path.resolve(args[1]);
    if(command==='types')console.log(`Created manual API contract: ${scaffoldTypes(config,folder,option('--module')||'api')}\nFill in the real public signatures before using the API.`);
    else {const pack=connectDependency(config,folder,{types:option('--types'),module:option('--module')||'api',resources:args.includes('--resources')});console.log(`Connected ${pack.id}: ${pack.dir}\nImports: ${pack.modules.map(m=>m.id).join(', ')||'(content only)'}`);}
    return;
  }
  if(['help','--help','-h'].includes(command)){console.log('vcts — интерактивное меню в терминале\nvcts ui — открыть меню явно\nvcts preview <source.ts> [--config config.json] [--overlays overrides.json]\nvcts init <directory> [--kind mod|game] [--id pack]\nvcts build|check|watch|test [vcts.config.json]\nvcts add|types <pack-folder> [--config config.json] [--types api.d.ts] [--module api] [--resources]\nvcts explain <config.json> <log.txt>\nvcts inspect [config.json] [pack:module]');return;}
  const configFile=path.resolve(args[1]||'vcts.config.json');
  if(command==='explain') {
    if(!args[2])throw new Error('Use vcts explain config.json log.txt');
    const config=JSON.parse(fs.readFileSync(configFile));
    console.log(await require('./vcts-diagnostics.cjs').explain(fs.readFileSync(args[2],'utf8'),path.resolve(path.dirname(configFile),config.outDir)));return;
  }
  if(command==='inspect') {
    const {index}=buildProject(configFile,{write:false});
    if(args[2]){const module=index.modules.find(m=>m.id===args[2]);if(!module)throw new Error('Module not found');console.log(JSON.stringify(module,null,2));}
    else console.log(JSON.stringify(index,null,2));return;
  }
  if(command==='watch') {
    const stop=watch(configFile,{onResult:(error,result)=>console.log(error?`Build failed; previous output retained:\n${error.message}`:builtMessage(result))});
    process.on('SIGINT',()=>{stop();process.exit(0);});process.on('SIGTERM',()=>{stop();process.exit(0);});return;
  }
  if(!['build','check','test'].includes(command))throw new Error(`Unknown command: ${command}`);
  const result=buildProject(configFile,{write:command!=='check',deploy:command!=='test'});
  if(command==='test') {
    const test=result.config.test;if(!test?.script||!test.marker||!test.evidencePath)throw new Error('Configure test.script, marker and evidencePath');
    const staged=testProject(result);
    let evidence;try {evidence=runHeadless({project:staged.project,script:test.script,marker:test.marker,evidencePath:test.evidencePath,logName:`project-${path.basename(path.dirname(configFile))}`,inventory:catalog});}catch(error){error.message=await require('./vcts-diagnostics.cjs').explain(error.message,result.outDir);throw error;}finally{staged.dispose();}
    console.log(`PASS: VC ${evidence.runtime.manifest.version}; ${evidence.cases.length} project checks`);
  }else console.log(command==='check'?`Checked ${result.outputs.size} files: ${result.outDir}`:builtMessage(result));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main,watch,signature};
