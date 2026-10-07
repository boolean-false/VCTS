app.config_packs({ "base", "kompot" })
app.new_world("kompot_texture_reload", "1", "core:default")
local B = require "kompot:kompot/backend/voxelcore"
local K = require "kompot:kompot"
local raster_builds = 0
local patch = K.nine_patch(
    K.raster({
        key = "test:reload",
        width = 8,
        height = 8,
        draw = function(cv)
            raster_builds = raster_builds + 1
            cv:clear(100, 150, 200, 255)
        end,
    }),
    { border = 2, center = "tile" }
)
local circle = B._circle_texture(12)
local shadow = B._shadow_texture(12, 8)
assert(assets.to_canvas(circle) and assets.to_canvas(shadow), "generated textures missing")

local old_patch = B._paint_cache:acquire(patch)
local old_patch_name = old_patch.cells[5].name
B._paint_cache:release(old_patch)
app.close_world(false)
app.reset_content()
assert(not assets.to_canvas(circle) and not assets.to_canvas(shadow), "reset kept textures")
local new_circle = B._circle_texture(12)
local new_shadow = B._shadow_texture(12, 8)
local new_patch = B._paint_cache:acquire(patch)
assert(new_patch.cells[5].name ~= old_patch_name and raster_builds == 2)
assert(assets.to_canvas(new_patch.cells[5].name), "nine-patch source was not recreated")
B._paint_cache:release(new_patch)
assert(new_circle ~= circle and new_shadow ~= shadow, "stale texture names reused")
assert(assets.to_canvas(new_circle) and assets.to_canvas(new_shadow), "textures not recreated")

app.config_packs({ "base", "kompot" })
app.new_world("kompot_texture_reload", "1", "core:default")
local K = require "kompot:kompot"
local M = K.M
local handle = K.mount {
    content = function()
        K.Box({
            modifier = M:size(100, 60)
                :background("#FF0000", 12)
                :border(2, "#00FF00", 12)
                :shadow(8, 12),
        })
    end,
}
app.sleep(0.5)
local seen = { rr = false, br = false, shadow = false }
for _, entry in pairs(handle.backend.entries) do
    if seen[entry.sig] ~= nil then
        for _, part in ipairs(entry.parts or {}) do
            if part.kind == "image" then
                assert(assets.to_canvas(part.cache.src), "UI uses a missing texture")
                seen[entry.sig] = true
            end
        end
    end
end
assert(seen.rr and seen.br and seen.shadow, "rounded primitives were not rendered")
handle:dispose()
app.close_world(false)
print("passed: 1, failed: 0")
app.delete_world("kompot_texture_reload")
