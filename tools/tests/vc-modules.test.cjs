const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildModules } = require("../vc-modules.cjs");
const { writeBuild } = require("../build-modules.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vcts-modules-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.resolve(__dirname, "../../examples/imports"), root, { recursive: true });
  const manifest = path.join(root, "vc.modules.json");
  const config = JSON.parse(fs.readFileSync(manifest, "utf8"));
  config.outDir = "./out";
  fs.writeFileSync(manifest, JSON.stringify(config));
  return {
    root, config, manifest,
    write(name, text) {
      const file = path.join(root, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    },
    saveConfig() { fs.writeFileSync(manifest, JSON.stringify(config)); },
    build() { return buildModules(manifest); },
  };
}

function luaString(value) {
  let equals = "";
  while (value.includes(`]${equals}]`)) equals += "=";
  return `[${equals}[${value}]${equals}]`;
}

function runInVcLoader(outputs, assertions) {
  const resources = require("../vc-runtime.cjs").resolveRuntime().resources;
  const source = fs.readFileSync(path.join(resources, "scripts/stdmin.lua"), "utf8");
  const section = (start, end) => {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    assert(a >= 0 && b > a, "VC loader layout changed");
    return source.slice(a, b);
  };
  const sources = [...outputs].map(([name, code]) => {
    const slash = name.indexOf("/");
    return `sources[ ${luaString(name.slice(0, slash) + ":" + name.slice(slash + 1))} ] = ${luaString(code)}`;
  }).join("\n");
  const lua = `
local sources = {}
${sources}
file = { isfile = function(p) return sources[p] ~= nil end, read = function(p) return assert(sources[p]) end }
__vc_internals = {}
__vc__pack_envs = {}
for _, id in ipairs({"energy", "workshop"}) do
  __vc__pack_envs[id] = setmetatable({PACK_ID = id}, {__index = _G})
end
local _debug_getinfo = debug.getinfo
${section("function parse_path(path)", "-- Lua has no parallelizm")}
${section("package = {", "function __vc_internals.register_compiler")}
${section("local __internal_locked = false", "function __scripts_cleanup")}
${assertions}
`;
  const run = spawnSync(process.env.LUAJIT || "luajit", ["-"], { input: lua, encoding: "utf8" });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr);
}

test("compiled modules execute with the actual VC require implementation", t => {
  const f = fixture(t);
  f.write("energy/env.ts", "declare const PACK_ID: string; export const pack = PACK_ID;");
  f.write("energy/public.ts", 'export * from "./internal/value.v1"; export { pack } from "./env";');
  f.write("workshop/side.ts", "declare let visits: number | undefined; visits = (visits ?? 0) + 1;");
  f.write("workshop/side-user.ts", 'import "./side"; export const ready = true;');
  const main = fs.readFileSync(path.join(f.root, "workshop/main.ts"), "utf8");
  f.write("workshop/main.ts", main + '\nimport "./side"; import "./side-user"; export const pack = energy.pack;');
  const result = f.build();
  const code = result.outputs.get("workshop/modules/main.lua");
  assert(code.includes('require("energy:public")'));
  assert(code.includes('require("workshop:nested/calculation")'));
  assert(result.outputs.get("energy/modules/public.lua").includes('require("energy:internal/value.v1")'));
  assert(result.outputs.has("workshop/modules/__vcts_lualib.lua"));
  assert(!result.outputs.has("energy/modules/__vcts_lualib.lua"));
  runInVcLoader(result.outputs, `
    local main = require("workshop:main")
    assert(main.remaining == 60 and main.valid)
    assert(main.pack == "energy")
    assert(main.settings == require("energy:public").settings)
    assert(main == require("workshop:main"))
    assert(main.text == 'require("./nested/calculation")')
    assert(__vc_internals.get_pack_env("workshop").visits == 1)
  `);
});

test("type-only circular imports do not become runtime edges", t => {
  const f = fixture(t);
  f.write("workshop/a.ts", 'import type { B } from "./b"; export interface A { b?: B } export const a = 1;');
  f.write("workshop/b.ts", 'import type { A } from "./a"; export interface B { a?: A } export const b = 2;');
  const result = f.build();
  assert.equal(result.graph.get("workshop:a").size, 0);
  assert.equal(result.graph.get("workshop:b").size, 0);
});

