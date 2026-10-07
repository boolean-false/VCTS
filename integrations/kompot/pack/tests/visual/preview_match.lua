app.config_packs({"base","kompot"})
app.new_world("kompot_preview_match","1","core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local P = require "kompot:kompot/preview"
local Fonts = require "kompot:kompot/fonts"
local material = K.nine_patch(K.raster({width=16,height=16,key="test:match",draw=function(cv)
 cv:clear(50,65,50,255)
 cv:rect(0,0,16,2,100,120,85,255)
 cv:rect(0,2,2,12,100,120,85,255)
 cv:rect(0,14,16,2,20,30,20,255)
 cv:rect(14,2,2,12,20,30,20,255)
 cv:rect(4,4,2,2,65,80,60,255)
end}),{border=2,center="tile",scale=2})
local content=function()
 K.Box({modifier=K.M:size(120,120):background_image(material):padding(12)},function()
  K.Text("Один материал для всех размеров")
 end)
end
P.register("reference",{width=120,height=120,padding=0,theme=UI.theme},content)
local h=K.mount({theme=UI.theme(),content=content})
app.sleep(0.8)
local m=h.backend.measurer
local metrics={lh=m:line_height("kompot_16")}
for _,ch in ipairs(K.text.chars("Один материал для всех размеровAgСледующий кадр")) do
 local b1,b2=ch:byte(1,2)
 local cp=#ch==1 and b1 or (b1-192)*64+b2-128
 metrics[cp]=m:width("kompot_16",ch)
end
Fonts.register_metrics({kompot_16=metrics})
function m:advances(font,text)
 local out={}
 for _,ch in ipairs(K.text.chars(text)) do out[#out+1]=self:width(font,ch) end
 return out
end
assert(m:width("kompot_16","Следующий кадр")+28==163)
local doc=json.parse(P.document("reference",h.app,m))
local expected={{"Один",39},{"материал",73},{"для всех",70},{"размеров",73}}
local line=0
for _,p in ipairs(doc.prims) do
 if p.kind=="text" then
  line=line+1
  assert(p.text==expected[line][1] and p.w==expected[line][2])
  assert(p.x==12 and p.y==12+(line-1)*24 and p.h==24)
 end
end
assert(line==4)
local screenshot=gui.screenshot()
local cv=Canvas({120,120})
local pos=h.host.wpos
cv:blit(screenshot,-pos[1],-(screenshot.height-pos[2]-120))
file.write_bytes("export:preview_match.png",cv:encode("png"))
print("passed: 1, failed: 0")
h:dispose()
app.close_world(false)
app.delete_world("kompot_preview_match")
