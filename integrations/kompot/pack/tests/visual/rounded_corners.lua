app.config_packs({"base","kompot"})
app.new_world("kompot_rounded_corners","1","core:default")
local K=require "kompot:kompot"
local P=require "kompot:kompot/preview"
local radius=K.new_state(24)
local function content()
    local corners={top_left=radius.value,top_right=8,bottom_right=0,bottom_left=16}
    K.Box({modifier=K.M:size(360,220):background("#202830")},function()
        K.Box({modifier=K.M:offset(20,20):size(100,70):shadow(6,corners):background("#4080D0",corners):border(3,"#FFFFFF",corners)})
        K.Box({modifier=K.M:offset(140,20):size(100,70):clip(corners):background("#FF8040")},function()
            K.Box({modifier=K.M:offset(-10,30):size(130,50):background("#40D080")})
        end)
        K.Box({modifier=K.M:offset(260,25):size(70):rotate(15):clip(corners):background("#C050D0")})
        K.Box({modifier=K.M:offset(20,120):size(100,70):clip(corners):padding(8):clip({bottom_right=24}):background("#50C0D0")})
        K.Box({modifier=K.M:offset(150,120):size(70):background("#F0D060",{top_left=70,bottom_right=70})})
    end)
end
P.register("Rounded corners",{width=360,height=220,padding=0},content)
local h=K.mount({content=content})
app.sleep(1)
assert(not h.app.rt.error_text,h.app.rt.error_text)
local function alpha(canvas,x,y) return math.floor(canvas:at(x,y)/16777216)%256 end
local masked
for _,entry in pairs(h.backend.entries) do
    if entry.prim.mask_radius and entry.prim.x==140 then masked=entry end
end
assert(masked and masked.canvas,"rounded layer was not rasterized")
assert(alpha(masked.canvas,0,0)==0,"top-left corner is opaque")
assert(alpha(masked.canvas,99,69)==255,"square bottom-right corner was clipped")
assert(alpha(masked.canvas,50,35)==255,"layer content missing")
local original=require("kompot:kompot/core/canvas").composite
local calls=0
require("kompot:kompot/core/canvas").composite=function(...) calls=calls+1;return original(...) end
h.backend:apply(h.app.dl)
assert(calls==0,"unchanged masks rasterized again")
radius.value=0;h.app:frame(0);app.sleep(0.4)
assert(alpha(masked.canvas,0,0)==255,"radius change left a stale mask")
radius.value=24;h.app:frame(0);app.sleep(0.4)
require("kompot:kompot/core/canvas").composite=original
for _,entry in pairs(h.backend.entries) do
 if entry.prim.mask_radius and entry.prim.y==120 then
  assert(alpha(entry.canvas,50,35)==255,"nested mask did not reach the parent framebuffer")
 end
end
for _,entry in pairs(h.backend.entries) do
 if entry.prim.kind=="layer" and not entry.prim.mask_radius then
  -- Parent source is a GPU screenshot (bottom-up). The final radius update
  -- must propagate from its child mask before the rotated texture is sampled.
  assert(alpha(entry.source_canvas,1,entry.source_canvas.height-2)==0,"transformed parent retained the previous corner")
 end
end
local screenshot=gui.screenshot()
local cv=Canvas({360,220})
local pos=h.host.wpos
cv:blit(screenshot,-pos[1],-(screenshot.height-pos[2]-220))
file.write_bytes("export:rounded-corners-game.png",cv:encode("png"))
file.write("export:rounded-corners-preview.json",P.document("Rounded corners",h.app,h.backend.measurer))
h:dispose()
app.close_world(false)
app.delete_world("kompot_rounded_corners")
print("passed: 1, failed: 0")