test("explicit native binding preserves dot-call ABI and VC module identity", t => {
  const f = fixture(t);
  f.write("energy/native.d.ts", "export declare const api: { add(this: void, a: number, b: number): number };");
  f.write("energy/native.lua", "return {api={add=function(a,b) return a+b end}}");
  f.config.nativeModules = [{id:"energy:native", declaration:"energy/native.d.ts", source:"energy/native.lua"}];
  f.config.packs[0].public.push("native.lua");
  f.saveConfig();
  f.write("workshop/main.ts", 'import { api } from "../energy/native"; export const total = api.add(2, 3);');
  const result = f.build();
  runInVcLoader(result.outputs, 'assert(require("workshop:main").total == 5)');
  f.config.packs[0].public = [];
  f.saveConfig();
  assert.throws(() => f.build(), /private module/);
});

test("native output collisions are rejected before writing", t => {
  const f = fixture(t);
  f.write("energy/a.d.ts", "export const a: number;");
  f.write("energy/b.d.ts", "export const b: number;");
  f.write("energy/native.lua", "return {}");
  f.config.nativeModules = [
    {id:"energy:Native", declaration:"energy/a.d.ts", source:"energy/native.lua"},
    {id:"energy:native", declaration:"energy/b.d.ts", source:"energy/native.lua"},
  ];
  f.saveConfig();
  assert.throws(() => f.build(), /Native module collision/);
  f.config.nativeModules = [{id:"energy:public", declaration:"energy/a.d.ts", source:"energy/native.lua"}];
  f.saveConfig();
  assert.throws(() => f.build(), /Output collision/);
});

test("diagnostics reject unsafe runtime graphs before writing files", async t => {
  const cases = [
    ["missing dependency", f => { f.config.packs[1].dependencies = []; f.saveConfig(); }, /without a declared dependency/],
    ["private module", f => f.write("workshop/main.ts", 'export { capacity } from "../energy/internal/value.v1";'), /private module/],
    ["cycle", f => {
      f.write("workshop/a.ts", 'import "./b"; export const a = 1;');
      f.write("workshop/b.ts", 'import "./a"; export const b = 2;');
    }, /Runtime import cycle: workshop:a -> workshop:b -> workshop:a/],
    ["declaration without runtime", f => {
      f.write("workshop/missing.d.ts", "export const value: number;");
      f.write("workshop/main.ts", 'export { value } from "./missing";');
    }, /no runtime implementation/],
    ["dynamic import", f => f.write("workshop/main.ts", 'export const task = import("./nested/calculation");'), /dynamic import\/require/],
    ["missing module", f => f.write("workshop/main.ts", 'import "./missing"; export const ok = true;'), /resolve|find module/],
    ["module outside packs", f => {
      f.write("unowned.ts", "export const value = 1;");
      f.write("workshop/main.ts", 'export { value } from "../unowned";');
    }, /no pack owner/],
    ["reserved helper name", f => f.write("workshop/__vcts_lualib.ts", "export const value = 1;"), /reserved module name/],
    ["reserved helper specifier", f => {
      f.write("workshop/helper.d.ts", 'declare module "lualib_bundle" { export const value: number; }');
      f.write("workshop/main.ts", 'export { value } from "lualib_bundle";');
    }, /reserved for TSTL helpers/],
  ];
  for (const [name, mutate, expected] of cases) {
    await t.test(name, child => {
      const f = fixture(child);
      mutate(f);
      assert.throws(() => f.build(), expected);
      assert(!fs.existsSync(path.join(f.root, "out")));
    });
  }
});

test("managed output refuses dangling symbolic links", t => {
  const f = fixture(t);
  const result = f.build();
  const target = path.join(f.root, "out/workshop/modules/main.lua");
  const outside = path.join(f.root, "outside.lua");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(outside, target);
  assert.throws(() => writeBuild(result), /Output symlink/);
  assert(!fs.existsSync(outside));
});

test("managed output removes stale files and preserves manual edits and failed builds", t => {
  const f = fixture(t);
  f.write("workshop/temporary.ts", "export const obsolete = true;");
  writeBuild(f.build());
  const stale = path.join(f.root, "out/workshop/modules/temporary.lua");
  assert(fs.existsSync(stale));
  fs.unlinkSync(path.join(f.root, "workshop/temporary.ts"));
  writeBuild(f.build());
  assert(!fs.existsSync(stale));
  const target = path.join(f.root, "out/workshop/modules/main.lua");
  fs.writeFileSync(target, "-- manual edit");
  assert.throws(() => writeBuild(f.build()), /Refusing to overwrite/);
  assert.equal(fs.readFileSync(target, "utf8"), "-- manual edit");
  f.write("workshop/main.ts", "export const broken: number = 'text';");
  assert.throws(() => writeBuild(f.build()), /not assignable/);
  assert.equal(fs.readFileSync(target, "utf8"), "-- manual edit");
});

