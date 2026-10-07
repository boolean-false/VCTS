-- Анимации: плавное изменение чисел и цветов (массивов чисел).
--
--   local w = kompot.animate(expanded and 240 or 64, kompot.spring())
--   local c = kompot.animate(hovered and theme.primary or theme.surface, kompot.tween(0.15))
--   local t = kompot.clock()   -- время для бесконечных анимаций

local runtime = require "kompot:kompot/core/runtime"

local A = {}

local abs, sqrt, sin, cos, pi, min = math.abs, math.sqrt, math.sin, math.cos, math.pi, math.min

-- Кривые

local EASING = {
    linear = function(t)
        return t
    end,
    in_quad = function(t)
        return t * t
    end,
    out_quad = function(t)
        return 1 - (1 - t) * (1 - t)
    end,
    in_out_quad = function(t)
        if t < 0.5 then
            return 2 * t * t
        end
        return 1 - (-2 * t + 2) ^ 2 / 2
    end,
    in_cubic = function(t)
        return t * t * t
    end,
    out_cubic = function(t)
        return 1 - (1 - t) ^ 3
    end,
    in_out_cubic = function(t)
        if t < 0.5 then
            return 4 * t * t * t
        end
        return 1 - (-2 * t + 2) ^ 3 / 2
    end,
    out_back = function(t)
        local c1, c3 = 1.70158, 2.70158
        return 1 + c3 * (t - 1) ^ 3 + c1 * (t - 1) ^ 2
    end,
    out_elastic = function(t)
        if t == 0 or t == 1 then
            return t
        end
        return 2 ^ (-10 * t) * sin((t * 10 - 0.75) * (2 * pi) / 3) + 1
    end,
    -- "стандартная" кривая Material: быстрый старт, мягкая посадка
    standard = function(t)
        return 1 - (1 - t) ^ 3.2
    end,
}
A.EASING = EASING

function A.tween(duration, easing)
    return { kind = "tween", duration = duration or 0.25, easing = easing or "standard" }
end

-- stiffness: жёсткость (200 - мягко, 800 - резко), damping: доля
-- критического затухания (1 - без отскока, 0.5 - с отскоком).
function A.spring(stiffness, damping)
    return { kind = "spring", stiffness = stiffness or 380, damping = damping or 0.78 }
end

A.snap = { kind = "snap" }

-- Значения: число или массив чисел

local function is_num(v)
    return type(v) == "number"
end

local function copy(v)
    if is_num(v) then
        return v
    end
    local out = {}
    for i = 1, #v do
        out[i] = v[i]
    end
    return out
end

local function equal(a, b)
    if is_num(a) or is_num(b) then
        return a == b
    end
    if #a ~= #b then
        return false
    end
    for i = 1, #a do
        if abs(a[i] - b[i]) > 1e-6 then
            return false
        end
    end
    return true
end

local function lerp(a, b, t)
    if is_num(a) then
        return a + (b - a) * t
    end
    local out = {}
    for i = 1, #b do
        out[i] = (a[i] or b[i]) + (b[i] - (a[i] or b[i])) * t
    end
    return out
end

-- Объект анимации

local Anim = {}
Anim.__index = Anim

function Anim:start(target, spec)
    self.from = copy(self.value)
    self.to = copy(target)
    self.spec = spec
    self.t = 0
    if spec.kind == "spring" and not self.vel then
        self.vel = is_num(target) and 0 or {}
    end
end

function Anim:step(dt)
    local spec = self.spec
    if spec.kind == "snap" then
        self.value = copy(self.to)
        return false
    elseif spec.kind == "tween" then
        self.t = self.t + dt / spec.duration
        if self.t >= 1 then
            self.value = copy(self.to)
            return false
        end
        local e = (EASING[spec.easing] or EASING.standard)(self.t)
        self.value = lerp(self.from, self.to, e)
        return true
    end
    -- пружина: полунеявный Эйлер с подшагами
    local k = spec.stiffness
    local c = 2 * spec.damping * sqrt(k)
    local steps = math.max(1, math.ceil(dt / (1 / 240)))
    local h = dt / steps
    local running = false
    if is_num(self.value) then
        local x, v, to = self.value, self.vel, self.to
        for _ = 1, steps do
            v = v + (-k * (x - to) - c * v) * h
            x = x + v * h
        end
        if abs(x - to) < 0.01 and abs(v) < 0.05 then
            x, v = to, 0
        else
            running = true
        end
        self.value, self.vel = x, v
    else
        local vel = self.vel
        local value = self.value
        for i = 1, #self.to do
            local x, v, to = value[i] or self.to[i], vel[i] or 0, self.to[i]
            for _ = 1, steps do
                v = v + (-k * (x - to) - c * v) * h
                x = x + v * h
            end
            if abs(x - to) < 0.0005 and abs(v) < 0.002 then
                x, v = to, 0
            else
                running = true
            end
            value[i], vel[i] = x, v
        end
        self.value = value
    end
    return running
end

-- Хук: текущее значение, плавно идущее к target.
function A.animate(target, spec)
    spec = spec or A.tween()
    local scope = runtime.current_scope()
    local a = runtime._remember("animate", function()
        return setmetatable(
            { __anim = true, value = copy(target), to = copy(target), spec = spec },
            Anim
        )
    end)
    a.scope = scope
    if not equal(a.to, target) then
        a:start(target, spec)
        runtime.runtime():add_anim(a)
    end
    return a.value
end

-- Хук: время в секундах с начала жизни компонента; держит перерисовку
-- каждый кадр, пока компонент в композиции.
function A.clock()
    local rt = runtime.runtime()
    local a = runtime._remember("clock", function()
        local obj = { __anim = true, t0 = rt.time }
        obj.step = function()
            return true
        end
        return obj
    end)
    a.scope = runtime.current_scope()
    rt:add_anim(a)
    return rt.time - a.t0
end

-- Хук-таймер: true, когда с момента появления (или смены key) прошло
-- seconds секунд. Тикает только своё время, не держит перерисовку дольше.
function A.after(seconds, key)
    local rt = runtime.runtime()
    local a = runtime._remember("after", function()
        local obj = setmetatable({
            __anim = true,
            value = 0,
            from = 0,
            to = 1,
            t = 0,
            spec = A.tween(math.max(seconds, 1e-3), "linear"),
        }, Anim)
        rt:add_anim(obj)
        return obj
    end, key)
    a.scope = runtime.current_scope()
    return a.value >= 1
end

A.lerp = lerp

return A
