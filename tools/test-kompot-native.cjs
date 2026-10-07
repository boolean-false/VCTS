const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {buildProject}=require('./vcts-project.cjs'),{resolveRuntime}=require('./vc-runtime.cjs');
const root=path.resolve(__dirname,'..');const result=buildProject(path.join(root,'examples/kompot/vcts.config.json'),{deploy:false});
const project=path.join(root,'build/kompot-native');fs.mkdirSync(project,{recursive:true});fs.cpSync(path.join(result.outDir,'content'),path.join(project,'content'),{recursive:true});fs.cpSync(path.join(root,'integrations/kompot/pack'),path.join(project,'content/kompot'),{recursive:true});
fs.writeFileSync(path.join(project,'project.toml'),'name="kompot_ts_test"\ntitle="Kompot TS"\nbase_packs=["base","kompot","kompot_ts"]\n');
fs.writeFileSync(path.join(project,'preview.lua'),`app.config_packs({"base","kompot","kompot_ts"})
app.new_world("kompot_ts_test","1","core:default")
app.sleep(1)
gui.close_menu()
local K=require "kompot:kompot"
local screen=require "kompot_ts:screen"
local mounted
local original_mount=K.mount
K.mount=function(opts) mounted=original_mount(opts); return mounted end
for i=1,2 do
 hud.show_overlay("kompot_ts:panel",false)
 app.sleep(0.7)
 local h=assert(mounted,"layout did not mount")
 assert(#h.app.rt.errors==0,tostring(h.app.rt.errors[1]))
 local button
 for _,p in ipairs(h.app.dl) do if p.text=="Нажато: 0" then button=p end end
 assert(button,"TS button missing")
 local x,y=button.x+button.w/2,button.y+button.h/2
 for _,down in ipairs({false,true,false}) do h.fake_input={x=x,y=y,down=down,inside=true};app.sleep(0.12) end
 assert(screen.observed==1,"TS state did not update")
 assert(#h.app.rt.errors==0,tostring(h.app.rt.errors[1]))
 if i==1 then file.write_bytes("export:kompot-ts.png",gui.screenshot():encode("png")) end
 hud.close("kompot_ts:panel")
 app.sleep(0.2)
 assert(h.disposed and h.app.rt.disposed,"layout did not dispose")
 assert(screen.disposed==i,"TS cleanup did not run exactly once")
end
K.mount=original_mount
print("KOMPOT_TS_NATIVE_PASS")
app.close_world(false)
app.quit()
`);
const user=path.join(root,'build/kompot-native-user');fs.mkdirSync(user,{recursive:true});const runtime=resolveRuntime();
const run=spawnSync(runtime.executable,['--res',runtime.resources,'--dir',user,'--project',project,'--script',path.join(project,'preview.lua')],{cwd:user,encoding:'utf8',timeout:90000,maxBuffer:16*1024*1024});
const log=(run.stdout||'')+(run.stderr||'');fs.mkdirSync(path.join(root,'build/logs'),{recursive:true});fs.writeFileSync(path.join(root,'build/logs/kompot-native.log'),log);if(run.error||run.status!==0||!log.includes('KOMPOT_TS_NATIVE_PASS'))throw new Error(run.error?.message||log.slice(-5000));console.log('PASS Kompot TS in VoxelCore: layout, rendering, click, state, reopen and disposal; screenshot '+path.join(user,'export/kompot-ts.png'));