test("component entries create isolated instances through VC require and retain dot callbacks", t => {
  const f = fixture(t);
  f.write('workshop/component.ts', `
    interface Fields { add(this:void,n:number):void; read(this:void):number; }
    export function create(this:void, ctx:{args:{start:number}}):Fields {
      let value = ctx.args.start;
      return {add:n=>{value+=n;},read:()=>value};
    }
  `);
  f.config.components = [{id:'workshop:counter',source:'workshop/component.ts',factory:'create'}];
  f.saveConfig();
  const result = f.build();
  assert(result.outputs.has('workshop/scripts/components/counter.lua'));
  runInVcLoader(result.outputs, `
    local function instance(start)
      local env = setmetatable({ARGS={start=start},SAVED_DATA={},entity={}}, {__index=_G})
      env.this = env
      local chunk = assert(loadstring(file.read("workshop:scripts/components/counter.lua")))
      setfenv(chunk,env)()
      return env
    end
    local a,b = instance(10),instance(20)
    a.add(3)
    assert(a.read()==13 and b.read()==20)
  `);
});

test("component config rejects unsafe paths, foreign factories, duplicates and missing exports", t => {
  const f = fixture(t);
  f.write('workshop/component.ts','export function create(this:void, ctx:unknown) { return {}; }');
  const good = {id:'workshop:counter',source:'workshop/component.ts',factory:'create'};
  for (const [entry,pattern] of [
    [{...good,id:'workshop:../escape'},/Invalid component ID/],
    [{...good,id:'energy:counter'},/must belong to its pack/],
    [{...good,factory:'missing'},/Missing callable component factory/],
  ]) {
    f.config.components=[entry]; f.saveConfig(); assert.throws(()=>f.build(),pattern);
  }
  f.config.components=[good,{...good,id:'workshop:Counter'}]; f.saveConfig();
  assert.throws(()=>f.build(),/Output collision/);
  f.write('workshop/component.ts','export function create(ctx:unknown) { return {}; }');
  f.config.components=[good]; f.saveConfig();
  assert.throws(()=>f.build(),/explicit this: void/);
});

test('generator entries forward context and reject invalid callbacks',t=>{
  const f=fixture(t);
  f.write('workshop/generator.ts','export function create(this:void,ctx:{seed:number}) { return {generate_heightmap:()=>ctx.seed}; }');
  f.config.generators=[{id:'workshop:terrain',source:'workshop/generator.ts',factory:'create'}];f.saveConfig();
  const result=f.build();
  runInVcLoader(result.outputs,`
    local env=setmetatable({SEED=42,__DIR__="workshop:generators/terrain.files",__FILE__="script.lua"},{__index=_G})
    setfenv(assert(loadstring(file.read("workshop:generators/terrain.files/script.lua"))),env)()
    assert(env.generate_heightmap()==42)
  `);
  f.config.generators[0].id='workshop:../escape';f.saveConfig();assert.throws(()=>f.build(),/Invalid generator ID/);
});

test('layout entries isolate document state and forward dot handlers',t=>{
  const f=fixture(t);
  f.write('workshop/layout.ts',`export function create(this:void,ctx:{document:{name:string},environment:{start:number}}) {
    let value=ctx.environment.start;
    return {on_open:()=>{value++;},read:()=>ctx.document.name+":"+value};
  }`);
  f.config.layouts=[{id:'workshop:panel',source:'workshop/layout.ts',factory:'create'}];f.saveConfig();
  runInVcLoader(f.build().outputs,`
    local function instance(name,start)
      local env=setmetatable({document={name=name},DOC_ENV={start=start}},{__index=_G})
      setfenv(assert(loadstring(file.read("workshop:layouts/panel.xml.lua"))),env)()
      return env
    end
    local a,b=instance("a",10),instance("b",20)
    a.on_open()
    assert(a.read()=="a:11" and b.read()=="b:20")
  `);
});

test('typed UI emits element self calls and native Document metatable dispatch',t=>{
  const f=fixture(t);
  const sdk=path.resolve(__dirname,'../../sdk/client.d.ts');
  f.write('workshop/ui.ts',`/// <reference path=${JSON.stringify(sdk)} />
    export function run(this:void) {
      const doc=Document.new<{title:VC.UIElement}>("workshop:panel");
      doc.title.text="Ready";
      doc.title.destruct();
      return doc.title.text;
    }`);
  const resources=require('../vc-runtime.cjs').resolveRuntime().resources;
  const source=fs.readFileSync(path.join(resources,'modules/internal/gui_util.lua'),'utf8');
  runInVcLoader(f.build().outputs,`
    local attributes={}
    local destroyed=false
    gui={getattr=function(doc,id,key)
      assert(doc=="workshop:panel" and id=="title")
      if key=="destruct" then return function(self) assert(self.docname==doc and self.name==id);destroyed=true end end
      return attributes[key]
    end,setattr=function(doc,id,key,value) assert(doc=="workshop:panel" and id=="title");attributes[key]=value end}
    local actualGui=assert(loadstring(${luaString(source)}))()
    Document=actualGui.Document
    assert(require("workshop:ui").run()=="Ready" and destroyed)
  `);
});

