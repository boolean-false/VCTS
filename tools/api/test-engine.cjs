const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {buildModules} = require('../vc-modules.cjs');
const {writeBuild} = require('../build-modules.cjs');
const {inventory,report} = require('./inventory.cjs');
const {resolveRuntime} = require('../vc-runtime.cjs');
const root = path.resolve(__dirname,'../..');
const project = path.join(root,'build/direct');
const data = report(inventory()).data;
const compiled = buildModules(path.join(root,'examples/direct/vc.modules.json'));
const outputs = new Map([...compiled.outputs].map(([name,code])=>[`content/${name}`,code]));
outputs.set('project.toml','name = "vcts_direct_api"\ntitle = "VCTS direct API tests"\nbase_packs = ["base", "direct"]\n');
outputs.set('content/direct/package.json',JSON.stringify({id:'direct',title:'Direct API tests',version:'0.1.0',creator:'VCTS',dependencies:['base']}));
outputs.set('content/direct/entities/probe.json', JSON.stringify({
  components:[{name:'direct:mover',args:{speed:2}}], hitbox:[1,1,1],
  'body-type':'kinematic', solid:false, save:true
}));
const names = data.symbols.filter(s=>s.declaration).map(s=>s.id);
const memberNames = data.surfaces.objects.filter(s=>s.declaration && /^VC\.(Entity|Transform|Rigidbody|Skeleton)\./.test(s.id)).map(s=>s.id);
// Lookups only: never invoke arbitrary discovered functions.
outputs.set('start.lua', `
app.config_packs({"direct"})
app.new_world("direct-api", "42", "core:default")
local pid = player.create("API Test")
app.set_setting("chunks.load-distance", 3)
app.set_setting("chunks.load-speed", 8)
player.set_pos(pid,0,102,0)
app.sleep_until(function() return block.get(0,100,0) ~= -1 end,10000,20)
local major, minor = vc.get_version()
local names = json.parse(${JSON.stringify(JSON.stringify(names))})
local presence = {}
for _, name in ipairs(names) do
    local value = _G
    for part in name:gmatch("[^.]+") do
        if part == "app" and value == _G then value = app
        elseif type(value) == "table" then value = value[part]
        else value = nil; break end
    end
    presence[name] = type(value) == "function" or ((name == "random.Random" or name=="audio.PCMStream") and type(value)=="table" and type(getmetatable(value).__call)=="function")
end
local cases = require("direct:smoke").run(pid)
for _,name in ipairs(require("direct:extended-smoke").run()) do cases[#cases+1]=name end
local ecs = require("direct:entity-smoke")
local uids = ecs.setup()
local entity = entities.get(uids[1])
local objects = {Entity=entity,Transform=entity.transform,Rigidbody=entity.rigidbody,Skeleton=entity.skeleton}
local memberPresence = {}
for _, name in ipairs(json.parse(${JSON.stringify(JSON.stringify(memberNames))})) do
    local object, method = name:match("^VC%.([^.]+)%.([^.]+)$")
    memberPresence[name] = type(objects[object][method]) == "function"
end
app.sleep_until(ecs.ready,10000,20)
ecs.freeze()
app.sleep_until(ecs.deadGone,10000,20)
ecs.beforeSave()
app.close_world(true)
app.open_world("direct-api")
player.set_pos(pid,0,102,0)
app.sleep_until(ecs.loaded,10000,20)
for _, name in ipairs(ecs.afterLoad()) do cases[#cases+1] = name end
file.write("world:api-evidence.json",json.tostring({version={major,minor},headless=vc.is_headless(),cases=cases,presence=presence,memberPresence=memberPresence}))
app.close_world(true)
print("VCTS_DIRECT_API_PASS")
`);
writeBuild({outputs,outDir:project});
const runtime = resolveRuntime();
const executable = runtime.executable;
const user = fs.mkdtempSync(path.join(os.tmpdir(),'vcts-api-'));
const logDir = path.join(root,'build/logs'); fs.mkdirSync(logDir,{recursive:true});
fs.rmSync(path.join(logDir,'direct-api-evidence.json'),{force:true});
try {
  const run = spawnSync(executable,['--headless','--res',runtime.resources,'--dir',user,'--project',project,'--script',path.join(project,'start.lua')],
    {cwd:user,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
  const log = (run.stdout||'')+(run.stderr||'');
  fs.writeFileSync(path.join(logDir,'direct-api.log'),log);
  if(run.error || run.status!==0 || /^\[E\]/m.test(log) || !log.includes('VCTS_DIRECT_API_PASS')) {
    throw new Error(`${run.error?.message || `VC exit ${run.status}`}; see build/logs/direct-api.log\n${log.slice(-6000)}`);
  }
  const evidence=JSON.parse(fs.readFileSync(path.join(user,'worlds/direct-api/api-evidence.json'),'utf8'));
  const missing=data.symbols.filter(s=>s.declaration && s.context!=='client-hud' && !evidence.presence[s.id]);
  if(missing.length) throw new Error(`Declared functions missing in engine: ${missing.map(s=>s.id).join(', ')}`);
  const missingMembers = memberNames.filter(name=>!evidence.memberPresence[name]);
  if(missingMembers.length) throw new Error(`Declared object methods missing in engine: ${missingMembers.join(', ')}`);
  evidence.sourceHashes=data.sourceHashes;
  const digest = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  evidence.runtime = {executable:fs.realpathSync(executable), sha256:digest(executable), manifest:runtime.manifest,
    resources: Object.fromEntries(Object.keys(data.sourceHashes).filter(name=>name.startsWith('res/'))
      .map(name=>[name,fs.existsSync(path.join(runtime.resources,name.slice(4)))?digest(path.join(runtime.resources,name.slice(4))):null]))};
  evidence.runtime.resourceDifferences=Object.keys(evidence.runtime.resources)
    .filter(name=>evidence.runtime.resources[name]!==data.sourceHashes[name]);
  evidence.declarations=Object.fromEntries(data.symbols.filter(s=>s.declaration).map(s=>[s.id,s.declaration.signatures]));
  evidence.objectDeclarations=Object.fromEntries(data.surfaces.objects.filter(s=>s.declaration && /^VC\.(Entity|Transform|Rigidbody|Skeleton)\./.test(s.id)).map(s=>[s.id,s.declaration.signatures]));
  evidence.componentCallbacks=Object.fromEntries(data.surfaces.componentCallbacks.filter(s=>s.declaration).map(s=>[s.id,s.declaration.signatures]));
  evidence.note='Cases exercise selected contracts; presence checks only prove a function exists. Graphical APIs are not invoked.';
  fs.writeFileSync(path.join(logDir,'direct-api-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(`PASS: VC ${evidence.version.join('.')} headless; ${evidence.cases.length} behavioral checks; ${Object.values(evidence.presence).filter(Boolean).length}/${names.length} declared functions present (HUD absence expected).`);
  console.log(`Runtime: ${executable} (manifest ${runtime.manifest?.version || 'unavailable'})`);
  console.log(`Object methods present: ${memberNames.length}; component callback contracts: ${Object.keys(evidence.componentCallbacks).length} (not all exercised).`);
  if(evidence.runtime.resourceDifferences.length) console.log(`Runtime Lua differs from source checkout: ${evidence.runtime.resourceDifferences.join(', ')}`);
} finally {
  fs.rmSync(user,{recursive:true,force:true});
}
