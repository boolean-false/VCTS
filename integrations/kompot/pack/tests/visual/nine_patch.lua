app.config_packs({ "base", "kompot" })
app.new_world("nine_patch_test", "1", "core:default")
local K = require "kompot:kompot"
local backend = require "kompot:kompot/backend/voxelcore"
local M = K.M
local builds = 0
local function pixel(x, y)
    if x < 2 and y < 2 then
        return 255, 0, 0, 255
    end
    if x >= 14 and y < 2 then
        return 0, 255, 0, 255
    end
    if x < 2 and y >= 14 then
        return 0, 0, 255, 255
    end
    if x >= 14 and y >= 14 then
        return 255, 255, 255, 255
    end
    if y < 2 then
        return 255, 128, 0, 255
    end
    if y >= 14 then
        return 255, 255, 0, 255
    end
    if x < 2 then
        return 0, 255, 255, 255
    end
    if x >= 14 then
        return 255, 0, 255, 255
    end
    local v = (math.floor((x - 2) / 2) + math.floor((y - 2) / 2)) % 2 == 0 and 40 or 180
    return v, v, v, 255
end
local source = K.raster({
    key = "test:patch",
    width = 16,
    height = 16,
    draw = function(cv, w, h)
        builds = builds + 1
        for y = 0, h - 1 do
            for x = 0, w - 1 do
                cv:set(x, y, pixel(x, y))
            end
        end
    end,
})
local raw = Canvas({ 16, 16 })
for y = 0, 15 do
    for x = 0, 15 do
        raw:set(x, 15 - y, pixel(x, y))
    end
end
assets.load_texture(raw:encode("png"), "patch_fixture")
local generated = K.nine_patch(source, { border = 2, center = "tile", edges = "tile", scale = 2 })
local asset = K.nine_patch(
    "patch_fixture",
    { source_size = { 16, 16 }, border = 2, center = "tile", edges = "tile", scale = 2 }
)
local size = K.new_state(160)
local h = K.mount({
    content = function()
        K.Box({ modifier = M:offset(16, 16):size(size.value, 104):background_image(generated) })
        K.Box({ modifier = M:offset(200, 16):size(size.value, 104):background_image(asset) })
        K.Box({ modifier = M:offset(16, 140):size(157, 101):background_image(generated) })
        K.Box({ modifier = M:offset(200, 140):size(3, 3):background_image(generated) })
    end,
})
app.sleep(0.6)
assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
assert(builds == 1, "same source was regenerated for other target sizes")
local parts = 0
for _, entry in pairs(h.backend.entries) do
    if entry.patch_resource then
        parts = parts + #entry.parts
    end
end
assert(parts <= 36, "tile repetition created additional GUI nodes")
gui.close_menu()
file.write_bytes("export:nine_patch.png", gui.screenshot():encode("png"))
local before = backend._paint_cache.builds
size.value = 512
app.sleep(0.2)
assert(builds == 1 and backend._paint_cache.builds == before, "resizing rebuilt GPU textures")
h:dispose()
for _, slot in ipairs(backend._paint_cache.slots) do
    assert(slot.refs == 0, "disposed host retained source")
end
app.close_world(false)
print("passed: native nine-patch repeat, source sharing, resize and disposal, failed: 0")
