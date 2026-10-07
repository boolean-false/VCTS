app.config_packs({ "base", "kompot" })
app.new_world("kompot_visual", "1", "core:default")
app.sleep(0.3)
local root = gui.root.root
root:add("<container id='sh' pos='0,0' size='300,200' color='#000000FF' z-index='20'/>")
local h = gui.root.sh
-- две полупрозрачные полосы встык: y 10..30 и 30..50
h:add("<container id='a1' pos='10,10' size='100,20' color='#FFFFFF60'/>")
h:add("<container id='a2' pos='10,30' size='100,20' color='#FFFFFF60'/>")
-- то же со сдвигом на полпикселя
h:add("<container id='b1' pos='120,10.5' size='100,20' color='#FFFFFF60'/>")
h:add("<container id='b2' pos='120,30.5' size='100,20' color='#FFFFFF60'/>")
app.sleep(0.3)
print("a1 size", unpack(gui.root.a1.size))
file.write_bytes("export:seam.png", gui.screenshot():encode("png"))
print("passed: 1, failed: 0")
app.close_world(false)
app.delete_world("kompot_visual")
