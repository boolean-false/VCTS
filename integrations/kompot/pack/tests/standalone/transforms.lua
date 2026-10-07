-- lua tests/standalone/transforms.lua /path/to/content
local content=assert(arg[1])
unpack=unpack or table.unpack
local native,loaded=require,{}
function require(name)
 local pack,file=name:match("^([%w_%-]+):(.+)$")
 if not pack then return native(name) end
 if loaded[name] then return loaded[name] end
 loaded[name]=assert(loadfile(content.."/"..pack.."/modules/"..file..".lua"))() or true
 return loaded[name]
end
local K=require "kompot:kompot"
local A=require "kompot:kompot/core/affine"
local P=require "kompot:kompot/preview"
local C=require "kompot:kompot/core/canvas"
local Recorder=require "kompot:kompot/backend/recorder"
local failed=0
local function test(name,fn)
 local ok,err=xpcall(fn,debug.traceback)
 print((ok and "PASS " or "FAIL ")..name)
 if not ok then failed=failed+1;print(err) end
end
local function app(fn) return K.App.new({width=400,height=300,content=fn,measurer=Recorder.measurer()}) end
local function click(a,x,y) a:frame(0,{x=x,y=y,down=true});a:frame(0,{x=x,y=y,down=false}) end
test("rotation, negative scale, clipping and inverse hit coordinates",function()
 local hits=0
 local a=app(function()
  K.Box({modifier=K.M:offset(50,50):size(100,40):rotate(90):clip():background("#123456"):clickable(function() hits=hits+1 end)},function()
   K.Box({modifier=K.M:offset(140,0):size(30):clickable(function() hits=hits+100 end)})
  end)
 end)
 a:frame(0)
 assert(a.dl[1].kind=="layer")
 click(a,100,30); assert(hits==1,"rotated rectangle not clickable")
 click(a,55,55); assert(hits==1,"unrotated bounds remain clickable")
 click(a,100,180); assert(hits==1,"rotated clip ignored")
 a:dispose()
 local b=app(function() K.Box({modifier=K.M:offset(20,20):size(40):scale(-2,1):clickable(function() hits=hits+1 end)}) end)
 b:frame(0);click(b,5,30);assert(hits==2);b:dispose()
end)
test("layer bounds respect clips and popup anchors follow transforms",function()
 local Render=require "kompot:kompot/core/render"
 local x,y,w,h=Render.bounds({
  {kind="clip",key="clip",clip="",x=0,y=0,w=100,h=80},
  {kind="rect",key="long",clip="clip",x=0,y=0,w=100,h=10000}})
 assert(x==0 and y==0 and w==100 and h==80)
 x,y,w,h=Render.bounds({{kind="rect",key="offset",clip="",x=5000,y=-5000,w=30,h=20}})
 assert(x==5000 and y==-5000 and w==30 and h==20)
 local a=app(function()
  K.Box({modifier=K.M:offset(50,50):size(100,40):rotate(90)},function() require("kompot:kompot/core/runtime").emit("anchor",K.M,{id="rotated"}) end)
 end)
 a:frame(0)
 local anchor=a.rt.anchors.rotated
 assert(math.abs(anchor.x-80)<1e-8 and math.abs(anchor.y-20)<1e-8)
 assert(math.abs(anchor.w-40)<1e-8 and math.abs(anchor.h-100)<1e-8)
 a:dispose()
end)
test("nested matrices preserve parent coordinates and pointer capture",function()
 local events={}
 local a=app(function()
  K.Box({modifier=K.M:offset(50,50):size(100):scale(2)},function()
   K.Box({modifier=K.M:offset(20,20):size(30):rotate(90):background("#FFFFFF"):draggable({
    on_event=function(e) events[#events+1]=e end})})
  end)
 end)
 a:frame(0)
 local r=a.regions[1]
 local x,y=A.point(A.inverse(r.inverse),r.x+15,r.y+15)
 a:frame(0.01,{x=x,y=y,down=true})
 a:frame(0.1,{x=x+20,y=y,down=true})
 local e=events[#events]
 assert(e.type=="move" and math.abs(e.parent_dx-10)<1e-8)
 assert(math.abs(e.dx)<1e-8 and math.abs(e.dy+10)<1e-8)
 a:frame(0.05,{x=390,y=290,down=true,inside=false})
 a:frame(0.01,{x=390,y=290,down=false,inside=false})
 assert(events[#events].type=="end" and not events[#events].cancelled)
 a:dispose()
end)
test("drag cancellation on Escape, removal and disposal, velocity in parent units",function()
 local show=K.new_state(true)
 local last
 local a=app(function()
  if show.value then K.key("drag",function()
   K.Box({modifier=K.M:size(80):draggable({on_event=function(e) if e.type=="end" or e.type=="cancel" then last=e end end})})
  end) end
 end)
 a:frame(0);a:frame(0.01,{x=10,y=10,down=true});a:frame(0.1,{x=30,y=10,down=true})
 a:frame(0.01,{x=30,y=10,down=false});assert(last.type=="end" and last.velocity_x==200)
 a:frame(0.01,{x=10,y=10,down=true});a:frame(0.1,{x=30,y=10,down=true})
 a:frame(0.01,{key="escape",down=true});assert(last.reason=="escape")
 a:frame(0,{down=false});a:frame(0,{x=10,y=10,down=true});a:frame(0.1,{x=30,y=10,down=true})
 show.value=false;a:frame(0.1);assert(last.reason=="removed")
 a:dispose()
end)
test("on_frame runs once each frame, updates callback and stops before unmount",function()
 local visible,revision=K.new_state(true),K.new_state(1)
 local total,calls,disposed=0,0,0
 local a=app(function()
  if visible.value then K.key("physics",function()
   local value=revision.value
   K.on_frame(function(dt) total=total+dt*value;calls=calls+1 end)
   K.on_dispose(function() disposed=disposed+1 end)
   K.Box({modifier=K.M:size(10)})
  end) end
 end)
 a:frame(0.1);a:frame(0.2);revision.value=2;a:frame(0.1)
 assert(calls==3 and math.abs(total-0.5)<1e-8)
 visible.value=false;a:frame(1);assert(calls==3 and disposed==1)
 visible.value=true;a:frame(0.1);assert(calls==4)
 a:dispose();a:frame(1);assert(calls==4 and disposed==2 and #a.rt.frame_callbacks==0)
end)
test("one drag handler passes only the start payload and separates end from cancel",function()
 for _,button in ipairs({"left","right"}) do
  local events={}
  local payload,received={id="payload"},nil
  local a=app(function()
   K.Row(function()
    K.Box({modifier=K.M:size(80):draggable({button=button,on_event=function(e)
     events[#events+1]=e
     if e.type=="start" then return payload end
     return {id="ignored"}
    end})})
    K.Box({modifier=K.M:size(80):drop_target({on_drop=function(value) received=value end})})
   end)
  end)
  local function pointer(x,pressed,key)
   a:frame(0.01,{x=x,y=10,down=button=="left" and pressed,rdown=button=="right" and pressed,key=key})
  end
  a:frame(0);pointer(10,true);pointer(100,true);pointer(100,false)
  assert(received==payload and #events==3)
  assert(events[1].type=="start" and events[2].type=="move" and events[3].type=="end")
  assert(events[3].accepted==true and events[3].cancelled==false)
  events={};pointer(10,true);pointer(30,true);pointer(30,true,"escape")
  assert(#events==3 and events[3].type=="cancel" and events[3].reason=="escape")
  assert(events[3].cancelled and events[3].accepted==nil)
  pointer(30,false);assert(#events==3,"release after cancellation emitted another terminal event")
  a:dispose()
 end
end)
test("right cancellation does not borrow the left drag state",function()
 local right_calls=0
 local a=app(function()
  K.Box({modifier=K.M:size(60):draggable({on_event=function() end})})
  K.Box({modifier=K.M:offset(100,0):size(60):draggable({button="right",on_event=function() right_calls=right_calls+1 end})})
 end)
 a:frame(0);a:frame(0.01,{x=10,y=10,down=true})
 a:frame(0.01,{x=30,y=10,down=true})
 assert(a.input.dragging)
 a.input:cancel_capture(true,"cancelled")
 assert(a.input.capture and a.input.dragging)
 a:frame(0.01,{x=120,y=10,down=true,rdown=true})
 assert(a.input.rcapture and not a.input.rdragging)
 a.input:cancel_capture(true,"cancelled")
 assert(right_calls==0 and a.input.capture and a.input.dragging)
 a:dispose()
end)
test("frame callback failures are visible and recover when the callback changes",function()
 local fail=K.new_state(true)
 local a=app(function()
  local bad=fail.value
  K.on_frame(function() if bad then error("physics failure") end end)
  K.Box({modifier=K.M:size(10)})
 end)
 a:frame(0);assert(a.rt.error_text:find("physics failure"))
 fail.value=false;a:frame(0);assert(not a.rt.error_text)
 a:dispose()
end)
test("removed frame subscriptions stop before apply and effects clean up after apply",function()
 local visible=K.new_state(true)
 local calls,cleanups,applies=0,0,0
 local a=K.App.new({width=100,height=100,measurer=Recorder.measurer(),
  backend={apply=function()
   applies=applies+1
   assert(cleanups==0,"cleanup ran before the updated interface was applied")
  end},content=function()
   if visible.value then K.key("child",function()
    K.on_frame(function() calls=calls+1 end)
    K.on_dispose(function() cleanups=cleanups+1 end)
    K.Box({modifier=K.M:size(10)})
   end) end
  end})
 a:frame(0);assert(calls==1 and applies==1 and a.stats.compose==1)
 visible.value=false;a:frame(0)
 assert(calls==1 and cleanups==1 and applies==2 and a.stats.compose==2)
 a:dispose()
end)
test("partial composition after on_frame retains clean sibling scopes",function()
 local visible=K.new_state(true)
 local ticks,cleanups=0,0
 local a=app(function()
  local show=visible.value
  K.key("moving",function()
   local x=K.state(0)
   K.on_frame(function() x.value=x:peek()+1 end)
   K.Box({modifier=K.M:offset(x.value,0):size(10)})
  end)
  if show then K.key("sibling",function()
   K.on_frame(function() ticks=ticks+1 end)
   K.on_dispose(function() cleanups=cleanups+1 end)
   K.Box({modifier=K.M:size(10)})
  end) end
 end)
 a:frame(0);a:frame(0);assert(ticks==2 and cleanups==0)
 visible.value=false;a:frame(0);assert(ticks==2 and cleanups==1)
 a:dispose()
end)
test("effects commit the latest frame keys once and do not start in removed scopes",function()
 local starts,cleanups,last=0,0,nil
 local a=app(function()
  local value=K.state(0)
  local current=value.value
  K.on_frame(function() value.value=value:peek()+1 end)
  K.effect(function()
   starts=starts+1;last=current
   return function() cleanups=cleanups+1 end
  end,current)
 end)
 a:frame(0);assert(starts==1 and last==1 and cleanups==0)
 a:frame(0);assert(starts==2 and last==2 and cleanups==1)
 a:dispose();assert(cleanups==2)
 local visible=K.new_state(true)
 local b=app(function()
  local show=visible.value
  K.on_frame(function() visible.value=false end)
  if show then K.key("removed",function()
   K.effect(function() starts=starts+100 end)
  end) end
 end)
 b:frame(0);assert(starts==2,"effect started after its component was removed")
 b:dispose()
end)
test("nearest image rotation, alpha blending, region and packed pixels",function()
 local src=P.soft_canvas(2,2);src:set(0,0,255,0,0,255);src:set(1,0,0,255,0,255)
 src:set(0,1,0,0,255,255);src:set(1,1,255,255,0,128)
 assert(src:at(0,0)==4278190335)
 local dst=P.soft_canvas(4,4)
 local cv=C.wrap(dst,4,4,function() return src,true end)
 cv:image(src,{x=1,y=1,angle=90})
 assert(dst:at(1,1)==src:at(0,1) and dst:at(2,1)==src:at(0,0))
 cv:clear(100,100,100,255);cv:image(src,{alpha=0.5})
 local px=dst.px[0];assert(px[1]==178 and px[2]==50 and px[3]==50 and px[4]==255)
end)
test("serialized layers and Canvas images retain nested resources",function()
 local a=app(function()
  K.Box({modifier=K.M:size(40):rotate(13.333)},function()
   K.Canvas({width=20,height=20,draw=function(cv)
    cv:clear();cv:image("kompot_ui_icons:add",{angle=45,scale=0.5});cv:rect(1,1,2,2,255,0,0,255)
   end})
  end)
 end)
 a:frame(0)
 local json=P.to_json(a.dl,{encoder=P.base64})
 assert(json:find('"transform"') and json:find('"commands"') and json:find('kompot_ui_icons:add'))
 a:dispose()
end)
test("opaque image pixels overwrite without reading the destination",function()
 local source=P.soft_canvas(2,2);source:clear(120,80,40,255)
 local target=P.soft_canvas(2,2)
 function target:at() error("opaque copy read destination") end
 C.composite(target,2,2,source,2,2,A.identity(),{},true)
 assert(target.px[0][1]==120 and target.px[0][4]==255)
 C.composite(target,2,2,source,2,2,A.identity(),{color={0.5,1,1,1}},true)
 assert(target.px[0][1]==60 and target.px[0][4]==255)
end)

test("tilted white rectangle has coverage without dark fringes or area loss",function()
 local src=P.soft_canvas(20,20);src:clear(255,255,255,255)
 for _,angle in ipairs({0.5,17,45,89.5,137,-28}) do
  local dst=P.soft_canvas(48,48)
  C.wrap(dst,48,48,function() return src,true end):image(src,{x=14,y=14,angle=angle})
  local partial,area=0,0
  for y=0,47 do for x=0,47 do
   local p=dst.px[y*48+x]
   if p then
    area=area+p[4]/255
    if p[4]>0 then assert(p[1]==255 and p[2]==255 and p[3]==255,"dark fringe") end
    if p[4]>0 and p[4]<255 then partial=partial+1 end
   end
  end end
  assert(partial>15,"diagonal edge has no partial coverage")
  assert(math.abs(area-400)<3,"rotation changed rectangle coverage: "..area)
 end
end)
test("transparent texel colors do not bleed into rotated semitransparent content",function()
 local src=P.soft_canvas(8,8);src:clear(0,0,255,0);src:rect(2,2,4,4,255,0,0,128)
 local dst=P.soft_canvas(20,20)
 C.wrap(dst,20,20,function() return src,true end):image(src,{x=6,y=6,angle=31,alpha=0.5})
 local visible=0
 for _,p in pairs(dst.px) do
  if p[4]>0 then
   visible=visible+1
   assert(p[1]==255 and p[2]==0 and p[3]==0,"transparent RGB leaked into edge")
   assert(p[4]<=64,"opacity applied incorrectly")
  end
 end
 assert(visible>0)
end)
test("tilted edge alpha blends over an opaque background",function()
 local src=P.soft_canvas(8,8);src:clear(255,255,255,255)
 local clear,filled=P.soft_canvas(20,20),P.soft_canvas(20,20)
 filled:clear(20,40,60,255)
 local m=C.image_matrix({x=6,y=6,angle=23},8,8)
 C.composite(clear,20,20,src,8,8,m,{},true)
 C.composite(filled,20,20,src,8,8,m,{},true)
 for i,p in pairs(clear.px) do
  local q=filled.px[i]
  assert(q[4]==255)
  for ch=1,3 do
   local expected=math.floor(255*p[4]/255+ch*20*(1-p[4]/255)+0.5)
   assert(q[ch]==expected,"incorrect source-over edge blending")
  end
 end
end)
test("rotated UV regions, flipped sources and thin details keep their orientation",function()
 local src=P.soft_canvas(5,5);src:clear(255,255,255,255);src:rect(2,0,1,5,255,0,0,255)
 local flip=P.soft_canvas(5,5)
 for y=0,4 do for x=0,4 do flip:set(x,4-y,src:at(x,y)) end end
 local a,b=P.soft_canvas(20,20),P.soft_canvas(20,20)
 local m=C.image_matrix({x=7,y=7,angle=27,scale={-1.2,0.8}},5,5)
 local opts={region={0.1,0.2,0.9,1},color={0.7,1,1,1}}
 C.composite(a,20,20,src,5,5,m,opts,true)
 C.composite(b,20,20,flip,5,5,m,opts,false)
 assert(a:bytes()==b:bytes(),"framebuffer orientation differs from raster source")
 local red=false
 for _,p in pairs(a.px) do if p[4]>0 and p[2]<100 then red=true end end
 assert(red,"thin red detail disappeared")
end)

assert(failed==0,failed.." tests failed")
