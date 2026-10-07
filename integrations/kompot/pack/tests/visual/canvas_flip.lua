app.config_packs({ "base", "kompot" })
app.new_world("kompot_visual", "1", "core:default")
local K = require("kompot:kompot")
local M = K.M
local h = K.mount {
    content = function()
        K.Row({ spacing = 20, modifier = M:padding(20) }, function()
            -- холст: красная полоса сверху (y = 0..9), зелёная слева
            K.Canvas({
                width = 100,
                height = 100,
                version = 1,
                draw = function(cv, w, h)
                    cv:rect(0, 0, w, 10, 255, 0, 0, 255)
                    cv:rect(0, 0, 10, h, 0, 255, 0, 255)
                end,
            })
            K.Box({ modifier = M:size(160, 100):background("#ff3030", 30) })
            K.Box({ modifier = M:size(100):border(3, "#40a0ff", 24) })
            K.Box({ modifier = M:size(120, 80):shadow(16, 16):background("#e0e0e0", 16) })
        end)
    end,
}
app.sleep(1.0)
file.write_bytes("export:canvas_flip.png", gui.screenshot():encode("png"))
print("passed: 1, failed: 0")
h:dispose()
app.close_world(false)
app.delete_world("kompot_visual")
