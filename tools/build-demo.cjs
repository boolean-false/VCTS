const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { buildModules } = require("./vc-modules.cjs");
const { writeBuild } = require("./build-modules.cjs");
const root = path.resolve(__dirname, "..");

function buildDemo() {
  const compiled = buildModules(path.join(root, "demo/vc.modules.json"));
  const outputs = new Map([...compiled.outputs].map(([name, code]) => [`content/${name}`, code]));
  // Evaluate trusted author definitions at build time with metadata-only SDK.
  // No gameplay handlers or transient factories are invoked here.
  const sdk = {
    field: { int16(initial) {
      if (!Number.isInteger(initial) || initial < -32768 || initial > 32767) throw new Error("Invalid int16 default");
      return { kind: "int16", initial };
    } },
    defineBlock: value => value,
    definePack: value => value,
    definePanel: value => value,
    signal() { throw new Error("A signal cannot be created during metadata evaluation"); },
  };
  const memo = new Map();
  const options = ts.readConfigFile(path.join(root, "demo/tsconfig.json"), ts.sys.readFile).config;
  const parsed = ts.parseJsonConfigFileContent(options, ts.sys, path.join(root, "demo"));
  function evaluate(filename) {
    if (memo.has(filename)) return memo.get(filename).exports;
    const module = { exports: {} };
    memo.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, {
      exports: module.exports, module,
      require(specifier) {
        if (specifier === "@vc/core") return sdk;
        const resolved = ts.resolveModuleName(specifier, filename, parsed.options, ts.sys).resolvedModule;
        if (!resolved || resolved.resolvedFileName.endsWith(".d.ts")) throw new Error(`No metadata implementation: ${specifier}`);
        return evaluate(resolved.resolvedFileName);
      },
    }, { filename, timeout: 1000 });
    return module.exports;
  }
  const json = value => JSON.stringify(value, null, 2) + "\n";
  outputs.set("content/vcts/package.json", json({id:"vcts", title:"VCTS Runtime", version:"0.1.0", creator:"VCTS", description:"Minimal demo adapter"}));
  for (const id of ["energy", "workshop"]) {
    const pack = evaluate(path.join(root, `design/packs/${id}/pack.ts`)).default;
    outputs.set(`content/${id}/package.json`, json({id:pack.id, title:id, version:"0.1.0", creator:"VCTS", description:"TypeScript demo", dependencies:pack.dependencies}));
    outputs.set(`content/${id}/scripts/world.lua`, `local core = require("vcts:core")\ncore.register_pack(require("${id}:pack").default)\n`);
    for (const block of pack.blocks) {
      if (!block.id.startsWith(id + ":")) throw new Error(`Block owner mismatch: ${block.id}`);
      const name = block.id.slice(id.length + 1);
      if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`Unsupported block name: ${name}`);
      const fields = Object.fromEntries(Object.entries(block.state).map(([key, value]) => [key, {type:value.kind}]));
      outputs.set(`content/${id}/blocks/${name}.json`, json({
        caption:"Накопитель", texture:block.appearance.texture,
        "script-name":name, fields,
      }));
      outputs.set(`content/${id}/scripts/${name}.lua`, `local core = require("vcts:core")
function on_placed(x,y,z) core.present("${block.id}",x,y,z,true) end
function on_block_present(x,y,z) core.present("${block.id}",x,y,z,false) end
function on_block_removed(x,y,z) core.forget(x,y,z) end
function on_broken(x,y,z) core.forget(x,y,z) end
function on_replaced(x,y,z) core.forget(x,y,z) end
function on_interact(x,y,z,playerid) return core.interact("${block.id}",x,y,z,playerid) end
`);
    }
  }
  outputs.set("content/vcts/scripts/world.lua", `local core = require("vcts:core")
function on_world_open() core.shutdown() end
function on_world_tick() core.tick() end
function on_world_quit() core.shutdown() end
`);
  for (const file of ["panel.xml", "panel.xml.lua"]) outputs.set(`content/vcts/layouts/${file}`, fs.readFileSync(path.join(root, "runtime", file), "utf8"));
  outputs.set("project.toml", 'name = "vcts_demo"\ntitle = "VCTS Workshop"\nbase_packs = ["base", "vcts", "energy", "workshop"]\n');
  const result = { outputs, outDir: path.join(root, "build/demo") };
  writeBuild(result);
  console.log(`Built demo project: ${result.outDir} (${outputs.size} files)`);
  return result.outDir;
}
if (require.main === module) {
  try { buildDemo(); } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = { buildDemo };
