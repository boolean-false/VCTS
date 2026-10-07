const path=require('node:path');
const {buildModules}=require('../vc-modules.cjs');
const {writeBuild}=require('../build-modules.cjs');
const {inventory,report}=require('./inventory.cjs');
const {runHeadless}=require('./headless.cjs');
const root=path.resolve(__dirname,'../..');
const project=path.join(root,'build/generation');
const outputs=new Map();
for(const name of ['generator','probe']) {
  for(const [file,code] of buildModules(path.join(root,`examples/generation/${name}.modules.json`)).outputs) {
    if(outputs.has(`content/${file}`))throw new Error(`Duplicate output: ${file}`);
    outputs.set(`content/${file}`,code);
  }
}
outputs.set('project.toml','name = "vcts_generator_api"\ntitle = "VCTS generator API tests"\nbase_packs = ["base", "genprobe", "gencheck"]\n');
for(const id of ['genprobe','gencheck'])outputs.set(`content/${id}/package.json`,JSON.stringify({id,title:id,version:'0.1.0',creator:'VCTS',dependencies:['base']}));
outputs.set('content/genprobe/generators/typed.toml','caption = "Typed terrain"\nbiome-parameters = 2\nheightmap-inputs = [1, 2]\nheights-bpd = 1\nbiomes-bpd = 1\n');
outputs.set('content/genprobe/generators/typed.files/biomes.toml','[flat]\nparameters = [{weight=1,value=0.25},{weight=1,value=0.75}]\nlayers = [{height=-1,block="base:stone"}]\n');
outputs.set('content/genprobe/generators/typed.files/structures.toml','');
const data=report(inventory()).data;
const memberNames=data.surfaces.userdata.filter(s=>['Heightmap','VoxelFragment'].includes(s.type)).flatMap(s=>s.declarations).filter(s=>s.declaration).map(s=>s.id);
outputs.set('start.lua',`
app.config_packs({"genprobe","gencheck"})
app.new_world("generation-api","42","genprobe:typed")
local pid=player.create("Generator Test")
app.set_setting("chunks.load-distance",3)
app.set_setting("chunks.load-speed",8)
player.set_pos(pid,0,105,0)
app.sleep_until(function() return block.get(0,10,0) ~= -1 and block.get(2,100,2) ~= -1 end,10000,20)
local cases=require("gencheck:smoke").run()
local objects={Heightmap=Heightmap(1,1),VoxelFragment=generation.load_fragment("world:fragment.vox")}
local presence={}
for _,name in ipairs(json.parse(${JSON.stringify(JSON.stringify(memberNames))})) do
  local object,method=name:match("^VC%.([^.]+)%.([^.]+)$")
  presence[name]=type(objects[object][method])=="function"
  assert(presence[name],"missing method "..name)
end
file.write("world:generation-evidence.json",json.tostring({cases=cases,presence=presence,generator="genprobe:typed"}))
app.close_world(true)
print("VCTS_GENERATION_PASS")
`);
writeBuild({outputs,outDir:project});
const evidence=runHeadless({project,marker:'VCTS_GENERATION_PASS',evidencePath:'worlds/generation-api/generation-evidence.json',logName:'generation',inventory:data});
console.log(`PASS: VC ${evidence.runtime.manifest.version}; ${evidence.cases.length} generation checks; ${memberNames.length} userdata methods present; TypeScript callbacks executed in generator states.`);
