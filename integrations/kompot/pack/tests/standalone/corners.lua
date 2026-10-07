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
local C=require "kompot:kompot/core/corners"
local shape={top_left=20,top_right=8,bottom_right=0,bottom_left=12}
test("corner input is validated and copied; scalar radius remains compatible",function()
 local source={top_left=20}
 local mod=K.M:background("#FFFFFF",source):clip(source)
 source.top_left=99
 assert(mod[1].radius.top_left==20 and mod[2].radius.top_left==20)
 assert(K.Modifier.equals(mod,K.M:background("#FFFFFF",{top_left=20}):clip({top_left=20})))
 assert(K.rounded_corners(10)==10 and K.rounded_corners()==0)
end)

test("invalid radii fail at the modifier boundary",function()
 for _,v in ipairs({-1,0/0,"10",{top_left=-1},{top_left="10"},{top_left=false},{typo=4},{20,10}}) do
  assert(not pcall(function() K.M:clip(v) end))
 end
end)
test("adjacent radii shrink proportionally and opposite large arcs intersect",function()
 local r=C.resolve({top_left=80,top_right=40,bottom_left=20,bottom_right=0},60,100)
 assert(r.top_left==40 and r.top_right==20 and r.bottom_left==10)
 local lens=C.resolve({top_left=100,bottom_right=100},100,100)
 assert(not C.contains(10,10,100,100,lens))
 assert(not C.contains(90,90,100,100,lens))
 assert(C.contains(50,50,100,100,lens))
 assert(C.resolve(math.huge,100,60)==30)
 assert(C.resolve({top_left=math.huge},100,60).top_left==30)
 assert(C.resolve({top_left=10},0,0).top_left==0)
end)
test("asymmetric background, border and shadow reach serialized primitives",function()
 local a=app(function()
  K.Box({modifier=K.M:size(80,60):shadow(4,shape):background("#FFFFFF",shape):border(2,"#000000",shape)})
 end)
 a:frame(0)
 for _,p in ipairs(a.dl) do assert(p.radius.top_left==20 and p.radius.bottom_right==0) end
 local json=P.to_json(a.dl)
 assert(json:find('"top_left":20',1,true) and not json:find('inf',1,true))
end)
test("rounded clipping rejects cut corners, retains square corners and follows transforms",function()
 local hits=0
 local a=app(function()
  K.Box({modifier=K.M:offset(50,50):size(80,60):clip(shape):background("#FFFFFF"):clickable(function() hits=hits+1 end)})
 end)
 a:frame(0)
 assert(a.dl[1].kind=="layer" and a.dl[1].mask_radius.top_left==20)
 click(a,51,51);assert(hits==0)
 click(a,70,51);assert(hits==1)
 click(a,129,109);assert(hits==2)
 local b=app(function()
  K.Box({modifier=K.M:offset(50,50):size(80,60):rotate(90,{0,0}):clip(shape):clickable(function() hits=hits+1 end)})
 end)
 click(b,49,51);assert(hits==2)
 click(b,49,70);assert(hits==3)
end)
test("clip order, nested masks, state updates and rectangular fast path",function()
 local radius=K.new_state(20)
 local a=app(function()
  K.Box({modifier=K.M:size(80,60):background("#FFFFFF",8):clip({top_left=radius.value}):padding(4):clip(8):background("#FF0000")})
 end)
 a:frame(0)
 assert(a.dl[1].kind=="rect" and a.dl[2].mask_radius.top_left==20)
 local inner=a.dl[2].prims[2]
 assert(inner.kind=="layer" and inner.mask_radius==8)
 radius.value=10;a:frame(0)
 assert(a.dl[2].mask_radius.top_left==10)
 local b=app(function() K.Box({modifier=K.M:size(50):clip():background("#FFFFFF")}) end)
 b:frame(0);assert(b.dl[1].kind=="clip" and b.dl[2].kind=="rect")
end)
test("unchanged child components receive the new ancestor clip geometry",function()
 local radius=K.new_state(20)
 local hits=0
 local Child=K.component(function()
  K.Box({modifier=K.M:fill_max_size():background("#FFFFFF"):clickable(function() hits=hits+1 end)})
 end)
 local a=app(function()
  K.Box({modifier=K.M:size(80,60):clip({top_left=radius.value})},function() Child({}) end)
 end)
 click(a,1,1);assert(hits==0)
 radius.value=0;a:frame(0);click(a,1,1);assert(hits==1)
 radius.value=10;a:frame(0);click(a,1,1);assert(hits==1)
 local function rects(prims)
  local n=0
  for _,p in ipairs(prims) do
   if p.kind=="rect" then n=n+1 end
   if p.prims then n=n+rects(p.prims) end
  end
  return n
 end
 assert(rects(a.dl)==1,"cached children lost or duplicated layer primitives")
end)
test("coverage preserves square corners, thick borders and transparent interiors",function()
 local function alpha(p,x,y,w) return p[(y*w+x)*4+4] end
 local pixels=C.pixels(80,60,shape)
 assert(alpha(pixels,0,0,80)==0 and alpha(pixels,79,59,80)==255)
 assert(alpha(pixels,40,30,80)==255)
 local border=C.pixels(80,60,shape,8)
 assert(alpha(border,79,59,80)==255 and alpha(border,40,30,80)==0)
 assert(alpha(border,20,0,80)==255)
 local zero=C.pixels(80,60,shape,0)
 for i=4,#zero,4 do assert(zero[i]==0) end
 local thick=C.pixels(10,10,{top_left=4},20)
 assert(alpha(thick,5,5,10)==255)
 local shadow=C.pixels(88,68,shape,nil,4)
 assert(alpha(shadow,84,64,88)>alpha(shadow,4,4,88))
end)
test("native fields fail clearly inside rounded masks",function()
 local a=app(function() K.Box({modifier=K.M:size(100):clip(10)},function() K.BasicTextField({value="hello"}) end) end)
 local ok,err=pcall(function() a:frame(0) end)
 assert(not ok and tostring(err):find("rounded clip",1,true))
end)
print("failed: "..failed)
os.exit(failed==0 and 0 or 1)
