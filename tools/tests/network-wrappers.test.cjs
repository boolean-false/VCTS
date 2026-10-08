const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const sourceRoot=require('../vc-runtime.cjs').resolveRuntime().resources;
function quote(value) {let marks='';while(value.includes(`]${marks}]`))marks+='=';return `[${marks}[${value}]${marks}]`;}
function wrappers(assertions) {
  const classes=fs.readFileSync(path.join(sourceRoot,'scripts/classes.lua'),'utf8');
  const tables=fs.readFileSync(path.join(sourceRoot,'modules/internal/extensions/table.lua'),'utf8');
  const code=`
local requests, queue = {}, {}
cameras = {}
Bytearray = function(value) return value end
network = {
  __request = function(url,params) requests[#requests+1]={url=url,params=params};return #requests end,
  is_available = function() return true end,
  __pull_events = function() local result=queue;queue={};return result end,
  __is_serveropen = function() return false end,
  __is_alive = function() return false end,
}
assert(loadstring(${quote(tables)},"core:extensions/table"))()
assert(loadstring(${quote(classes)},"core:scripts/classes"))()
local function response(id,status,body)
  queue={{4,status,id,{status=status,body=body,headers={}}}}
  return pcall(network.__process_events)
end
${assertions}
`;
  const run=spawnSync(process.env.LUAJIT || 'luajit',['-'],{input:code,encoding:'utf8'});
  if(run.error)throw run.error;
  assert.equal(run.status,0,run.stderr);
}

test('actual HTTP wrapper discards IDs, uses one response handler and routes only 200 as success',()=>{
  wrappers(`
    local called=0
    assert(network.request("local",{method="GET",on_response=function(r) called=called+1;assert(r.status==201) end})==nil)
    assert(response(1,201,"made"));assert(called==1)
    assert(response(1,201,"made"));assert(called==1)
    local body, failure
    network.get("local",function(value)body=value end,function(status)failure=status end)
    assert(response(2,200,"ok"));assert(body=="ok" and failure==nil)
    network.get("local",function()error("unexpected success") end,function(status)failure=status end)
    assert(response(3,204,""));assert(failure==204)
    network.get("local",function()end)
    local ok= response(4,404,"missing")
    assert(not ok,"missing failure callback should reproduce wrapper failure")
  `);
});

test('actual binary GET and POST wrappers reproduce missing code and omitted-header failures',()=>{
  wrappers(`
    local called=false
    network.get_binary("local",function()called=true end,function()called=true end)
    local ok,err=response(1,200,"bytes")
    assert(not ok and tostring(err):find("code",1,true) and not called)
    ok,err=pcall(network.post,"local","body",function()end,function()end)
    assert(not ok and #requests==1,"omitted headers fail before native request")
    network.post("local","body",function()called=true end,function()called=true end,{})
    ok,err=response(2,201,"made")
    assert(not ok and tostring(err):find("code",1,true) and not called)
    assert(requests[2].params.body=="body" and requests[2].params.headers[1]=="Content-Type: application/json")
  `);
});
