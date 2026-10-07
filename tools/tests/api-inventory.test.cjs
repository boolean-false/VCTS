const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {inventory,report}=require('../api/inventory.cjs');

test('inventory keeps Lua overrides and actual registration contexts',()=>{
  const data=report(inventory());
  const byId=new Map(data.data.symbols.map(s=>[s.id,s]));
  assert(byId.get('vec3.abs').native && byId.get('vec3.abs').lua);
  assert.equal(byId.get('hud.open').context,'client-hud');
  assert.equal(byId.get('app.tick').context,'app-script');
  assert.equal(byId.get('player.get_pos').context,'base/script');
  assert.equal(byId.get('file.read').context,'all-states');
  assert(byId.get('block.get_size').declaration.signatures[0].includes('MaybeXYZ'));
  assert(byId.get('block.__get_tags').internal);
  assert(byId.get('crypto.hash_new').declaration); // Explicit gap, never an any-shaped stub.
  const members = new Map(data.data.surfaces.objects.map(s=>[s.id,s]));
  assert(members.get('VC.Entity.get_uid').declaration.signatures[0].includes('this: Entity'));
  assert.equal(members.get('VC.Skeleton.get_matrix').declaration.signatures.length,2);
  assert(!members.has('VC.Skeleton.is_interpolated')); // Native-only method, absent from wrapper.
  assert(data.data.surfaces.componentCallbacks.find(s=>s.id==='VC.ComponentCallbacks.on_save').declaration);
  const sockets = new Map(data.data.surfaces.networkObjects.map(s=>[s.id,s]));
  assert(sockets.get('VC.Socket.get_address').declaration.signatures[0].includes('SocketAddress'));
  assert.equal(sockets.get('VC.Socket.recv').declaration.signatures.length,3);
  assert(sockets.get('VC.Socket.as_stream').declaration);
  assert(byId.get('network.get_binary').declaration.deprecated.includes('response.code'));
});

test('new registered library cannot silently disappear from the inventory', t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-api-scan-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const source=process.env.VC_SOURCES || '/Users/dartyukhov/Desktop/Projects/voxelcore-sources';
  for(const relative of ['src/logic/scripting/lua/lua_engine.cpp','src/logic/scripting/scripting_hud.cpp']) {
    fs.mkdirSync(path.dirname(path.join(root,relative)),{recursive:true});
    fs.copyFileSync(path.join(source,relative),path.join(root,relative));
  }
  const dir='src/logic/scripting/lua/libs';
  fs.cpSync(path.join(source,dir),path.join(root,dir),{recursive:true});
  fs.writeFileSync(path.join(root,dir,'libnew.cpp'),'const luaL_Reg unknowntestlib[] = {\n {"work", fn},\n {nullptr, nullptr}\n};');
  assert.throws(()=>inventory(root),/Unmapped library registration: unknowntestlib/);
});
