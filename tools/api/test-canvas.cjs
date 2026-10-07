const path=require('node:path');
const {buildModules}=require('../vc-modules.cjs');
const {writeBuild}=require('../build-modules.cjs');
const {inventory,report}=require('./inventory.cjs');
const {runHeadless}=require('./headless.cjs');
const root=path.resolve(__dirname,'../..'),project=path.join(root,'build/canvas');
const compiled=buildModules(path.join(root,'examples/canvas/vc.modules.json'));
const outputs=new Map([...compiled.outputs].map(([f,c])=>[`content/${f}`,c]));
outputs.set('project.toml','name="canvas_probe"\nbase_packs=["base","canprobe"]\n');
outputs.set('content/canprobe/package.json',JSON.stringify({id:'canprobe',title:'Canvas test',version:'0.1.0',creator:'VCTS',dependencies:['base']}));
outputs.set('start.lua',`app.config_packs({"canprobe"})
app.new_world("canvas-api","42","core:default")
local cases=require("canprobe:smoke").run()
file.write("world:canvas-evidence.json",json.tostring({cases=cases}))
app.close_world(true)
print("VCTS_CANVAS_PASS")
`);
writeBuild({outputs,outDir:project});
const evidence=runHeadless({project,marker:'VCTS_CANVAS_PASS',evidencePath:'worlds/canvas-api/canvas-evidence.json',logName:'canvas',inventory:report(inventory()).data});
console.log(`PASS: ${evidence.cases.length} native CPU Canvas checks on VC ${evidence.runtime.manifest.version}`);