test('отложенная загрузка сохраняет момент инициализации и допускает взаимные обработчики',t=>{
  const f=fixture(t);
  f.write('energy/sdk-deferred.d.ts',fs.readFileSync(path.resolve(__dirname,'../../sdk/api/modules.d.ts'),'utf8'));
  const tsconfig=JSON.parse(fs.readFileSync(path.join(f.root,'tsconfig.json')));
  tsconfig.compilerOptions.paths={...tsconfig.compilerOptions.paths,'energy:*':['./energy/*']};
  f.write('tsconfig.json',JSON.stringify(tsconfig));
  f.write('energy/lazy-a.ts','export const tag="a"; export function read(){return vcts_load<typeof import("./lazy-b")>("energy:lazy-b").owner();}');
  f.write('energy/lazy-b.ts','declare function mark(this:void):void;mark();export function owner(){return vcts_load<typeof import("./lazy-a")>("energy:lazy-a").tag;}');
  const result=f.build();
  const item=result.moduleIndex.find(m=>m.id==='energy:lazy-a');
  assert.deepEqual(item.imports,[]);assert.deepEqual(item.lazyImports,['energy:lazy-b']);
  runInVcLoader(result.outputs,`
    local visits=0;mark=function()visits=visits+1 end
    local a=require('energy:lazy-a');assert(visits==0)
    assert(a.read()=='a' and visits==1)
    assert(a.read()=='a' and visits==1)
  `);
});
test('отложенная загрузка отклоняет вызов при инициализации и вычисляемый ID',t=>{
  const f=fixture(t);
  f.write('energy/sdk-deferred.d.ts',fs.readFileSync(path.resolve(__dirname,'../../sdk/api/modules.d.ts'),'utf8'));
  f.write('energy/lazy.ts','export const value=vcts_load("energy:public");');
  assert.throws(()=>f.build(),/inside a function/);
  f.write('energy/lazy.ts','export function read(id:string){return vcts_load(id);}');
  assert.throws(()=>f.build(),/literal pack:module ID/);
});

test('счётчик for let нельзя захватывать в обработчике',t=>{
  const f=fixture(t);
  f.write('energy/loops.ts','export function values(){const callbacks:(()=>number)[]=[];for(let i=0;i<3;i++)callbacks.push(()=>i);return callbacks.map(fn=>fn());}');
  assert.throws(()=>f.build(),/переменная цикла i захвачена обработчиком/);
  f.write('energy/loops.ts','export function values(){const callbacks:(()=>number)[]=[];for(let i=0;i<3;i++){const index=i;callbacks.push(()=>index);}return callbacks.map(fn=>fn());}');
  const result=f.build();
  runInVcLoader(result.outputs,"local v=require('energy:loops').values();assert(v[1]==0 and v[2]==1 and v[3]==2)");
});

test('общий счётчик и затенение имени сохраняют семантику',t=>{
  const f=fixture(t);
  f.write('energy/loops.ts','export function shared(){const callbacks:(()=>number)[]=[];let i=0;for(i=0;i<3;i++)callbacks.push(()=>i);return callbacks.map(fn=>fn());}export function shadow(){const callbacks:(()=>number)[]=[];for(let i=0;i<3;i++){const read=(i:number)=>i;callbacks.push(()=>read(7));}return callbacks.map(fn=>fn());}');
  const result=f.build();
  runInVcLoader(result.outputs,"local m=require('energy:loops');local a=m.shared();assert(a[1]==3 and a[2]==3 and a[3]==3);local b=m.shadow();assert(b[1]==7 and b[3]==7)");
});

test('объявления через запятую вычисляются последовательно',t=>{
  const f=fixture(t);
  f.write('energy/sequence.ts',`export const first=2, second=first>0?first+1:0;
    export function run(){
      const i=1,row=i<=2?i+1:0,[a,b]=[row,3],sum=a>0?a+b:0;
      let value=1,next=value++>0?value:0;
      const [fallback=3]=[],last=fallback>0?fallback:0;
      return {i,row,sum,value,next,last};
    }`);
  const result=f.build();
  runInVcLoader(result.outputs,"local m=require('energy:sequence');assert(m.first==2 and m.second==3);local r=m.run();assert(r.i==1 and r.row==2 and r.sum==5 and r.value==2 and r.next==2 and r.last==3)");
});
