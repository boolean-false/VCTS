const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const dgram = require('node:dgram');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {buildModules} = require('../vc-modules.cjs');
const {writeBuild} = require('../build-modules.cjs');
const {inventory,report} = require('./inventory.cjs');
const {resolveRuntime} = require('../vc-runtime.cjs');
const root = path.resolve(__dirname,'../..');
const project = path.join(root,'build/network');
const logDir = path.join(root,'build/logs');
const runtime = resolveRuntime();
const data = report(inventory()).data;
const names = data.symbols.filter(s=>s.namespace==='network' && s.declaration).map(s=>s.id);
const memberNames = data.surfaces.networkObjects.filter(s=>s.declaration).map(s=>s.id);
const digest = name=>crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');

async function runEngine(user, script, logName) {
  const child = spawn(runtime.executable,['--headless','--res',runtime.resources,'--dir',user,'--project',project,'--script',path.join(project,script)],{cwd:user});
  let log=''; let timedOut=false;
  child.stdout.on('data',chunk=>{log+=chunk.toString();});
  child.stderr.on('data',chunk=>{log+=chunk.toString();});
  const deadline=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},60000);
  let status,signal;
  try { [status,signal]=await once(child,'close'); }
  finally {clearTimeout(deadline);fs.writeFileSync(path.join(logDir,logName),log);}
  if(timedOut || status!==0) throw new Error(`VC ${timedOut?'timed out':`exit ${status} ${signal||''}`}; see ${logName}\n${log.slice(-5000)}`);
  return log;
}

