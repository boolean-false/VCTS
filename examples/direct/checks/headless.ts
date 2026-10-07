/// <reference path="../../../sdk/headless.d.ts" />
export {};
// @ts-expect-error no implicit local player in portable/headless code
player.get_pos();
// @ts-expect-error a multi-return call is not a scalar
const scalar: number = player.get_pos(1);
// @ts-expect-error absent players can return nil
const guaranteed: number = player.get_pos(1)[0];
// @ts-expect-error C++ consumes a positional tuple
block.compose_state({rotation:0,segment:0,userbits:1});
// @ts-expect-error vectors have exactly three components
vec3.add([1,2],[3,4]);
// @ts-expect-error this API produces vec4 even for vec3 input
const vector: VC.Vec3 = mat4.mul(mat4.idt(),[1,2,3]);
// @ts-expect-error dynamic JSON requires narrowing
const parsed: {value: number} = json.parse('{"value":42}');
// @ts-expect-error Bytearray is opaque and is not a TS array
file.read_bytes("world:data.bin").map(value => value);
// @ts-expect-error HUD is absent from this profile
hud.get_player();
// @ts-expect-error pack modules have no app global
app.new_world("x","1","core:default");
// @ts-expect-error inventory values must be serializable
inventory.set_data(1,0,"callback",() => 42);
// @ts-expect-error callbacks must not request a Lua self
const callback: (this: void, value: unknown) => void = function(this: {foo: number}) { this.foo++; };
const bytes: number[] = file.read_bytes("world:data.bin",true);
const [px,py,pz] = player.get_pos(1);
const handler = events.on("direct:typed",(n: number) => n+1);
events.remove("direct:typed",handler);
void [bytes,px,py,pz];
const e = entities.get(1);
if (e) {
  // @ts-expect-error stale entity handles may return nil
  const position: VC.Vec3 = e.transform.get_pos();
  // @ts-expect-error self is required even with noImplicitSelf enabled
  const noSelf: (this: void) => VC.Vec3 | undefined = e.transform.get_pos;
  // @ts-expect-error dynamic component fields require a registered contract or narrowing
  e.require_component("unknown:component").run();
  // @ts-expect-error native body types are a closed set
  e.rigidbody.set_body_type("floating");
  // @ts-expect-error skeleton reads are nil in headless
  const tint: VC.Vec4 = e.skeleton.get_color();
  // @ts-expect-error no is_interpolated method exists on the Lua Skeleton wrapper
  e.skeleton.is_interpolated();
  // @ts-expect-error object overload is not implemented by the native get_entity helper
  player.set_entity(1, e);
}
// @ts-expect-error entity dictionary is not a dense array
const all: VC.Entity[] = entities.get_all();
const callbacks: VC.ComponentCallbacks = {
  // @ts-expect-error component callbacks use dot-call ABI
  on_update(this: VC.Entity, tps: number) {},
};
// @ts-expect-error there is no per-instance entity global in cached pack modules
entity.get_uid();
network.request("http://localhost/", {method:"GET",timeout_ms:1000,on_response:response=>{
  const body: string = response.body;
  // @ts-expect-error native responses have status, not code
  response.code;
  void body;
}});
// @ts-expect-error the timeout field from docs is ignored by the implementation
network.request("http://localhost/", {method:"GET",timeout:1000});
// @ts-expect-error object bodies are not implicitly serialized
network.request("http://localhost/", {method:"POST",body:{hello:true}});
// @ts-expect-error raw header lines must be an array
network.request("http://localhost/", {method:"GET",headers:{accept:"text/plain"}});
// @ts-expect-error network.request discards the native request ID
const requestId: number = network.request("http://localhost/", {method:"GET"});
// @ts-expect-error get needs a handler for non-200 responses in current VC
network.get("http://localhost/", body=>{});
const socket = network.tcp_connect("127.0.0.1", 12345, connected=>{
  const table: number[] | undefined = connected.recv(8,true);
  const opaque: VC.Bytearray | undefined = connected.peek(8);
  const [address,port] = connected.get_address();
  // @ts-expect-error recv may return nil after closure
  const guaranteed: number[] = connected.recv(8,true);
  // @ts-expect-error socket methods require self
  const detached: (this:void)=>number = connected.available;
  void [table,opaque,address,port];
});
network.udp_connect("127.0.0.1",12345,data=>{
  const bytes: VC.Bytearray = data;
  // @ts-expect-error UDP callback carries only a Bytearray, not a source address
  const text: string = data;
  void bytes;
});
// @ts-expect-error internal raw entry points are not a public API
network.__request("url",{});
// @ts-expect-error network datagram handler is mandatory
network.udp_open(12345);
// @ts-expect-error Главное меню отсутствует в режиме без окна.
menu.page;
