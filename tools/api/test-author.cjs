const path=require('node:path');
const {buildModules}=require('../vc-modules.cjs');
const {writeBuild}=require('../build-modules.cjs');
const {inventory,report}=require('./inventory.cjs');
const {runHeadless}=require('./headless.cjs');
const root=path.resolve(__dirname,'../..'),project=path.join(root,'build/author');
const compiled=buildModules(path.join(root,'examples/author/vc.modules.json'));
const outputs=new Map([...compiled.outputs].map(([f,c])=>[`content/${f}`,c]));
outputs.set('project.toml','name="author_probe"\nbase_packs=["base","author","authcheck"]\n');
for(const id of ['author','authcheck'])outputs.set(`content/${id}/package.json`,JSON.stringify({id,title:id,version:'0.1.0',creator:'VCTS',dependencies:id==='author'?['base']:['author']}));
outputs.set('start.lua',`app.config_packs({"author","authcheck"})
app.new_world("author-api","42","core:default")
local cases=require("authcheck:smoke").run()
file.write("world:author-evidence.json",json.tostring({cases=cases}))
app.close_world(true)
print("VCTS_AUTHOR_PASS")
`);
writeBuild({outputs,outDir:project});
const evidence=runHeadless({project,marker:'VCTS_AUTHOR_PASS',evidencePath:'worlds/author-api/author-evidence.json',logName:'author',inventory:report(inventory()).data});
console.log(`PASS: ${evidence.cases.length} author-layer checks on VC ${evidence.runtime.manifest.version}`);
