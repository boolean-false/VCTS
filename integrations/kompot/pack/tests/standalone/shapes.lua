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
local S=K.Shape
local C=require "kompot:kompot/core/corners"
local function eq(a,b) assert(math.abs(a-b)<1e-9,tostring(a).." != "..tostring(b)) end

test("shape constructors, mixed units and modifier snapshots",function()
 local percent=S.percent(25)
 local shape=S.cut({top_left=percent,top_right=S.px(10),bottom_left=4})
 local mod=K.M:background("#FFFFFF",shape):border(2,"#FFFFFF",shape):shadow(4,shape):clip(shape)
 percent.value=100;shape.top_left=90
 for _,m in ipairs(mod) do
  local r=C.resolve(m.radius,200,80)
  assert(r.kind=="cut");eq(r.top_left,20);eq(r.top_right,10);eq(r.bottom_left,4);eq(r.bottom_right,0)
 end
 assert(K.Modifier.equals(K.M:clip(S.rounded(S.percent(50))),K.M:clip(S.rounded(S.percent(50)))))
end)
test("invalid sizes and descriptors fail before layout",function()
 for _,v in ipairs({-1,101,math.huge,0/0,"50",false}) do assert(not pcall(S.percent,v)) end
 for _,v in ipairs({-1,0/0,"12",false}) do assert(not pcall(S.px,v)) end
 for _,v in ipairs({{top_left=false},{top_start=12},{top_left={unit="em",value=1}},
  {top_left={unit="percent",value=101}},{10,20},{top_left={unit="px",value=4,extra=true}}}) do
  assert(not pcall(S.rounded,v));assert(not pcall(S.cut,v))
 end
 assert(not pcall(function() K.M:clip({kind="cut",top_left=false}) end))
 assert(not pcall(function() K.M:clip({kind="circle",top_left=4}) end))
end)
test("rectangle, circle and percentages adapt to changing bounds",function()
 assert(C.resolve(S.rectangle(),80,60)==0)
 local circle=C.resolve(S.circle(),80,60);eq(circle.top_left,30)
 eq(C.resolve(S.circle(),60,80).top_left,30)
 eq(C.resolve(S.rounded(S.percent(25)),200,80).top_left,20)
 eq(C.resolve(S.rounded(S.percent(25)),200,40).top_left,10)
 local diamond=C.resolve(S.cut(S.percent(50)),60,60)
 eq(diamond.top_left,30);assert(diamond.kind=="cut")
 local r=C.resolve(S.cut({top_left=100,top_right=100}),60,80)
 eq(r.top_left,30);eq(r.top_right,30)
 assert(not C.any(C.resolve(S.circle(),0,80)))
end)
test("all modifiers serialize resolved geometry without percent units",function()
 local shape=S.cut({top_left=S.percent(50),top_right=8})
 local a=app(function()
  K.Box({modifier=K.M:size(80,60):shadow(4,shape):background("#FFFFFF",shape):border(3,"#000000",shape):clip(shape):background("#FF0000")})
 end)
 a:frame(0)
 for i=1,3 do assert(a.dl[i].shape.kind=="cut");eq(a.dl[i].shape.top_left,30);assert(not a.dl[i].radius) end
 assert(a.dl[4].mask_shape.kind=="cut" and not a.dl[4].mask_radius)
 local json=P.to_json(a.dl)
 assert(json:find('"shape":',1,true) and json:find('"mask_shape":',1,true))
 assert(not json:find('percent',1,true) and not json:find('_unit',1,true))
end)
test("cut hit testing, transformed nested masks and shape changes",function()
 local shape=K.new_state(S.cut(20))
 local hits=0
 local Child=K.component(function()
  K.Box({modifier=K.M:fill_max_size():background("#FFFFFF"):clickable(function() hits=hits+1 end)})
 end)
 local a=app(function()
  K.Box({modifier=K.M:offset(40,40):size(80,60):clip(shape.value)},function() Child({}) end)
 end)
 a:frame(0);click(a,44,44);assert(hits==0)
 click(a,50,51);assert(hits==1)
 shape.value=S.rounded(20);a:frame(0);click(a,46,46);assert(hits==2)
 shape.value=S.cut(20);a:frame(0);click(a,46,46);assert(hits==2)
 shape.value=S.rectangle();a:frame(0);click(a,41,41);assert(hits==3)
 local b=app(function()
  K.Box({modifier=K.M:offset(100,50):size(80,60):rotate(90,{0,0}):clip(S.cut(20)):padding(4):clip(S.circle())},function() Child({}) end)
 end)
 b:frame(0);click(b,99,51);assert(hits==3)
 click(b,70,90);assert(hits==4)
end)
test("percentages and focus outline follow layout size",function()
 local width=K.new_state(80)
 local shape=S.rounded(S.percent(25))
 local a=app(function()
  K.Box({modifier=K.M:size(width.value,60):background("#FFFFFF",shape):focusable(function() end,{focus_shape=S.cut(10)})})
 end)
 a:frame(0);eq(a.dl[1].shape.top_left,15)
 width.value=40;a:frame(0);eq(a.dl[1].shape.top_left,10)
 a.input.focus_key=a.regions[1].key;a.input.focus_visible=true;a.rt.need_layout=true;a:frame(0)
 local border
 for _,p in ipairs(a.dl) do if p.kind=="border" then border=p end end
 assert(border and border.shape.kind=="cut")
end)
test("cut border uses perpendicular thickness, including oversized strokes",function()
 local r=C.resolve(S.cut(20),80,60)
 local data=C.pixels(80,60,r,4)
 local function alpha(x,y) return data[(y*80+x)*4+4] end
 assert(alpha(0,0)==0 and alpha(10,10)>0)
 assert(alpha(11,11)==255 and alpha(14,14)==0)
 assert(alpha(40,2)==255 and alpha(40,5)==0)
 data=C.pixels(80,60,r,100);assert(alpha(40,30)==255)
 data=C.pixels(80,60,r,0)
 for i=4,#data,4 do assert(data[i]==0) end
end)
test("native text stays available with rectangular clips and shaped chrome",function()
 local a=app(function()
  K.Box({modifier=K.M:size(100,50):background("#FFFFFF",S.rounded(12)):clip(S.rectangle())},function()
   K.BasicTextField({value="hello"})
  end)
 end)
 a:frame(0);assert(not a.rt.error_text)
 local b=app(function()
  K.Box({modifier=K.M:size(100,50):clip(S.cut(12))},function() K.BasicTextField({value="hello"}) end)
 end)
 local ok,err=pcall(function() b:frame(0) end)
 assert(not ok and tostring(err):find("shaped clip",1,true))
end)
print("failed: "..failed)
os.exit(failed==0 and 0 or 1)
