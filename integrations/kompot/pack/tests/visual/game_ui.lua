local function snapshot(path)
    gui.close_menu()
    app.sleep(0.05)
    file.write_bytes(path, gui.screenshot():encode("png"))
end
app.config_packs({ "base", "kompot" })
app.new_world("voxel_visual", "1", "base:demo")
world.set_day_time(0.45)
world.set_day_time_speed(0)
app.sleep(3)
player.set_flight(0, true)
local px, py, pz = player.get_pos(0)
player.set_pos(0, px, py + 14, pz)
player.set_rot(0, 0, -20, 0)
app.sleep(0.4)
local K = require "kompot:kompot"
local V = require "kompot:ui"
local E = require "kompot:ui/examples"
local G = require "kompot:ui/game_gallery"
local page = K.new_state(1)
local h = K.mount({
    theme = V.theme(),
    content = function()
        G.App({ page = page })
    end,
})
app.sleep(1)
for i = 1, #E.pages do
    page.value = i
    app.sleep(0.6)
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
    snapshot("export:voxel_" .. i .. ".png")
end
local function frame(input)
    gui.close_menu()
    h.fake_input = input
    app.sleep(0.1)
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
end
local function click(tag)
    local r = assert(h.app:find_tag(tag), tag)
    local x, y = r.x + r.w / 2, r.y + r.h / 2
    frame({ x = x, y = y, down = false, inside = true })
    frame({ x = x, y = y, down = true, inside = true })
    frame({ x = x, y = y, down = false, inside = true })
end
page.value = 1
app.sleep(0.4)
local source, target = h.app:find_tag("slot_1"), h.app:find_tag("slot_8")
local x, y = source.x + 20, source.y + 20
frame({ x = x, y = y, down = false, inside = true })
frame({ x = x, y = y, down = true, inside = true })
frame({ x = x + 12, y = y, down = true, inside = true })
frame({ x = target.x + 20, y = target.y + 20, down = true, inside = true })
snapshot("export:voxel_drag.png")
frame({ x = target.x + 20, y = target.y + 20, down = false, inside = true })
-- Draw-list coordinates inside the scroll host are local; tag hit regions
-- are absolute. Compare item order and column spacing within the same clip.
local rendered = {}
for _, primitive in ipairs(h.app.dl) do
    if primitive.kind == "image" and primitive.src:find("block-previews:", 1, true) == 1 then
        rendered[#rendered + 1] = primitive
    end
end
assert(rendered[1].src == "block-previews:base:wood", "source slot was not cleared")
assert(
    rendered[6].src == "block-previews:base:stone" and rendered[6].x - rendered[1].x == 6 * 56,
    "stone did not reach column 8"
)
page.value = 4
app.sleep(0.4)
click("apply")
app.sleep(0.3)
snapshot("export:voxel_dialog.png")
-- Remount page to clear local modal state before checking a menu.
page.value = 5
app.sleep(0.2)
page.value = 4
app.sleep(0.2)
click("menu")
app.sleep(0.3)
snapshot("export:voxel_menu.png")
h:dispose()
h = K.mount({
    theme = V.theme(),
    content = function()
        V.HUD({
            items = E.items(),
            health = 80,
            energy = 65,
            experience = 35,
            selected = 2,
            prompt = { binding = "E", text = "Открыть мастерскую" },
        })
    end,
})
app.sleep(0.4)
assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
snapshot("export:voxel_hud.png")
h:dispose()
for _, entry in ipairs({
    { "chest", E.Inventory },
    { "pause", E.Pause },
    { "workbench", E.Machine },
}) do
    h = K.mount({
        theme = V.theme(),
        content = function()
            K.Box({ modifier = K.M:fill_max_size():padding(16), align = "center" }, entry[2])
        end,
    })
    app.sleep(0.3)
    snapshot("export:quiet_" .. entry[1] .. ".png")
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
    h:dispose()
end
world.set_day_time(0.9)
h = K.mount({
    theme = V.theme(),
    content = function()
        K.Box({ modifier = K.M:fill_max_size():padding(16), align = "center" }, E.Inventory)
    end,
})
app.sleep(0.3)
snapshot("export:quiet_chest_night.png")
h:dispose()
world.set_day_time(0.45)
gui.root.root:add("<container id='voxel_narrow' size='360,640' pos='0,0'/>")
page.value = 1
h = K.mount({
    target = gui.root.voxel_narrow,
    theme = V.theme(),
    content = function()
        G.App({ page = page })
    end,
})
for _, i in ipairs({ 1, 3, 4 }) do
    page.value = i
    app.sleep(0.3)
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
    snapshot("export:voxel_narrow_" .. i .. ".png")
end
h:dispose()
gui.root.voxel_narrow:destruct()
for _ = 1, 2 do
    V.open_gallery()
    app.sleep(0.2)
    assert(hud.is_open("kompot:gallery"))
    hud.close("kompot:gallery")
    app.sleep(0.2)
    assert(not hud.is_open("kompot:gallery"))
end
app.close_world(false)
print("passed: visual gallery and lifecycle, failed: 0")
