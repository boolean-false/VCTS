app.config_packs({ "base", "kompot" })
app.new_world("kompot_visual", "1", "core:default")
local B = require("kompot:kompot/backend/voxelcore")
app.sleep(0.5)
local tex = B._circle_texture(40)
local root = gui.root.root
root:add("<container id='dbg_host' pos='0,0' size='600,400' color='#202020FF' z-index='20'/>")
local host = gui.root.dbg_host
host:add("<image id='dbg_full' src='" .. tex .. "' pos='10,10' size='80,80' color='#FF4040FF'/>")
host:add(
    "<image id='dbg_tl' src='"
        .. tex
        .. "' pos='120,10' size='40,40' region='0,0,0.5,0.5' color='#40FF40FF'/>"
)
host:add("<image id='dbg_br' src='" .. tex .. "' pos='180,10' size='40,40' color='#4040FFFF'/>")
local br = gui.root.dbg_br
br.region = { 0.5, 0.5, 1, 1 }
host:add("<image id='dbg_big' src='" .. tex .. "' pos='240,10' size='160,40' color='#FFFF40FF'/>")
app.sleep(0.5)
print("full size", unpack(gui.root.dbg_full.size))
print("tl size", unpack(gui.root.dbg_tl.size), "region", unpack(gui.root.dbg_tl.region or {}))
print("br region", unpack(gui.root.dbg_br.region or {}))
file.write_bytes("export:corners.png", gui.screenshot():encode("png"))
print("passed: 1, failed: 0")
app.close_world(false)
app.delete_world("kompot_visual")
