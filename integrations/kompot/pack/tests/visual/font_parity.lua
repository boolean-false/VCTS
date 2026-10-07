-- Driven by kompot_plugin/scripts/check-font-parity.py with an external fixture pack.
app.config_packs({"base","kompot","parity"})
app.new_world("font_parity","1","core:default")
local K=require "kompot:kompot"
local P=require "kompot:kompot/preview"
local cases=require "parity:cases"
app.sleep(0.8)
for _,case in ipairs(cases) do
 local h=K.mount({content=case.content,z_index=100000})
 app.sleep(0.25)
 local m=h.backend.measurer
 function m:advances(font,s)
  local a={}
  for _,ch in ipairs(K.text.chars(s)) do a[#a+1]=self:width(font,ch) end
  return a
 end
 local doc=json.parse(P.document(case.name,h.app,m))
 file.write("export:"..case.name..".json",json.tostring(doc))
 local screenshot=gui.screenshot()
 local cv=Canvas({case.width,case.height})
 local pos=h.host.wpos
 cv:blit(screenshot,-pos[1],-(screenshot.height-pos[2]-case.height))
 file.write_bytes("export:"..case.name..".png",cv:encode("png"))
 h:dispose()
end
print("passed: "..#cases..", failed: 0")
app.close_world(false)
app.delete_world("font_parity")
