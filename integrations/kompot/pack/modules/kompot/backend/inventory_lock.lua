-- Блокировка стандартного действия hud.inventory (Tab) на время работы с UI.
--
-- Каждый хост держит блокировку как аренду: продлевает её в своём
-- интервале. Интервал останавливается, когда хост уничтожен или его макет
-- закрыт, в том числе без handle:dispose(). Сторож из scripts/hud.lua
-- (on_hud_render) снимает такие просроченные аренды, а on_hud_close - все.
-- Если хост снова заработает, он возьмёт блокировку заново.

local Lock = {}

-- Сколько кадров сторожа аренда живёт без продления.
local GRACE_FRAMES = 3

---@class KompotInventoryLease
---@field held boolean
---@field seen integer
local Lease = {}
Lease.__index = Lease

---@type table<KompotInventoryLease, true>
local leases = {}
local count = 0
local frame = 0

local function set_enabled(enabled)
    input.set_enabled("hud.inventory", enabled)
end

-- Продлевает аренду: вызывать каждый кадр живого хоста.
function Lease:touch()
    self.seen = frame
end

---@param block boolean
function Lease:set(block)
    if self.held == block then
        return
    end
    self.held = block
    if block then
        self.seen = frame
        leases[self] = true
        count = count + 1
        if count == 1 then
            set_enabled(false)
        end
    else
        leases[self] = nil
        count = count - 1
        if count == 0 then
            set_enabled(true)
        end
    end
end

-- Новая аренда (по одной на хост).
---@return KompotInventoryLease
function Lock.new()
    return setmetatable({ held = false, seen = frame }, Lease)
end

-- Сторож: раз в кадр HUD снимает аренды хостов, которые перестали тикать.
function Lock.watch()
    frame = frame + 1
    for lease in pairs(leases) do
        if frame - lease.seen > GRACE_FRAMES then
            lease:set(false)
        end
    end
end

-- Выход из мира: блокировки не переживают HUD.
function Lock.release_all()
    for lease in pairs(leases) do
        lease:set(false)
    end
end

-- Число активных блокировок (для тестов).
function Lock.count()
    return count
end

return Lock
