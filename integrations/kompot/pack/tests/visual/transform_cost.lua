-- Запускать в GUI: замеры CPU обновления готовых слоёв, без GPU draw/readback.
app.config_packs({"base","kompot"})
app.new_world("kompot_transform_cost","1","core:default")
local K=require "kompot:kompot"
local rows={}
local h=K.mount({content=function() end})
for _,kind in ipairs({"image","container"}) do
 for _,size in ipairs({32,64,128,256}) do
  for _,count in ipairs(size==256 and {1} or {1,8}) do
   local angle,offset=K.new_state(15),K.new_state(0)
   h:set_content(function()
    K.Box({modifier=K.M:offset(offset.value,0):size(1024,768)},function()
     for i=1,count do
      local m=K.M:offset(((i-1)%4)*(size+8),math.floor((i-1)/4)*(size+8)):size(size):rotate(angle.value)
      if kind=="image" then K.Image("kompot_ui_icons:settings",{modifier=m})
      else K.Box({modifier=m:background("#386F94",8):padding(4)},function() K.Text("Kompot") end) end
     end
    end)
   end)
   app.sleep(0.3)
   assert(not h.app.rt.error_text,h.app.rt.error_text)
   for _,entry in pairs(h.backend.entries) do
    if entry.layer_backend then
     assert(entry.source_canvas and entry.source_canvas.width==entry.source_width and entry.source_canvas.height==entry.source_height,
      "layer source not ready at the requested size")
    end
   end
   for _,mode in ipairs({"unchanged","move","rotate"}) do
    local samples={}
    for i=1,8 do
     if mode=="move" then offset.value=i
     elseif mode=="rotate" then angle.value=15+i end
     local start=os.clock()
     if mode=="unchanged" then h.backend:apply(h.app.dl)
     else h.app:frame(1/60) end
     samples[i]=(os.clock()-start)*1000
    end
    table.sort(samples)
    local row={kind=kind,size=size,count=count,mode=mode,median_ms=(samples[4]+samples[5])/2,max_ms=samples[8]}
    rows[#rows+1]=row
    print(string.format("%s %dx%d x%d %s: %.3f ms",kind,size,size,count,mode,row.median_ms))
   end
  end
 end
end
file.write("export:transform-cost.json",json.tostring({rows=rows,metric="CPU apply/frame; warmed static source; excludes GPU draw/readback"}))
h:dispose()
app.close_world(false)
app.delete_world("kompot_transform_cost")
print("passed: 1, failed: 0")