async function main() {
  fs.mkdirSync(logDir,{recursive:true});
  fs.rmSync(path.join(logDir,'network-evidence.json'),{force:true});
  const user=fs.mkdtempSync(path.join(os.tmpdir(),'vcts-network-'));
  const sockets=new Set(); const timers=new Set(); const requests=[];
  const httpServer=http.createServer((req,res)=>{
    const chunks=[];
    req.on('data',chunk=>chunks.push(chunk));
    req.on('end',()=>{
      const body=Buffer.concat(chunks);
      requests.push({method:req.method,url:req.url,body:body.toString('base64'),headers:req.headers});
      res.setHeader('X-VCTS-Reply',req.headers['x-vcts'] || 'fixture');
      if(req.url==='/ok') res.end('hello');
      else if(req.url==='/echo') {res.statusCode=201;res.end(JSON.stringify({method:req.method,body:body.toString(),contentType:req.headers['content-type']}));}
      else if(req.url==='/echo-bytes') res.end(body);
      else if(req.url==='/binary') res.end(Buffer.from([0,255,65]));
      else if(req.url==='/missing') {res.statusCode=404;res.end('missing');}
      else if(req.url==='/empty') {res.statusCode=204;res.end();}
      else if(req.url==='/redirect') {res.statusCode=302;res.setHeader('Location','/ok');res.end();}
      else if(req.url==='/slow') {
        const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)res.end('late');},2000);
        timers.add(timer);
      } else {res.statusCode=500;res.end('unknown fixture route');}
    });
  });
  const tcpServer=net.createServer(socket=>{
    sockets.add(socket); socket.on('close',()=>sockets.delete(socket)); socket.on('error',()=>{});
    socket.on('data',bytes=>{
      if(bytes.equals(Buffer.from('bye'))) socket.end('end');
      else if(bytes.equals(Buffer.from('split'))) {
        socket.write(Buffer.from([1,2]));
        const timer=setTimeout(()=>{timers.delete(timer);if(!socket.destroyed)socket.write(Buffer.from([3,4]));},30);
        timers.add(timer);
      } else socket.write(bytes);
    });
  });
  const udpServer=dgram.createSocket('udp4');
  udpServer.on('message',(bytes,from)=>udpServer.send(bytes,from.port,from.address));
  const refusedServer=net.createServer();
  try {
    httpServer.listen(0,'127.0.0.1'); await once(httpServer,'listening');
    tcpServer.listen(0,'127.0.0.1'); await once(tcpServer,'listening');
    udpServer.bind(0,'127.0.0.1'); await once(udpServer,'listening');
    refusedServer.listen(0,'127.0.0.1'); await once(refusedServer,'listening');
    const config={http:httpServer.address().port,tcp:tcpServer.address().port,udp:udpServer.address().port,refused:refusedServer.address().port};
    await new Promise(resolve=>refusedServer.close(resolve));
    const compiled=buildModules(path.join(root,'examples/network/vc.modules.json'));
    const outputs=new Map([...compiled.outputs].map(([name,code])=>[`content/${name}`,code]));
    outputs.set('project.toml','name = "vcts_network_api"\ntitle = "VCTS network API tests"\nbase_packs = ["base", "netprobe"]\npermissions = ["network"]\n');
    outputs.set('content/netprobe/package.json',JSON.stringify({id:'netprobe',title:'Network API tests',version:'0.1.0',creator:'VCTS',dependencies:['base']}));
    outputs.set('start.lua',`
app.config_packs({"netprobe"})
app.load_content()
local config = json.parse(${JSON.stringify(JSON.stringify(config))})
local evidence = require("netprobe:smoke").run(config,function(predicate)
    app.sleep_until(predicate,10000000,30)
    assert(predicate(),"network test wait exhausted")
end)
evidence.presence = {}
for _, name in ipairs(json.parse(${JSON.stringify(JSON.stringify(names))})) do
    evidence.presence[name] = type(network[name:match("[^.]+$")]) == "function"
end
file.write("export:network-evidence.json",json.tostring(evidence))
print("VCTS_NETWORK_PASS")
`);
    outputs.set('denied.lua',`
app.config_packs({"netprobe"})
app.load_content()
assert(not network.is_available(), "network subsystem unexpectedly enabled")
local ok, err = pcall(network.find_free_port)
assert(not ok and err:find("network subsystem is not available in the project",1,true),"network permission not enforced")
print("VCTS_NETWORK_DENIED_PASS")
`);
    writeBuild({outputs,outDir:project});
    const log=await runEngine(user,'start.lua','network.log');
    if(!log.includes('VCTS_NETWORK_PASS')) throw new Error(`Network success marker missing; see network.log\n${log.slice(-5000)}`);
    const evidence=JSON.parse(fs.readFileSync(path.join(user,'export/network-evidence.json'),'utf8'));
    for(const name of names) if(!evidence.presence[name]) throw new Error(`Missing network function: ${name}`);
    for(const name of memberNames) if(!evidence.members[name]) throw new Error(`Missing network method: ${name}`);
    // Transport failure and UDP shutdown are deliberately exercised. Only these native
    // diagnostics are allowed, tied to completed cases; Lua/script errors always fail.
    const errorLines=log.split('\n').filter(line=>/^\[E\]/.test(line));
    const expected=[
      {case:'HTTP transport timeout status zero via on_response',after:'HTTP request returns nil, not native request ID',max:1,count:0,
        pattern:new RegExp(`\\[\\s*curl\\] Timeout was reached \\(http://127\\.0\\.0\\.1:${config.http}/slow\\)$`)},
      {case:'TCP refused connection error callback',after:'TCP removed socket address nil and nodelay false',max:1,count:0,
        pattern:/\[\s*sockets\] Connect failed \[errno=61\]: Connection refused$/},
      {case:'TCP server close disconnects accepted clients',after:'TCP server reply',max:2,count:0,
        pattern:/\[\s*sockets\] recv\(\.\.\.\) error \[errno=9\]: Bad file descriptor$/},
      // macOS shutdown may return zero bytes (errno=0) or EBADF; both are logged by VC before it checks !open.
      {case:'UDP client/server idempotent close',after:'UDP server explicit port',max:2,count:0,
        pattern:/\[\s*sockets\] udp connection \d+ recv error (?:\[errno=9\]: Bad file descriptor|\[errno=0\]: Undefined error: 0)$/},
    ];
    let lastCase;
    for(const line of log.split('\n')) {
      if(line.startsWith('VCTS_NETWORK_CASE\t')) lastCase=line.slice('VCTS_NETWORK_CASE\t'.length).replace(/\r$/,'');
      if(!/^\[E\]/.test(line)) continue;
      const match=expected.find(e=>e.pattern.test(line) && evidence.cases.includes(e.case) && e.after===lastCase && e.count<e.max);
      if(!match) throw new Error(`Unexpected engine diagnostic: ${line}`);
      match.count++;
    }
    evidence.expectedEngineDiagnostics=errorLines;
    if(!requests.some(r=>r.url==='/echo-bytes' && r.method==='PUT' && r.body==='AP9B')) throw new Error('External server did not receive exact binary body');
    if(!requests.some(r=>r.url==='/ok' && r.headers['x-vcts']==='typed')) throw new Error('External server did not receive raw custom header');
    evidence.httpServerRequests=requests;
    evidence.sourceHashes=data.sourceHashes;
    evidence.declarations=Object.fromEntries(data.symbols.filter(s=>names.includes(s.id)).map(s=>[s.id,s.declaration.signatures]));
    evidence.deprecatedWrappers=Object.fromEntries(data.symbols.filter(s=>names.includes(s.id) && s.declaration.deprecated).map(s=>[s.id,s.declaration.deprecated]));
    evidence.objectDeclarations=Object.fromEntries(data.surfaces.networkObjects.filter(s=>s.declaration).map(s=>[s.id,s.declaration.signatures]));
    evidence.runtime={executable:fs.realpathSync(runtime.executable),sha256:digest(runtime.executable),manifest:runtime.manifest,
      resources:Object.fromEntries(Object.keys(data.sourceHashes).filter(name=>name.startsWith('res/')).map(name=>[name,digest(path.join(runtime.resources,name.slice(4)))]))};
    evidence.runtime.resourceDifferences=Object.keys(evidence.runtime.resources).filter(name=>evidence.runtime.resources[name]!==data.sourceHashes[name]);
    // A second isolated process verifies denial without changing any user project.
    const deniedOutputs=new Map(outputs); deniedOutputs.set('project.toml','name = "vcts_network_api"\ntitle = "VCTS network API tests"\nbase_packs = ["base", "netprobe"]\n');
    writeBuild({outputs:deniedOutputs,outDir:project});
    const denied=await runEngine(user,'denied.lua','network-denied.log');
    if(!denied.includes('VCTS_NETWORK_DENIED_PASS') || /^\[E\]/m.test(denied)) throw new Error('Network denial test failed; see network-denied.log');
    evidence.cases.push('project without network permission denies native operations');
    writeBuild({outputs,outDir:project});
    evidence.note='Live loopback tests of selected network contracts. Deprecated get_binary/post defects are tested separately against the actual Lua wrapper. Expected native transport diagnostics are classified; all unexpected errors fail.';
    fs.writeFileSync(path.join(logDir,'network-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
    console.log(`PASS: VC ${runtime.manifest?.version}; ${evidence.cases.length} network checks; ${names.length} global functions and ${memberNames.length} object methods present; permission denial verified.`);
    console.log(`Expected native diagnostics: ${errorLines.length}; see build/logs/network-evidence.json`);
  } finally {
    for(const timer of timers) clearTimeout(timer);
    for(const socket of sockets) socket.destroy();
    httpServer.closeAllConnections();
    await Promise.all([httpServer,tcpServer,refusedServer].filter(server=>server.listening).map(server=>new Promise(resolve=>server.close(resolve))));
    try {udpServer.close();} catch {}
    fs.rmSync(user,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
