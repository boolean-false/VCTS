const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const {emitTypes}=require('./kompot-types.cjs');
const {preparePreview}=require('./kompot-preview.cjs');
const root=path.resolve(__dirname,'..');
async function main(){
 emitTypes({check:true});
 const config=path.join(root,'examples/kompot/vcts.config.json'),source=path.join(root,'examples/kompot/src/kompot_ts/screen.ts'),original=fs.readFileSync(source,'utf8');
 const {runHost,Session}=require('../integrations/kompot-lens/out/src/host');
 const {mapVctsDocument,mapVctsError,cleanupVcts,prepareVcts}=require('../integrations/kompot-lens/out/src/vcts');
 let checks=0;const check=(value,message)=>{assert(value,message);checks++;};
 const preview=await prepareVcts(source,root);
 try{
  for(const lua of [undefined,'luajit']){
   const result=await runHost('render',preview.content,[preview.module],[],preview.overrides,{lua,sandbox:false,projectFile:source});check(result.ok,'module load');const doc=mapVctsDocument(result.previews[0],preview);check(!doc.error,'render without error');check(doc.prims.some(p=>p.text==='Привет, Danila!'),'form state');check(doc.prims.some(p=>p.text==='Нажато: 0'),'initial count');check(doc.source===source&&doc.line===original.split('\n').findIndex(line=>line.startsWith('K.preview'))+1,'preview declaration maps to TS');
   const session=new Session(preview.content,[preview.module],doc.name,preview.overrides,{lua,sandbox:false,projectFile:source});let queued=[],waiter;const next=()=>queued.length?Promise.resolve(queued.shift()):new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('session timeout')),10000);waiter=value=>{clearTimeout(timer);resolve(value);};});session.onDocument=d=>{if(waiter){const w=waiter;waiter=null;w(d);}else queued.push(d);};session.onExit=error=>{if(error)console.error(error);};
   try{let frame=await next();const button=frame.prims.find(p=>p.text==='Нажато: 0');const x=button.x+button.w/2,y=button.y+button.h/2;session.frame(0.02,x,y,true,false,0);await next();session.frame(0.02,x,y,false,false,0);frame=await next();check(frame.prims.some(p=>p.text==='Нажато: 1'),'click callback, state method ABI and recomposition');check(!frame.error,'no hook error after recomposition');}finally{session.dispose();}
  }
 }finally{cleanupVcts(preview);}
 const probes=`\nconst probeState=K.new_state(0);let seen=-1;let cleanups=0;const Probe=K.component(()=>{seen=probeState.value;K.on_dispose(()=>{cleanups++;});K.Text(seen);});const probeApp=K.App.new({content:Probe,measurer:K.text.approx_measurer(),width:120,height:50});probeApp.frame(0);if(seen!==0)throw new Error("initial observation");probeState.value=2;probeApp.frame(0);if((seen as number)!==2)throw new Error("state setter subscription");probeApp.dispose();if(cleanups!==1)throw new Error("dispose callback");\n`;
 const hooks=await preparePreview(config,source,{sourceOverrides:[{file:source,text:original+probes}]});try{const r=await runHost('render',hooks.content,[hooks.module],[],hooks.overrides,{lua:'luajit',sandbox:false});check(r.ok,'metatable observation and cleanup in LuaJIT');}finally{cleanupVcts(hooks);}
 for(const snippet of ['const bad=K.state(0);bad.value="wrong";','const bad=K.form({age:1});bad.age.value="wrong";','UI.Button({on_click:(value:number)=>{}});']){await assert.rejects(preparePreview(config,source,{sourceOverrides:[{file:source,text:original+'\n'+snippet}]}),/not assignable/);checks++;}
 const live=await prepareVcts(source,root,[{file:source,text:original.replace('Danila','Unsaved')}]);try{const r=await runHost('render',live.content,[live.module],[],live.overrides,{sandbox:false});check(r.previews[0].prims.some(p=>p.text==='Привет, Unsaved!'),'unsaved TS rendered');check(fs.readFileSync(source,'utf8')===original,'disk source untouched');}finally{cleanupVcts(live);}
 const errorLine=original.split('\n').findIndex(line=>line.includes('const count'))+1;const broken=await preparePreview(config,source,{sourceOverrides:[{file:source,text:original.replace('const count = K.state(0);','throw new Error("TS_PREVIEW_FAILURE"); const count = K.state(0);')}]});
 try{const result=await runHost('render',broken.content,[broken.module],[],broken.overrides,{lua:'luajit',sandbox:false});const mapped=mapVctsDocument(result.previews[0],broken);check(mapped.error?.includes(source+':'+errorLine+':'),'Lua runtime error maps to TS line');}finally{cleanupVcts(broken);}
 fs.mkdirSync(path.join(root,'build/logs'),{recursive:true});fs.writeFileSync(path.join(root,'build/logs/kompot-summary.json'),JSON.stringify({checks,runtimes:['Kompot Lens bundled Lua','LuaJIT'],additionalChecks:{vscode:'npm run kompot:test:vscode',voxelcore:'npm run kompot:test:native'},limitations:['API declarations cover public annotations, not every dynamic export.']},null,2)+'\n');console.log(`PASS Kompot TS: ${checks} checks (LuaJIT, bundled Lua, types, live overlays, source maps)`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
