// No framework wrapper or native shim. Every API call goes directly to VC globals.
const passed: string[] = [];
function check(name: string, condition: unknown): asserts condition {
  assert(condition, `direct API: ${name}`);
  passed.push(name);
}

export function run(playerId: number): string[] {
  check("vc.is_headless", vc.is_headless() && !vc.is_client());
  const [major, minor] = vc.get_version();
  check("vc.get_version/multi-return", typeof major === "number" && typeof minor === "number");
  check("pack.get_info/optional icon", pack.get_info("direct")?.id === "direct" && pack.get_info("direct")?.icon === undefined);
  let missingPack = false;
  try { missingPack = pack.get_info("absent_pack") === undefined; }
  catch { missingPack = true; } // Pack manager may throw before the native nil branch.
  check("pack.get_info/missing or throws", missingPack);
  check("pack.get_info/array overload", pack.get_info(["direct"])["direct"]?.id === "direct");
  check("pack.is_installed", pack.is_installed("direct"));
  check("pack.get_installed/array", pack.get_installed().includes("direct"));
  check("world.is_open", world.is_open());
  const stone = block.index("base:stone");
  check("block.index/name", block.name(stone) === "base:stone");
  check("block.name/nil", block.name(999999) === undefined);
  check("block.get/unloaded sentinel", block.get(100000, 100, 100000) === -1);
  const state = block.compose_state([0, 0, 37]);
  const split = block.decompose_state(state);
  check("block.compose_state/decompose_state/table", split[0] === 0 && split[1] === 0 && split[2] === 37);
  const [sx, sy, sz] = block.get_size(stone);
  check("block.get_size/multi-return", sx === 1 && sy === 1 && sz === 1);
  const [ax, ay, az] = block.get_X(stone, 0);
  check("block.get_X/definition overload", ax === 1 && ay === 0 && az === 0);
  block.set(0, 100, 0, stone, state, true);
  check("block.set/get_states", block.get(0,100,0) === stone && block.get_states(0,100,0) === state);
  block.set_user_bits(0,100,0,0,8,12);
  check("block.set_user_bits/get_user_bits", block.get_user_bits(0,100,0,0,8) === 12);
  const textures = block.get_textures(stone);
  check("block.get_textures/table", textures !== undefined && textures.length === 6 && typeof textures[0] === "string");
  const box = block.get_hitbox(stone,0);
  check("block.get_hitbox/nested tuple", box !== undefined && box[1][0] === 1);
  check("block.get_field/nil", block.get_field(0,100,0,"missing") === undefined);
  block.place(2,100,0,stone,0,playerId);
  check("block.place", block.get(2,100,0) === stone);
  block.destruct(2,100,0,playerId);
  check("block.destruct", block.get(2,100,0) === block.index("core:air"));

  player.set_pos(playerId,0,102,0);
  const [x,y,z] = player.get_pos(playerId);
  check("player.get_pos/multi-return", x === 0 && y === 102 && z === 0);
  const invalid = player.get_pos(999999);
  check("player.get_pos/nil", invalid[0] === undefined);
  const [inv, slot] = player.get_inventory(playerId);
  check("player.get_inventory/multi-return", inv !== undefined && slot !== undefined);
  player.set_name(playerId,"Typed VCTS");
  check("player.set_name/get_name", player.get_name(playerId) === "Typed VCTS");
  player.set_flight(playerId,true);
  check("player.set_flight/is_flight", player.is_flight(playerId) === true);
  check("player.get_all/table", player.get_all().includes(playerId));
  check("player.get_nearest/vector input", player.get_nearest([0,102,0]) === playerId);

  const stoneItem = block.get_picking_item(stone);
  check("block.get_picking_item", stoneItem !== undefined);
  const emission = item.emission(stoneItem);
  check("item.emission/table", emission !== undefined && emission.length === 4);
  const bag = inventory.create(4);
  inventory.set(bag,0,stoneItem,7,{caption:"typed", nested:{value:42}});
  const [iid,count] = inventory.get(bag,0);
  check("inventory.get/multi-return and zero slot", iid === stoneItem && count === 7);
  check("inventory.get_data", inventory.get_data(bag,0,"caption") === "typed");
  check("inventory.find_by_item/nil", inventory.find_by_item(bag,0,0,0,1) === undefined);
  check("inventory.find_by_item/zero", inventory.find_by_item(bag,stoneItem) === 0);
  inventory.set_data(bag,0,"caption",undefined);
  check("inventory.set_data/nil removes", !inventory.has_data(bag,0,"caption"));
  inventory.move(bag,0,bag,1);
  const [,moved] = inventory.get(bag,1);
  check("inventory.move", moved === 7);
  inventory.decrement(bag,1,2);
  const [,remaining] = inventory.get(bag,1);
  check("inventory.decrement/Lua extension", remaining === 5);
  inventory.remove(bag);

  const path = "world:direct-api.txt";
  file.write(path,"hello\nмир");
  check("file.write/read", file.read(path) === "hello\nмир");
  check("file.read_bytes/table overload", file.read_bytes(path,true)[0] === 104);
  const bytes = file.read_bytes(path);
  check("file.read_bytes/Bytearray overload", file.write_bytes("world:direct-api-copy.txt",bytes));
  check("file.write_bytes/Bytearray", file.read("world:direct-api-copy.txt") === file.read(path));
  check("file.length/missing", file.length("world:missing-file.txt") === -1);
  check("file.ext/nil", file.ext("world:extensionless") === undefined);
  check("file.name", file.name("world:data/config.toml") === "config.toml");
  const parsed = json.parse(json.tostring({value:42,text:"мир"}));
  check("json.roundtrip", typeof parsed === "object" && parsed !== null && "value" in parsed && parsed.value === 42);
  const encoded = base64.encode([0,65,255]);
  const decoded = base64.decode(encoded,true);
  check("base64.table overload", decoded.length === 3 && decoded[0] === 0 && decoded[2] === 255);
  check("base64.Bytearray overload", base64.encode(base64.decode(encoded)) === encoded);

  const sum = vec3.add([1,2,3],2);
  check("vec3.add/scalar", sum[0] === 3 && sum[2] === 5);
  const target: VC.Vec3 = [0,0,0];
  check("vec3.add/destination identity", vec3.add(sum,[1,1,1],target) === target && target[0] === 4);
  const absResult = vec3.abs([-1,-2,-3],target);
  check("vec3.abs/Lua override destination", absResult === undefined && vec3.dot(target,[1,0,0]) === 1 && target[2] === 3);
  const identity = mat4.idt();
  const projected = mat4.mul(identity,[1,2,3]);
  check("mat4.mul/vec3 yields vec4", projected.length === 4 && projected[3] === 1);
  const q = quat.from_euler([0,0,0]);
  const qdest: VC.Quat = [0,0,0,0];
  quat.mul(q,q,qdest);
  check("quat.mul/destination", qdest[0] === 1);
  check("time.utc_time", time.utc_time() > 0 && time.precise_time() >= 0);

  let received = 0;
  const handler = events.on("direct:typed", (value: number) => { received = value; return value + 1; });
  check("events.emit/callback ABI", events.emit("direct:typed",41) === 42 && received === 41);
  events.remove("direct:typed",handler);
  check("events.remove", events.emit("direct:typed",99) === undefined);
  let ruleValue: unknown;
  const subscription = rules.create("direct-rule",false,value => { ruleValue = value; });
  rules.set("direct-rule",true);
  check("rules.listen/callback ABI", ruleValue === true && rules.get("direct-rule") === true && subscription !== undefined);
  rules.unlisten("direct-rule",subscription);
  session.get("direct").value = 123;
  check("session.get/has", session.has("direct") && session.get("direct").value === 123);
  session.reset("direct");
  check("session.reset", !session.has("direct"));
  return passed;
}
