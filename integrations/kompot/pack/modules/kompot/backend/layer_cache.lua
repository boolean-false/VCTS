-- Reuse rendered layers across display-list key changes. This is a visual
-- cache only: component state and input identity remain owned by the runtime.
local R = require "kompot:kompot/core/runtime"
local Cache = {}

local function map_keys(a, b, keys)
    if #a ~= #b then return false end
    for i, p in ipairs(a) do
        local q = b[i]
        if p.key and q.key then keys[p.key] = q.key end
        if p.prims or q.prims then
            if not p.prims or not q.prims or not map_keys(p.prims, q.prims, keys) then
                return false
            end
        end
    end
    return true
end

local function same_primitives(a, b, keys)
    for i, p in ipairs(a) do
        local q = b[i]
        for k, v in pairs(p) do
            if k == "key" then
                -- Keys name resources; they do not change their pixels.
            elseif k == "clip" then
                if (keys[v] or v) ~= q[k] then return false end
            elseif k == "prims" then
                if not same_primitives(v, q[k], keys) then return false end
            elseif k == "draw" and p.version ~= nil then
                -- Same version contract as Backend:_apply_canvas.
            elseif type(v) == "table" then
                if type(q[k]) ~= "table" or not R.shallow_equal(v, q[k]) then return false end
            elseif v ~= q[k] then
                return false
            end
        end
        for k in pairs(q) do
            if p[k] == nil then return false end
        end
    end
    return true
end

function Cache.equivalent(a, b)
    if a == b then return true end
    -- Reject unrelated moving world labels before inspecting their subtrees.
    if a.x ~= b.x or a.y ~= b.y or a.w ~= b.w or a.h ~= b.h
        or a.clip ~= b.clip or not R.shallow_equal(a.transform, b.transform) then
        return false
    end
    local keys = {}
    local left, right = {a}, {b}
    return map_keys(left, right, keys) and same_primitives(left, right, keys)
end

function Cache.reconcile(backend, dl)
    local layers, keys, old, changed = {}, {}, {}, false
    for _, p in ipairs(dl) do
        if p.kind == "layer" then
            layers[#layers + 1], keys[p.key] = p, true
            local entry = backend.entries[p.key]
            if not entry or not entry.prim or entry.prim.kind ~= "layer" then changed = true end
        end
    end
    for key, entry in pairs(backend.entries) do
        if entry.prim and entry.prim.kind == "layer" then
            old[#old + 1] = {key = key, entry = entry}
            if not keys[key] then changed = true end
        end
    end
    -- Normal animation/content updates retain the usual direct key lookup.
    if not changed or #old == 0 then return end

    local used, matches = {}, {}
    for _, p in ipairs(layers) do
        local container = backend.containers[p.clip or ""]
        local function matches_pixels(entry)
            return entry and not used[entry] and entry.prim and entry.prim.kind == "layer"
                and entry.container == container and Cache.equivalent(entry.prim, p)
        end
        local entry = backend.entries[p.key]
        if not matches_pixels(entry) then
            entry = nil
            for _, candidate in ipairs(old) do
                if matches_pixels(candidate.entry) then entry = candidate.entry; break end
            end
        end
        if entry then
            used[entry], matches[p.key] = true, {entry = entry, prim = p}
        end
    end
    -- Detach all matches before installing any: keys may form a permutation.
    for _, candidate in ipairs(old) do
        if used[candidate.entry] then backend.entries[candidate.key] = nil end
    end
    for key, match in pairs(matches) do
        local entry = match.entry
        local displaced = backend.entries[key]
        if displaced then backend:_destroy(displaced) end
        -- The staged pixels are identical. Adopt the new logical keys for
        -- comparison without rebuilding the stage or reading its GPU image.
        -- Its actual GUI entries keep their IDs until content really changes.
        if entry.source_prims then entry.source_prims = match.prim.prims end
        backend.entries[key] = entry
        backend.order_dirty[entry.container.key] = true
    end
end

return Cache
