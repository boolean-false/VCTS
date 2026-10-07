app.config_packs({ "base", "kompot" })
app.new_world("kompot_gallery_close", "1", "core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local mount = K.mount
local mounted
K.mount = function(opts)
    mounted = mount(opts)
    return mounted
end
for i = 1, 3 do
    UI.open_gallery()
    app.sleep(0.7)
    local h = assert(mounted)
    assert(hud.is_open("kompot:gallery"))
    local p = assert(h.app:find_tag("close_gallery"))
    local x, y = p.x + p.w / 2, p.y + p.h / 2
    for _, down in ipairs({ false, true, false }) do
        h.fake_input = { x = x, y = y, down = down, inside = true }
        app.sleep(0.1)
    end
    app.sleep(0.2)
    assert(not hud.is_open("kompot:gallery"), "close button did not close gallery")
    assert(h.disposed and h.app.rt.disposed, "mount not disposed")
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
end
K.mount = mount
print("passed: 1, failed: 0")
app.close_world(false)
app.delete_world("kompot_gallery_close")
