// Compatibility experiment, NOT a production import transformer.
// Reads the actual VC loader without editing the engine or starting a game.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const ts = require("typescript");
const tstl = require("typescript-to-lua");

// Читаем ресурсы установленного движка без изменения файлов.
const resources = require('./vc-runtime.cjs').resolveRuntime().resources;
const source = fs.readFileSync(path.join(resources, "scripts/stdmin.lua"), "utf8");

function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `VC loader layout changed: ${start}`);
  return source.slice(from, to);
}

function luaString(value) {
  let equals = "";
  while (value.includes(`]${equals}]`)) equals += "=";
  return `[${equals}[${value}]${equals}]`;
}

const compiled = tstl.transpileVirtualProject({
  "main.ts": 'import { value } from "./nested/value"; export const result = value;',
  "nested/value.ts": "export const value = 42;",
  "integer.ts": "export const result = Number.isInteger(42);",
}, {
  luaTarget: tstl.LuaTarget.LuaJIT,
  luaLibImport: tstl.LuaLibImportKind.RequireMinimal,
  noImplicitSelf: true,
  strict: true,
});
assert.equal(compiled.diagnostics.length, 0,
  compiled.diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));

const files = new Map(compiled.transpiledFiles.map(f => [f.outPath, f.lua]));
const main = files.get("main.lua");
assert(main?.includes('require("nested.value")'), "Review changed TSTL import output");
// One deliberate substitution in a test fixture. A real adapter must resolve
// each TS module to its owning pack and output path, rather than replace text.
files.set("canonical.lua", main.replace('require("nested.value")', 'require("probe:nested/value")'));

const harness = `
local sources = {}
${[...files].map(([name, code]) => `sources[ ${luaString(`probe:modules/${name}`)} ] = ${luaString(code)}`).join("\n")}
local reads = {}
file = {
  isfile = function(name) return sources[name] ~= nil end,
  read = function(name)
    reads[name] = (reads[name] or 0) + 1
    return assert(sources[name], name)
  end,
}
__vc_internals = {}
__vc__pack_envs = {
  probe = setmetatable({PACK_ID = "probe"}, {__index = _G}),
  other = setmetatable({PACK_ID = "other"}, {__index = _G}),
}
local _debug_getinfo = debug.getinfo
${section("function parse_path(path)", "-- Lua has no parallelizm")}
${section("package = {", "function __vc_internals.register_compiler")}
${section("local __internal_locked = false", "function __scripts_cleanup")}

local ok, err = pcall(require, "probe:main")
assert(not ok and tostring(err):find("nested.value.lua", 1, true))
assert(require("probe:canonical").result == 42)
assert(require("probe:integer").result == true)

sources["probe:modules/shared.lua"] = "return {}"
sources["probe:modules/short.lua"] = 'local value = require("shared"); return value'
assert(require("probe:short") == require("probe:shared"))
assert(reads["probe:modules/shared.lua"] == 1)

sources["probe:modules/nothing.lua"] = "return nil"
assert(require("probe:nothing") == nil)
assert(require("probe:nothing") == nil)
assert(reads["probe:modules/nothing.lua"] == 1)

sources["other:modules/env.lua"] = "return { id = PACK_ID }"
sources["probe:modules/cross.lua"] = 'return require("other:env")'
assert(require("probe:cross").id == "other")

sources["probe:modules/cycle.lua"] = [[
  cycle_count = (cycle_count or 0) + 1
  if cycle_count >= 3 then error("cycle reentered") end
  return require("probe:cycle")
]]
local cycle_ok, cycle_error = pcall(require, "probe:cycle")
assert(not cycle_ok and tostring(cycle_error):find("cycle reentered", 1, true))
print("PASS: TSTL path mismatch, canonical paths, lualib, cache, nil cache, caller pack, target environment, cycle reentry")
`;

const result = spawnSync(process.env.LUAJIT || "luajit", ["-"], {
  input: harness, encoding: "utf8",
});
if (result.error) throw result.error;
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
assert.equal(result.status, 0, "VC loader compatibility experiment failed");
