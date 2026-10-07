-- Хосты используют общие небольшие текстуры. Освободившиеся имена переиспользуем,
-- повторение делаем через UV, а размер окна на размер текстуры не влияет.
local Paint = require "kompot:kompot/core/paint"
local Cache = {}
Cache.__index = Cache
function Cache.new(opts)
    opts = opts or {}
    return setmetatable({
        slots = {},
        lookup = {},
        clock = 0,
        epoch = 0,
        limit = opts.limit or 64,
        canvas = opts.canvas or function(size)
            return Canvas(size)
        end,
        image = opts.image or function(src)
            return assets.to_canvas(src)
        end,
        builds = 0,
    }, Cache)
end
function Cache:reset(epoch)
    self.slots, self.lookup, self.clock, self.epoch = {}, {}, 0, epoch
end
function Cache:release(resource)
    if resource then
        resource.refs = math.max(0, resource.refs - 1)
    end
end
function Cache:acquire(p)
    local key = Paint.key(p)
    self.clock = self.clock + 1
    local r = self.lookup[key]
    if r then
        r.refs, r.used = r.refs + 1, self.clock
        return r
    end
    local source, flip
    if type(p.src) == "table" then
        source, flip = self.canvas({ p.width, p.height }), true
        source:clear()
        p.src.draw(require("kompot:kompot/core/canvas").wrap(source,p.width,p.height,
            require("kompot:kompot/core/canvas").engine_loader), p.width, p.height)
    else
        source = assert(self.image(p.src), "background texture not loaded: " .. p.src)
        assert(
            source.width == p.width and source.height == p.height,
            "background source_size does not match texture"
        )
    end
    local slot
    if #self.slots >= self.limit then
        for _, old in ipairs(self.slots) do
            if old.refs == 0 and (not slot or old.used < slot.used) then
                slot = old
            end
        end
    end
    if slot then
        self.lookup[slot.key] = nil
    else
        slot = { id = #self.slots + 1 }
        self.slots[slot.id] = slot
    end
    slot.key, slot.refs, slot.used, slot.flip, slot.cells = key, 1, self.clock, flip, {}
    local b = p.border
    local xs, ys = { 0, b[1], p.width - b[3], p.width }, { 0, b[2], p.height - b[4], p.height }
    for row = 1, 3 do
        for col = 1, 3 do
            local w, h = xs[col + 1] - xs[col], ys[row + 1] - ys[row]
            if w > 0 and h > 0 then
                local index = (row - 1) * 3 + col
                local cv = self.canvas({ w, h })
                cv:blit(source, -xs[col], -(flip and ys[row] or (p.height - ys[row + 1])))
                local name = "kompot_patch_" .. self.epoch .. "_" .. slot.id .. "_" .. index
                cv:create_texture(name)
                slot.cells[index] = { name = name, canvas = cv }
            end
        end
    end
    self.lookup[key], self.builds = slot, self.builds + 1
    return slot
end
return Cache
