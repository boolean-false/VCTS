-- lua tests/standalone/nine_patch.lua /path/to/content
local root = assert(arg[1])
unpack = unpack or table.unpack
local native, modules = require, {}
function require(name)
    local pack, file = name:match("^([%w_%-]+):(.+)$")
    if not pack then
        return native(name)
    end
    if modules[name] then
        return modules[name]
    end
    modules[name] = assert(loadfile(root .. "/" .. pack .. "/modules/" .. file .. ".lua"))() or true
    return modules[name]
end
local K = require "kompot:kompot"
local P = require "kompot:kompot/core/paint"
local Cache = require "kompot:kompot/backend/paint_cache"
local B = require "kompot:kompot/backend/recorder"
local draws, allocations = 0, 0
local function raster(key, version)
    return K.raster({
        key = key,
        width = 16,
        height = 12,
        version = version,
        draw = function()
            draws = draws + 1
        end,
    })
end
local patch = K.nine_patch(
    raster("test"),
    { border = { 2, 3, 4, 1 }, center = "tile", edges = "tile", scale = 2 }
)
for _, size in ipairs({ { 100, 70 }, { 101, 73 }, { 3, 2 }, { 0, 10 }, { 3840, 2160 } }) do
    local parts = P.parts(patch, 7, 11, size[1], size[2])
    assert(#parts <= 9)
    local area = 0
    for _, q in ipairs(parts) do
        assert(q.x >= 7 and q.y >= 11 and q.x + q.w <= 7 + size[1] and q.y + q.h <= 11 + size[2])
        assert(q.w > 0 and q.h > 0 and q.sx + q.sw <= 16 and q.sy + q.sh <= 12)
        area = area + q.w * q.h
    end
    assert(area == size[1] * size[2], "gaps or overlapping nine-patch geometry")
end
local center = P.parts(patch, 0, 0, 101, 73)[5]
assert(center.repeat_x and center.repeat_y and center.w == 89 and center.sw == 10)
assert(not pcall(K.nine_patch, "bad", { source_size = { 16, 12 }, border = 9 }))
assert(not pcall(K.nine_patch, "bad", { source_size = { 16, 12 }, center = "unknown" }))
local cache = Cache.new({
    limit = 2,
    canvas = function(size)
        allocations = allocations + 1
        return {
            width = size[1],
            height = size[2],
            clear = function() end,
            blit = function() end,
            create_texture = function() end,
        }
    end,
})
cache:reset(1)
local a, b = cache:acquire(patch), cache:acquire(patch)
assert(a == b and draws == 1 and allocations == 10 and a.refs == 2)
cache:release(a)
local second = cache:acquire(K.nine_patch(raster("other"), { border = 2 }))
cache:release(second)
for i = 1, 100 do
    local r = cache:acquire(K.nine_patch(raster("changing", i), { border = 2 }))
    assert(r ~= a, "reused a texture still visible in another host")
    cache:release(r)
end
assert(#cache.slots == 2 and a.refs == 1, "idle cache must not grow with historical versions")
cache:release(b)
local builds = cache.builds
cache:reset(2)
local reloaded = cache:acquire(patch)
assert(cache.builds == builds + 1 and reloaded ~= a, "asset reload must rebuild source cells")
local recorder = B.new()
local app = K.App.new({
    backend = recorder,
    measurer = B.measurer(),
    width = 400,
    height = 300,
    content = function()
        K.Box({
            modifier = K.M
                :size(120, 80)
                :padding(10)
                :background_image(patch, "#FFFFFF80")
                :padding(4),
        }, function()
            K.Text("Content")
        end)
    end,
})
app:frame(0)
local p = assert(recorder:find("nine_patch"))
assert(p.x == 10 and p.y == 10 and p.w == 100 and p.h == 60, "modifier order")
assert(#app.regions == 0, "image backgrounds must not capture input")
app:dispose()
print("passed: nine-patch geometry, cache lifetime, reload and modifier semantics, failed: 0")
