app.config_packs({"base","kompot"})
app.new_world("kompot_transform_check","1","core:default")
local K=require "kompot:kompot"
local P=require "kompot:kompot/preview"
local source=K.raster({width=12,height=8,key="transform:source",draw=function(cv)
 cv:clear(200,80,30,255);cv:rect(0,0,4,2,40,170,210,255);cv:rect(8,5,3,2,230,230,80,128)
end})
local function content()
 K.Box({modifier=K.M:size(360,260):background("#252B31")},function()
  K.Box({modifier=K.M:offset(70,50):size(170,55):rotate(25):scale(1.1,0.9):background("#386F94",8):padding(10)},function()
   K.Text("Kompot - поворот")
  end)
  K.Image("kompot_ui_icons:settings",{modifier=K.M:offset(285,35):size(30):rotate(35):scale(1.7)})
  K.Canvas({modifier=K.M:offset(30,160):size(90,70),draw=function(cv)
   cv:clear(60,70,80,255)
   cv:image(source,{x=30,y=20,width=36,height=24,angle=-30,alpha=0.8})
   cv:image("kompot_ui_icons:add",{x=4,y=4,width=20,height=20,angle=45})
  end})
  K.Box({modifier=K.M:offset(180,150):size(90,60):rotate(-20):clip():background("#81C9BC")},function()
   K.Box({modifier=K.M:offset(-10,15):size(120,20):background("#EE8550")})
  end)
 end)
end
P.register("Transforms",{width=360,height=260,padding=0},content)
local icon=assets.to_canvas("kompot_ui_icons:add")
local pixels={}
for y=0,icon.height-1 do for x=0,icon.width-1 do pixels[#pixels+1]=icon:at(x,y) end end
file.write("export:canvas-source.json",json.tostring({width=icon.width,height=icon.height,pixels=pixels}))
local h=K.mount({content=content})
app.sleep(1.5)
assert(not h.app.rt.error_text,h.app.rt.error_text)
local screenshot=gui.screenshot()
local cv=Canvas({360,260})
local pos=h.host.wpos
cv:blit(screenshot,-pos[1],-(screenshot.height-pos[2]-260))
file.write_bytes("export:transforms-game.png",cv:encode("png"))
local m=h.backend.measurer
function m:advances(font,text)
 local out={};for _,ch in ipairs(K.text.chars(text)) do out[#out+1]=self:width(font,ch) end;return out
end
file.write("export:transforms-preview.json",P.document("Transforms",h.app,m))
-- Повторное применение и перемещение готового слоя не растеризуют пиксели.
local offset,angle,caption=K.new_state(0),K.new_state(15),K.new_state("Cached")
h:set_content(function()
 K.Box({modifier=K.M:offset(offset.value,0):size(360,200)},function()
  K.Image("kompot_ui_icons:settings",{modifier=K.M:size(32):rotate(angle.value)})
  K.Box({modifier=K.M:offset(60,20):size(140,40):rotate(angle.value):background("#386F94")},function()
   K.Text(caption.value)
  end)
 end)
end)
app.sleep(0.3)
local raster=require "kompot:kompot/core/canvas"
local original,calls=raster.composite,0
raster.composite=function(...) calls=calls+1;return original(...) end
for _=1,3 do h.backend:apply(h.app.dl) end
assert(calls==0,"unchanged layers were rasterized again")
offset.value=10;h.app:frame(1/60)
assert(calls==0,"moving layers rasterized their textures")
angle.value=30;h.app:frame(1/60)
assert(calls==2,"changed angles did not redraw both layers exactly once")
caption.value="Changed";h.app:frame(1/60)
assert(calls==2,"pending content rasterized the old snapshot again")
app.sleep(0.2)
assert(calls==3,"changed container content did not refresh exactly once")
-- При смене размера нельзя принять кадр прежнего framebuffer за новый.
h:set_content(function()
 K.Box({modifier=K.M:size(256):rotate(30):background("#386F94")})
end)
app.sleep(0.3)
for _,entry in pairs(h.backend.entries) do
 if entry.layer_backend then
  assert(entry.source_canvas.width==entry.source_width and entry.source_canvas.height==entry.source_height,
   "resized layer retained a stale source bitmap")
 end
end
raster.composite=original
-- Постоянное изменение текста не должно откладывать снимок бесконечно.
local elapsed=K.new_state(0)
h:set_content(function()
    K.on_frame(function(dt) elapsed.value=elapsed:peek()+dt end)
    K.Box({modifier=K.M:size(140,40):rotate(15):background("#386F94")},function()
        K.Text(string.format("%.2f",elapsed.value))
    end)
end)
app.sleep(0.5)
assert(elapsed:peek()>0)
local captured=false
for _,entry in pairs(h.backend.entries) do
    if entry.layer_backend then captured=captured or entry.source_canvas~=nil end
end
assert(captured,"continuously changing layer never became visible")
local UI=require "kompot:ui"
local G=require "kompot:ui/guide"
h:set_theme(UI.theme())
for _,id in ipairs({"rotate_image","transform_pivot","transformed_input","frame_lifecycle","drag_parent","fixed_step_throw","canvas_segments","radial_layout"}) do
    h:set_content(G.by_id[id].render)
    app.sleep(0.2)
    assert(not h.app.rt.error_text,id..": "..tostring(h.app.rt.error_text))
end
print("passed: 1, failed: 0")
h:dispose()
app.close_world(false)
app.delete_world("kompot_transform_check")
