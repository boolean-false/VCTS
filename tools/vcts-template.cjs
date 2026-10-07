const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function createProject(destination,{kind='mod',id='hello'}={}) {
  if(!['mod','game'].includes(kind)||!/^[a-zA-Z_][a-zA-Z0-9_]{1,23}$/.test(id))throw new Error('Use kind mod/game and a portable pack ID (2–24 characters)');
  destination=path.resolve(destination);
  if(fs.existsSync(destination))throw new Error(`Destination already exists: ${destination}`);
  const files=new Map();
  const json=value=>JSON.stringify(value,null,2)+'\n';
  files.set('package.json',json({name:`${id}-vc-project`,version:'0.1.0',private:true,scripts:{build:'vcts build',check:'vcts check',watch:'vcts watch',test:'vcts test'},devDependencies:{'@vcts/toolchain':`file:${root}`}}));
  files.set('.gitignore','node_modules/\nbuild/\n');
  files.set('tsconfig.json',json({compilerOptions:{target:'ESNext',module:'ESNext',moduleResolution:'Bundler',lib:['ES2022'],types:[],strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true},include:['vendor/sdk/headless.d.ts','src/**/*.ts']}));
  files.set('vcts.config.json',json({schemaVersion:1,kind,outDir:'build',$comment:`packOutDirs: укажите папку пака в игре. Пример: {"${id}": "../VoxelCore/content/${id}"}. Путь относительно этого конфига или абсолютный. Пустой объект — только локальная сборка.`,packOutDirs:{},project:{name:`${id}_game`,title:`${id} VoxelCore project`,basePacks:['base',id]},units:[{tsconfig:'tsconfig.json',packs:[{id,root:`src/${id}`,dependencies:['base'],manifest:{title:id,version:'0.1.0',creator:'You'}}],scripts:[{id:`${id}:world`,kind:'world',source:`src/${id}/world.ts`,factory:'create'}]}],assets:[{from:'tests/start.lua',to:'start.lua'}],test:{script:'start.lua',marker:'VCTS_PROJECT_PASS',evidencePath:'worlds/vcts-smoke/probe.json'}}));
  files.set(`src/${id}/lib/core.ts`,fs.readFileSync(path.join(root,'sdk/author/core.ts'),'utf8'));
  files.set(`src/${id}/world.ts`,`import {Scope,Scheduler,Store,EventBus} from "./lib/core";
type Counter={ticks:number};
type GameEvents={changed:[ticks:number]};
export function create(this:void,_context:VC.ScriptContext):VC.WorldCallbacks {
  const clock=new Scheduler(),bus=new EventBus<GameEvents>();
  let scope:Scope|undefined,store:Store<Counter>|undefined;
  let previous=0;
  return {
    on_world_open:()=>{
      clock.clear();scope=new Scope();previous=time.uptime();
      store=new Store("world:${id}-state.json",{
        version:1,
        decode:value=>{
          if(typeof value!=="object"||value===null||!("ticks" in value)||typeof value.ticks!=="number"||!Number.isInteger(value.ticks)||value.ticks<0)throw new Error("invalid counter save");
          return {ticks:value.ticks};
        },
        encode:value=>({ticks:value.ticks})
      },{ticks:0});
      bus.on("changed",ticks=>{store!.value.ticks=ticks;},scope);
      clock.every(0.05,()=>bus.emit("changed",store!.value.ticks+1),scope);
    },
    on_world_tick:()=>{const now=time.uptime();clock.tick(now-previous);previous=now;},
    on_world_save:()=>store?.save(),
    on_world_quit:()=>{scope?.dispose();scope=undefined;store=undefined;clock.clear();}
  };
}
`);
  files.set('tests/start.lua',`app.config_packs({${JSON.stringify(id)}})
app.new_world("vcts-smoke","42","core:default")
app.sleep(0.25)
app.save_world()
local first=json.parse(file.read("world:${id}-state.json"))
assert(first.version==1 and first.data.ticks>0,"typed lifecycle/scheduler/save did not run")
app.close_world(true)
app.open_world("vcts-smoke")
app.save_world()
local second=json.parse(file.read("world:${id}-state.json"))
assert(second.data.ticks>=first.data.ticks,"saved state not restored")
file.write("world:probe.json",json.tostring({cases={"world callbacks","typed events","scoped timer","versioned save","world reload"},ticks=second.data.ticks,kind=${JSON.stringify(kind)}}))
app.close_world(true)
print("VCTS_PROJECT_PASS")
`);
  if(kind==='game') {
    const config=JSON.parse(files.get('vcts.config.json'));
    config.project.basePacks=[id];config.units[0].packs[0].dependencies=[];
    const tsconfig=JSON.parse(files.get('tsconfig.json'));tsconfig.exclude=[`src/${id}/generator/**`];files.set('tsconfig.json',json(tsconfig));
    files.set('generator.tsconfig.json',json({compilerOptions:tsconfig.compilerOptions,include:['vendor/sdk/generator.d.ts',`src/${id}/generator/**/*.ts`]}));
    config.units.push({tsconfig:'generator.tsconfig.json',packs:[{...config.units[0].packs[0]}],generators:[{id:`${id}:flat`,source:`src/${id}/generator/terrain.ts`,factory:'create'}]});
    config.assets.push({from:`content/${id}`,to:`content/${id}`});files.set('vcts.config.json',json(config));
    files.set(`src/${id}/generator/terrain.ts`,`export function create(this:void,_context:VC.GeneratorContext):VC.GeneratorCallbacks {\n  return {generate_heightmap:(_x,_z,width,depth)=>{const map=Heightmap(width,depth);map.add(0.25);return map;}};\n}\n`);
    files.set(`content/${id}/blocks/floor.json`,json({texture:`${id}:floor`}));
    files.set(`content/${id}/generators/flat.toml`,'caption="Flat terrain"\nbiome-parameters=0\n');
    files.set(`content/${id}/generators/flat.files/biomes.toml`,`[flat]\nparameters=[]\nlayers=[{height=-1,block="${id}:floor"}]\n`);
    files.set(`content/${id}/generators/flat.files/structures.toml`,'');
    // A solid 16x16 PNG owned by the template (no dependency on base-pack textures).
    const zlib=require('node:zlib');
    const crc=data=>{let value=0xffffffff;for(const byte of data){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;};
    const chunk=(tag,data)=>{const type=Buffer.from(tag),size=Buffer.alloc(4),check=Buffer.alloc(4);size.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,check]);};
    const header=Buffer.alloc(13);header.writeUInt32BE(16,0);header.writeUInt32BE(16,4);header[8]=8;header[9]=6;
    const rows=Buffer.alloc(16*(1+16*4));for(let y=0;y<16;y++)for(let x=0;x<16;x++){const offset=y*65+1+x*4;rows[offset]=65;rows[offset+1]=105;rows[offset+2]=135;rows[offset+3]=255;}
    files.set(`content/${id}/textures/blocks/floor.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
    const test=files.get('tests/start.lua').replace('"core:default"',JSON.stringify(`${id}:flat`));
    const terrainCheck=`local pid=player.create("Template Test")\nplayer.set_pos(pid,0,100,0)\napp.set_setting("chunks.load-distance",2)\napp.set_setting("chunks.load-speed",8)\napp.sleep_until(function() return block.get(0,10,0)~=-1 end,10000,20)\nassert(block.get(0,10,0)==block.index("${id}:floor"),"own terrain not generated")\nassert(not pack.is_installed("base"),"base pack leaked into standalone game")\n`;
    files.set('tests/start.lua',test.replace('app.sleep(0.25)',terrainCheck+'app.sleep(0.25)').replace('"world reload"','"world reload","own typed terrain","base pack excluded"'));
  }
  files.set('README.md',`# ${id}\n\nTypeScript project for VoxelCore 0.32.1.\n\nStart with [VCTS_GUIDE.md](VCTS_GUIDE.md), including external Lua API dependencies.\n\nInstall dependencies with \`npm install\`, then use \`npm run check\`, \`npm run build\`, \`npm run watch\`, \`npm test\`.\n\nContent for installation is in \`build/content/${id}\`. ${kind==='game'?'Launch VC with --project pointing to build. project.basePacks selects the content used by your game.':'The generated project.toml is a test harness; install the content pack in your game.'}\n\nTo update a pack directly in your game, fill in the generated \`packOutDirs\` in vcts.config.json, mapping the pack ID to its exact directory, e.g. {"${id}": "/path/to/VoxelCore/content/${id}"}. Paths may be absolute or relative to the config. build and watch update selected packs; check and test do not write to these destinations. Use a new destination: existing files and manual changes are protected. The full test project stays in outDir.\n\nEach world opens its own Scope and Store. Persist only schema-validated values; dispose listeners and timers on quit.\n\nThe development toolchain points to ${root}. Change the file dependency when moving it to another computer. API declarations are vendored under vendor/sdk.\n`);
  function sdk(directory,prefix='vendor/sdk') {
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
      if(entry.isDirectory() && entry.name==='api')sdk(path.join(directory,entry.name),`${prefix}/${entry.name}`);
      else if(entry.isFile()&&entry.name.endsWith('.d.ts'))files.set(`${prefix}/${entry.name}`,fs.readFileSync(path.join(directory,entry.name)));
    }
  }
  sdk(path.join(root,'sdk'));
  files.set('vendor/sdk/language-extensions.d.ts',fs.readFileSync(path.join(root,'node_modules/@typescript-to-lua/language-extensions/index.d.ts')));
  files.set('vendor/sdk/api/types.d.ts',files.get('vendor/sdk/api/types.d.ts').toString().replace('/// <reference types="@typescript-to-lua/language-extensions" />','/// <reference path="../language-extensions.d.ts" />'));
  files.set('vendor/sdk/VERSION.json',json({vcts:'1.0.0',voxelcore:'0.32.1',typescriptToLua:'1.37.1',languageExtensions:'1.19.0',languageExtensionsLicense:'MIT'}));
  files.set('VCTS_GUIDE.md',fs.readFileSync(path.join(root,'VCTS_GUIDE.md')));
  files.set('vendor/sdk/AUTHORING.md',fs.readFileSync(path.join(root,'sdk/AUTHORING.md')));
  files.set('vcts.schema.json',fs.readFileSync(path.join(root,'tools/vcts.schema.json')));
  const config=JSON.parse(files.get('vcts.config.json'));config.$schema='./vcts.schema.json';files.set('vcts.config.json',json(config));
  fs.mkdirSync(destination,{recursive:true});
  for(const [name,data] of files){const file=path.join(destination,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);}
  return destination;
}
module.exports={createProject};
