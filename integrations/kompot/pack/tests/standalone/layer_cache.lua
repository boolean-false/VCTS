-- lua tests/standalone/layer_cache.lua /path/to/content
local content = assert(arg[1])
local native, loaded = require, {}
function require(name)
    local pack, file = name:match("^([%w_%-]+):(.+)$")
    if not pack then return native(name) end
    if loaded[name] then return loaded[name] end
    loaded[name] = assert(loadfile(content .. "/" .. pack .. "/modules/" .. file .. ".lua"))() or true
    return loaded[name]
end
local Cache = require "kompot:kompot/backend/layer_cache"
local failed = 0
local function test(name, fn)
    local ok, err = xpcall(fn, debug.traceback)
    print((ok and "PASS " or "FAIL ") .. name)
    if not ok then failed = failed + 1; print(err) end
end
local function layer(key, caption, x)
    return {kind = "layer", key = key, clip = "", x = x or 10, y = 20, w = 100, h = 40,
        transform = {1.45, 0, 0, 1.45, 0, -18}, prims = {
            {kind = "clip", key = key .. "/clip", clip = "", x = 0, y = 0, w = 100, h = 40},
            {kind = "text", key = key .. "/text", clip = key .. "/clip",
                x = 2, y = 2, w = 80, h = 16, text = caption, font = "normal"},
        }}
end
local function backend(prims)
    local root = {key = ""}
    local b = {entries = {}, containers = {[""] = root}, order_dirty = {}, destroyed = {}}
    function b:_destroy(entry) self.destroyed[#self.destroyed + 1] = entry end
    for _, p in ipairs(prims) do
        b.entries[p.key] = {prim = p, source_prims = p.prims,
            container = root, canvas = {label = p.prims[2].text}}
    end
    return b
end

test("equivalent pixels survive renamed primitive and clip keys", function()
    local a, b = layer("old", "health"), layer("new", "health")
    assert(Cache.equivalent(a, b))
    b.prims[2].clip = "unrelated-clip"
    assert(not Cache.equivalent(a, b), "different clipping reused old pixels")
end)
test("different text, geometry, masks and transforms cannot borrow a snapshot", function()
    local a = layer("old", "health")
    for _, change in ipairs({
        function(b) b.prims[2].text = "slots" end,
        function(b) b.x = b.x + 1 end,
        function(b) b.w = b.w + 1 end,
        function(b) b.transform[1] = 1.2 end,
        function(b) b.mask_radius = 10 end,
    }) do
        local b = layer("new", "health")
        change(b)
        assert(not Cache.equivalent(a, b))
    end
end)
test("nested layers retain their own masks and clip relationships when rekeyed", function()
    local a, b = layer("old", "health"), layer("new", "health")
    a.prims[2], b.prims[2] = layer("old/inner", "slots"), layer("new/inner", "slots")
    a.prims[2].clip, b.prims[2].clip = "old/clip", "new/clip"
    a.prims[2].mask_radius, b.prims[2].mask_radius = {top_left = 8}, {top_left = 8}
    assert(Cache.equivalent(a, b))
    b.prims[2].mask_radius.top_left = 9
    assert(not Cache.equivalent(a, b), "different nested mask reused old pixels")
end)
test("shifted siblings preserve both existing canvases without destroying either", function()
    local a, b = layer("1", "health"), layer("2", "slots", 250)
    local host = backend({a, b})
    local health, slots = host.entries["1"], host.entries["2"]
    local next_health, next_slots = layer("2", "health"), layer("3", "slots", 250)
    Cache.reconcile(host, {next_health, next_slots})
    assert(host.entries["1"] == nil)
    assert(host.entries["2"] == health and host.entries["3"] == slots)
    assert(health.source_prims == next_health.prims and slots.source_prims == next_slots.prims,
        "unchanged staged pixels would be captured again just because their keys changed")
    assert(#host.destroyed == 0)
    assert(host.order_dirty[""])
end)
test("a replaced layer is destroyed once without destroying a moved match", function()
    local host = backend({layer("1", "health"), layer("2", "obsolete", 250)})
    local health, obsolete = host.entries["1"], host.entries["2"]
    Cache.reconcile(host, {layer("2", "health"), layer("3", "new", 250)})
    assert(host.entries["2"] == health and host.entries["3"] == nil)
    assert(#host.destroyed == 1 and host.destroyed[1] == obsolete)
end)
test("key permutations detach every match before displacing any resource", function()
    local host = backend({layer("1", "health"), layer("2", "slots", 250)})
    local health, slots = host.entries["1"], host.entries["2"]
    Cache.reconcile(host, {layer("2", "health"), layer("1", "slots", 250), layer("3", "new", 400)})
    assert(host.entries["2"] == health and host.entries["1"] == slots)
    assert(host.entries["3"] == nil and #host.destroyed == 0)
end)
test("ordinary keyed content updates keep their backend entry", function()
    local host = backend({layer("hud", "health")})
    local previous = host.entries.hud
    Cache.reconcile(host, {layer("hud", "health 90")})
    assert(host.entries.hud == previous and #host.destroyed == 0)
end)
test("a different parent container cannot reuse an existing GUI element", function()
    local host = backend({layer("old", "health")})
    host.containers.other = {key = "other"}
    local next_layer = layer("new", "health")
    next_layer.clip = "other"
    Cache.reconcile(host, {next_layer})
    assert(host.entries.new == nil and #host.destroyed == 0)
end)
test("versioned Canvas sources obey their existing invalidation contract", function()
    local a, b = layer("old", "health"), layer("new", "health")
    a.prims[2], b.prims[2] =
        {kind = "canvas", key = "a", clip = "old/clip", version = 7, draw = function() end},
        {kind = "canvas", key = "b", clip = "new/clip", version = 7, draw = function() end}
    assert(Cache.equivalent(a, b))
    b.prims[2].version = 8
    assert(not Cache.equivalent(a, b))
    a.prims[2].version, b.prims[2].version = nil, nil
    assert(not Cache.equivalent(a, b))
end)
assert(failed == 0, "layer cache failures: " .. failed)
