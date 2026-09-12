const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// User-selected local runtime. Environment overrides keep the tools portable.
function resolveRuntime() {
  const root = path.resolve(process.env.VOXELCORE_ROOT ||
    (process.env.VOXELCORE_BIN ? path.dirname(process.env.VOXELCORE_BIN) :
      path.join(os.homedir(),'Library/Application Support/vlauncher/runtimes/0.32.1-macos-aarch64')));
  const manifestPath=path.join(root,'runtime.json');
  const manifest=fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath,'utf8')) : null;
  const executable=path.resolve(process.env.VOXELCORE_BIN || path.join(root,
    manifest?.executable || (process.platform==='win32'?'VoxelCore.exe':'VoxelCore')));
  const resources=path.resolve(root,manifest?.resources || 'res');
  if(!fs.existsSync(executable) || !fs.statSync(executable).isFile()) {
    throw new Error(`VoxelCore executable not found: ${executable}. Set VOXELCORE_ROOT or VOXELCORE_BIN.`);
  }
  if(!fs.existsSync(resources) || !fs.statSync(resources).isDirectory()) {
    throw new Error(`VoxelCore resources not found: ${resources}. Set VOXELCORE_ROOT.`);
  }
  return {root,executable,resources,manifest};
}
module.exports={resolveRuntime};
