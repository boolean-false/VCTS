export interface TestConfig { http: number; tcp: number; udp: number; refused: number; }
type Wait = (this: void, predicate: (this: void) => boolean) => void;
function equal(a: number[] | undefined, b: number[]): boolean { return a !== undefined && a.length === b.length && a.every((v,i)=>v===b[i]); }

export function run(this: void, config: TestConfig, wait: Wait): { cases: string[]; members: Record<string, boolean> } {
  const cases: string[] = [];
  const check = (value: unknown, label: string): void => { assert(value,label); cases.push(label); print("VCTS_NETWORK_CASE",label); };
  check(network.is_available(), "network subsystem available with project permission");
  const up = network.get_total_upload(); const down = network.get_total_download();
  const url = `http://127.0.0.1:${config.http}`;
  function request(route: string, parameters: VC.HttpRequest): VC.HttpResponse {
    let response: VC.HttpResponse | undefined;
    const result = network.request(url+route,{...parameters,on_response:r=>{ response=r; }});
    check(result === undefined,"HTTP request returns nil, not native request ID");
    wait(()=>response!==undefined);
    return response!;
  }
  const get = request("/ok",{method:"GET",headers:["X-VCTS: typed"],timeout_ms:3000});
  check(get.status===200 && get.body==="hello", "HTTP GET status and string body dot callback ABI");
  check(get.headers.some(line=>line.toLowerCase()==="x-vcts-reply: typed"), "HTTP response raw header lines");
  const post = request("/echo",{method:"POST",body:'{"ok":true}',headers:["Content-Type: application/json"]});
  const parsed = json.parse(post.body) as Record<string,unknown>;
  check(post.status===201 && parsed.method==="POST" && parsed.body==='{"ok":true}' && parsed.contentType==="application/json", "HTTP POST body and headers via request");
  const put = request("/echo-bytes",{method:"PUT",body:base64.decode("AP9B")});
  check(put.status===200 && put.body===String.fromCharCode(0,255,65), "HTTP Bytearray upload and binary string response");
  const binary = request("/binary",{method:"GET"});
  check(binary.body===String.fromCharCode(0,255,65) && binary.body.length===3, "HTTP binary response preserves NUL and high bytes");
  check(request("/missing",{method:"GET"}).status===404, "HTTP errors arrive through on_response");
  check(request("/empty",{method:"DELETE"}).status===204, "HTTP non-200 success via request");
  check(request("/redirect",{method:"GET",follow_location:false}).status===302, "HTTP redirect disabled");
  check(request("/redirect",{method:"GET",follow_location:true}).body==="hello", "HTTP redirect followed");
  const timeout = request("/slow",{method:"GET",timeout_ms:100});
  check(timeout.status===0 && timeout.body.length>0, "HTTP transport timeout status zero via on_response");
  let simple: string | undefined;
  network.get(url+"/ok",body=>{simple=body;},()=>{assert(false,"unexpected GET failure");});
  wait(()=>simple!==undefined);
  check(simple==="hello", "legacy GET 200 success");
  let simpleError: number | undefined;
  network.get(url+"/empty",()=>{assert(false,"unexpected shortcut success");},status=>{simpleError=status;});
  wait(()=>simpleError!==undefined);
  check(simpleError===204, "legacy GET routes 204 into error callback");

  let connected: VC.Socket | undefined;
  const client = network.tcp_connect("127.0.0.1",config.tcp,socket=>{connected=socket;},()=>{assert(false,"TCP connect failure");});
  wait(()=>connected!==undefined);
  check(connected===client && client.is_connected() && client.is_alive(), "TCP returned socket identity and connected callback");
  const [addr,port] = client.get_address();
  check(addr==="127.0.0.1" && port===config.tcp, "TCP address multi-return");
  client.set_nodelay(true); check(client.is_nodelay(), "TCP nodelay enabled");
  client.set_nodelay(); check(!client.is_nodelay(), "TCP nodelay default false");
  check(equal(client.recv(8,true),[]), "TCP no data is an empty table, not nil");
  const payload = [0,255,65,66,67];
  check(client.send(payload)===undefined, "TCP send has no delivery result");
  wait(()=>client.available()>=payload.length);
  check(equal(client.peek(payload.length,true),payload) && client.available()===payload.length, "TCP peek preserves buffer");
  check(base64.encode(client.peek(payload.length)!)==="AP9BQkM=", "TCP opaque Bytearray read");
  check(equal(client.peek_async(payload.length,true),payload), "TCP peek_async ready data");
  check(equal(client.recv_async(payload.length,true),payload) && client.available()===0, "TCP recv_async table read consumes bytes");
  client.send("ping");
  check(base64.encode(client.recv_async(4)!)==="cGluZw==", "TCP recv_async yields until bytes arrive");
  client.send("split");
  check(equal(client.peek_async(4,true),[1,2,3,4]), "TCP peek_async waits through split packets");
  check(equal(client.recv(4,true),[1,2,3,4]), "TCP read after async peek");
  client.send(base64.decode("AP8="));
  wait(()=>client.available()>=2);
  check(equal(client.recv(20,true),[0,255]), "TCP Bytearray send and bounded partial read");

  const stream=client.as_stream();
  stream.write([4,0,255]);stream.flush();
  wait(()=>client.available()>=3);
  check(stream.is_binary_mode() && base64.encode(stream.read(3) as VC.Bytearray)==="BAD/", "TCP IOStream binary write/flush/read");

  let accepted: VC.Socket | undefined;
  const free = network.find_free_port(); assert(free!==undefined,"free TCP port");
  check(free>0,"free port discovery");
  const server = network.tcp_open(free,socket=>{accepted=socket;});
  let localConnected = false;
  const local = network.tcp_connect("127.0.0.1",free,()=>{localConnected=true;});
  wait(()=>localConnected && accepted!==undefined);
  check(server.is_open() && server.get_port()===free && accepted!.is_connected(), "TCP server accept socket and explicit port");
  local.send([9,8,7]); wait(()=>accepted!.available()>=3);
  check(equal(accepted!.recv(3,true),[9,8,7]), "TCP server receive");
  accepted!.send("reply"); wait(()=>local.available()>=5);
  check(base64.encode(local.recv(5)!)==="cmVwbHk=", "TCP server reply");
  server.close(); wait(()=>!local.is_connected() && !accepted!.is_connected());
  check(!server.is_open() && local.recv(1,true)===undefined, "TCP server close disconnects accepted clients");
  server.close(); local.close(); accepted!.close();
  client.send("bye"); wait(()=>!client.is_connected() && client.available()>=3);
  check(client.is_alive(), "TCP remote EOF with buffered bytes is still alive");
  const pending = coroutine.create(()=>client.recv_async(10,true));
  const [started] = coroutine.resume(pending);
  check(started && coroutine.status(pending)==="suspended", "TCP async partial EOF remains suspended in current VC");
  check(equal(client.recv(10,true),[101,110,100]), "TCP synchronous partial result on remote EOF");
  const [resumed,remaining] = coroutine.resume(pending);
  check(resumed && coroutine.status(pending)==="dead" && remaining===undefined, "TCP async resumes after buffered EOF is drained");
  wait(()=>!client.is_alive());
  check(client.recv(1,true)===undefined && client.available()===0, "TCP nil after EOF and drain");
  client.close(); client.close();
  wait(()=>client.get_address()[0]===undefined);
  check(client.get_address()[1]===undefined && !client.is_nodelay(), "TCP removed socket address nil and nodelay false");
  let refusal: string | undefined;
  let refusedSocket: VC.Socket | undefined;
  const refused = network.tcp_connect("127.0.0.1",config.refused,()=>{assert(false,"unexpected connection");},(socket,message)=>{refusedSocket=socket;refusal=message;});
  wait(()=>refusal!==undefined);
  check(refusedSocket===refused && refusal!.length>0 && !refused.is_connected(), "TCP refused connection error callback");
  refused.close();

  let udpReply: VC.Bytearray | undefined;
  let udpOpened: VC.WriteableSocket | undefined;
  const udp = network.udp_connect("127.0.0.1",config.udp,data=>{udpReply=data;},socket=>{udpOpened=socket;});
  wait(()=>udpOpened!==undefined);
  check(udpOpened===udp && udp.is_open(), "UDP open callback socket identity");
  const [uaddr,uport] = udp.get_address();
  check(uaddr==="127.0.0.1" && uport===config.udp,"UDP address multi-return");
  udp.send([0,255,65]); wait(()=>udpReply!==undefined);
  check(base64.encode(udpReply!)==="AP9B", "UDP datagram callback Bytearray");
  const udpPort = network.find_free_port(); assert(udpPort!==undefined,"free UDP test port");
  let datagram: VC.Bytearray | undefined;
  let sourceAddress = ""; let sourcePort = 0;
  let calledServer: VC.DatagramServerSocket | undefined;
  const udpServer = network.udp_open(udpPort,(address,port,data,socket)=>{
    sourceAddress=address;sourcePort=port;datagram=data;calledServer=socket;
    socket.send(address,port,data);
  });
  let roundtrip: VC.Bytearray | undefined;
  let secondOpened = false;
  const udpSecond = network.udp_connect("127.0.0.1",udpPort,data=>{roundtrip=data;},()=>{secondOpened=true;});
  wait(()=>secondOpened);
  udpSecond.send("hello"); wait(()=>roundtrip!==undefined);
  check(calledServer===udpServer && sourceAddress==="127.0.0.1" && sourcePort>0 && base64.encode(datagram!)==="aGVsbG8=", "UDP server source address/port and socket callback");
  check(base64.encode(roundtrip!)==="aGVsbG8=", "UDP server Bytearray reply");
  check(udpServer.is_open() && udpServer.get_port()===udpPort, "UDP server explicit port");
  const members: Record<string,boolean> = {};
  function presence(name: string, object: object, methods: string[]): void {
    const value = object as Record<string,unknown>;
    for (const method of methods) members[`VC.${name}.${method}`] = typeof value[method]==="function";
  }
  presence("Socket",client,["as_stream","send","recv","peek","recv_async","peek_async","close","available","is_alive","is_connected","get_address","set_nodelay","is_nodelay"]);
  presence("WriteableSocket",udp,["send","close","is_open","get_address"]);
  presence("ServerSocket",server,["close","is_open","get_port"]);
  presence("DatagramServerSocket",udpServer,["close","is_open","get_port","send"]);
  udpSecond.close(); udpSecond.close(); udp.close(); udp.close(); udpServer.close(); udpServer.close();
  wait(()=>!udp.is_open() && !udpSecond.is_open() && !udpServer.is_open());
  check(!udp.is_open() && !udpServer.is_open(), "UDP client/server idempotent close");
  wait(()=>network.get_total_upload()>up && network.get_total_download()>down);
  check(network.get_total_upload()>up && network.get_total_download()>down,"network upload/download counters");
  return {cases,members};
}
