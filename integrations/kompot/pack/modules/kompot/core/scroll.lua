-- Состояния прокрутки: обычной (vertical_scroll / horizontal_scroll) и
-- ленивых списков. Читаются раскладкой через version (State), поэтому
-- изменение прокрутки перезапускает только раскладку, не композицию.

local runtime = require "kompot:kompot/core/runtime"

local S = {}

-- Обычная прокрутка

local Scroll = {}
Scroll.__index = Scroll

function S.new_scroll(initial)
    return setmetatable({
        value = initial or 0,
        max = 0,
        view = 0,
        step = 48,
        version = runtime.new_state(0),
    }, Scroll)
end

function Scroll:_bump()
    self.version:set(self.version:peek() + 1)
end

-- Для раскладки: подписывает на изменения и возвращает смещение.
function Scroll:_offset()
    local _ = self.version.value
    return self.value
end

function Scroll:_set_limits(max, view)
    local changed = self.max ~= max or self.view ~= view
    self.max, self.view = max, view
    if self.value > max then
        self.value = max
    end
    if self.value < 0 then
        self.value = 0
    end
    -- Полосы прокрутки читают fraction() в композиции: новые пределы должны их
    -- перерисовать, иначе полоса появится только после первой прокрутки.
    -- Уведомление только при изменении: повторная раскладка его не вызывает.
    if changed then
        self:_bump()
    end
end

-- Прокручивает на delta пикселей. Возвращает, сколько реально прокрутилось.
function Scroll:scroll_by(delta)
    local old = self.value
    local v = math.max(0, math.min(self.max, old + delta))
    if v ~= old then
        self.value = v
        self:_bump()
    end
    return v - old
end

function Scroll:scroll_to(v)
    return self:scroll_by(v - self.value)
end

-- Доля прокрутки 0..1 и доля видимой части (для полосы прокрутки).
function Scroll:fraction()
    local _ = self.version.value
    if self.max <= 0 then
        return 0, 1
    end
    return self.value / self.max, self.view / (self.view + self.max)
end

-- Ленивые списки

local Lazy = {}
Lazy.__index = Lazy

function S.new_lazy()
    return setmetatable({
        first = 1,
        offset = 0,
        pending = 0,
        sizes = {},
        size_sum = 0,
        size_n = 0,
        total = 0,
        view = 0,
        pos = 0,
        step = 48,
        version = runtime.new_state(0),
    }, Lazy)
end

function Lazy:_bump()
    self.version:set(self.version:peek() + 1)
end

function Lazy:_set_total(total, view, pos)
    pos = pos or 0
    local changed = self.total ~= total or self.view ~= view or self.pos ~= pos
    self.total, self.view, self.pos = total, view, pos
    -- first/fraction читаются при композиции, до расчёта новой позиции.
    -- Обновляем их подписчиков после уточнения положения раскладкой.
    if changed then
        self:_bump()
    end
end

function Lazy:scroll_by(delta)
    -- на краях не поглощаем колесо, чтобы прокручивался родитель
    if delta < 0 and self.first == 1 and self.offset <= 0 then
        return 0
    end
    if delta > 0 and self.pos + self.view >= self.total - 0.5 then
        return 0
    end
    self.pending = self.pending + delta
    self:_bump()
    return delta
end

function Lazy:scroll_to_item(index)
    self.request = index
    self:_bump()
end

function Lazy:first_visible()
    local _ = self.version.value
    return self.first
end

function Lazy:fraction()
    local _ = self.version.value
    local range = self.total - self.view
    if range <= 0 then
        return 0, 1
    end
    return math.max(0, math.min(1, self.pos / range)), math.min(1, self.view / self.total)
end

return S
