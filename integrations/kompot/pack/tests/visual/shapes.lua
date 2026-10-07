app.config_packs({"base","kompot"})
app.new_world("kompot_shapes","1","core:default")
local K=require "kompot:kompot"
local P=require "kompot:kompot/preview"
local S=K.Shape
local dynamic=K.new_state(S.rounded(20))
local width=K.new_state(100)
local offset=K.new_state(0)
local function content()
    K.Box({modifier=K.M:size(420,320):background("#202830")},function()
        K.Box({modifier=K.M:offset(20,20):size(100,60):background("#4080D0",S.rectangle()):border(3,"#FFFFFF",S.rectangle())})
        K.Box({modifier=K.M:offset(150,20):size(100,60):background("#50C0A0",S.circle()):border(3,"#FFFFFF",S.circle())})
        local rounded=S.rounded({top_left=S.percent(50),top_right=8,bottom_left=S.px(16)})
        K.Box({modifier=K.M:offset(280,20):size(width.value,60):background("#F0C050",rounded):border(3,"#FFFFFF",rounded)})
        local cut=S.cut({top_left=S.percent(50),top_right=8,bottom_left=16})
        K.Box({modifier=K.M:offset(20,120):size(100,70):shadow(6,cut):background("#4080D0",cut):border(3,"#FFFFFF",cut)})
        K.Box({modifier=K.M:offset(160,120):size(80,70):rotate(15):clip(S.cut(20)):background("#C050D0")})
        K.Box({modifier=K.M:offset(280,120):size(100,70):clip(S.cut(25)):padding(4):clip(S.circle()):background("#50C0D0")})
        K.Box({modifier=K.M:offset(20+offset.value,230):size(80,60):background("#FF8040",dynamic.value):clip(dynamic.value):background("#FF8040")})
        K.Box({modifier=K.M:offset(150,230):size(80,60):clip(S.cut(S.percent(50))):background("#50C0A0")})
    end)
end
P.register("Shapes",{width=420,height=320,padding=0},content)
local h=K.mount({content=content})
app.sleep(1)
assert(not h.app.rt.error_text,h.app.rt.error_text)
local function alpha(canvas,x,y) return math.floor(canvas:at(x,y)/16777216)%256 end
local function masked()
    for _,entry in pairs(h.backend.entries) do
        if entry.prim.mask_shape and entry.prim.y==230 and entry.prim.x==20+offset.value then return entry end
    end
end
assert(alpha(masked().canvas,6,6)==255,"rounded mask missing")
local C=require "kompot:kompot/core/corners"
local original,calls=C.pixels,0
C.pixels=function(...) calls=calls+1;return original(...) end
offset.value=5;h.app:frame(0);app.sleep(0.3)
assert(calls==0,"translation regenerated shape pixels")
width.value=80;h.app:frame(0);app.sleep(0.3)
assert(calls==2,"resize should regenerate only the resized background and border")
dynamic.value=S.cut(20);h.app:frame(0);app.sleep(0.4)
assert(alpha(masked().canvas,6,6)==0,"shape-kind change retained the rounded mask")
assert(calls==3,"shape-kind change did not invalidate the shape texture exactly once")
C.pixels=original
width.value=100;offset.value=0;h.app:frame(0);app.sleep(0.4)
for _,entry in pairs(h.backend.entries) do
    if entry.prim.mask_shape and entry.prim.x==280 then
        assert(alpha(entry.canvas,50,35)==255,"nested shapes lost their content")
        assert(alpha(entry.canvas,0,0)==0,"nested shapes did not clip")
    end
end
local screenshot=gui.screenshot()
local cv=Canvas({420,320})
local pos=h.host.wpos
cv:blit(screenshot,-pos[1],-(screenshot.height-pos[2]-320))
file.write_bytes("export:shapes-game.png",cv:encode("png"))
file.write("export:shapes-preview.json",P.document("Shapes",h.app,h.backend.measurer))
h:dispose()
app.close_world(false)
app.delete_world("kompot_shapes")
print("passed: 1, failed: 0")
