// Writes only files owned by this build; refuses to overwrite manual changes.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { buildModules } = require("./vc-modules.cjs");
const hash = code => crypto.createHash("sha256").update(code).digest("hex");
function rejectSymlink(file) {
  try {
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Output symlink: ${file}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

// Preflight can be composed across destinations before any of them is changed.
function prepareBuild({ outputs, outDir }) {
  const marker = path.join(outDir, ".vcts-generated.json");
  for (const file of [outDir, marker]) {
    rejectSymlink(file);
  }
  const previous = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, "utf8")) : {};
  const names = new Set([...Object.keys(previous), ...outputs.keys()]);
  // Validate every path and every existing file before making any changes.
  for (const name of names) {
    if (path.isAbsolute(name) || name.split(/[\\/]/).includes("..")) throw new Error(`Unsafe output: ${name}`);
    const file = path.join(outDir, name);
    for (let parent = file; ; parent = path.dirname(parent)) {
      rejectSymlink(parent);
      if (parent === outDir || parent === path.dirname(parent)) break;
    }
    if (fs.existsSync(file) && (!previous[name] || hash(fs.readFileSync(file)) !== previous[name])) {
      throw new Error(`Refusing to overwrite a file not owned by this build or manually changed: ${file}`);
    }
  }
  return () => {
    for (const [name, code] of outputs) {
      const file = path.join(outDir, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, code);
    }
    for (const name of Object.keys(previous)) {
      if (!outputs.has(name)) fs.rmSync(path.join(outDir, name), { force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(marker, JSON.stringify(Object.fromEntries([...outputs].map(([name, code]) => [name, hash(code)])), null, 2) + "\n");
  };
}
function writeBuild(result) { prepareBuild(result)(); }

if (require.main === module) {
  try {
    const result = buildModules(process.argv[2] || "examples/imports/vc.modules.json");
    writeBuild(result);
    console.log(`Built ${result.outputs.size} Lua files in ${result.outDir}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { writeBuild, prepareBuild };
