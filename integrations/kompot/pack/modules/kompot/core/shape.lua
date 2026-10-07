-- Переиспользуемая форма. Размеры углов разрешаются после раскладки.
-- Дескрипторы плоские: сравнение модификаторов не зависит от identity таблиц.
local S = {}
local names = { "top_left", "top_right", "bottom_right", "bottom_left" }

local function number(value, label, infinite)
    assert(type(value) == "number" and value == value and value >= 0
        and (infinite or value < math.huge), label .. " must be a non-negative number")
    return value
end

-- Фиксированный размер в пикселях.
function S.px(value)
    return { unit = "px", value = number(value, "pixels", true) }
end

-- Процент меньшей стороны, от 0 до 100 включительно.
function S.percent(value)
    number(value, "percent", false)
    assert(value <= 100, "percent must be between 0 and 100")
    return { unit = "percent", value = value }
end

local function size(value)
    if value == nil then return 0, "px" end
    if type(value) == "number" then return number(value, "corner size", true), "px" end
    assert(type(value) == "table", "corner size expects pixels or Shape.percent(...)")
    for key in pairs(value) do assert(key == "unit" or key == "value", "unknown corner size field: " .. tostring(key)) end
    assert(value.unit == "px" or value.unit == "percent", "unknown corner size unit")
    local checked = value.unit == "px" and S.px(value.value) or S.percent(value.value)
    return checked.value, checked.unit
end

local function corners(kind, value)
    local out = { kind = kind }
    local individual = type(value) == "table" and value.unit == nil
    if individual then
        for key in pairs(value) do
            local known = false
            for _, name in ipairs(names) do if key == name then known = true end end
            assert(known, "unknown corner: " .. tostring(key))
        end
    end
    for _, name in ipairs(names) do
        local v = value
        if individual then v = value[name] end
        out[name], out[name .. "_unit"] = size(v)
    end
    return out
end

-- Прямоугольник без скругления и без растровой маски.
function S.rectangle() return { kind = "rectangle" } end

-- Круг для квадрата, капсула для прямоугольника.
function S.circle() return { kind = "circle" } end

-- Круглые углы: один размер или {top_left, top_right, bottom_right, bottom_left}.
function S.rounded(value) return corners("rounded", value) end

-- Прямые срезы углов. Размер измеряется вдоль каждой прилегающей стороны.
function S.cut(value) return corners("cut", value) end

function S.is(value)
    return type(value) == "table" and (value.kind == "rectangle" or value.kind == "circle"
        or value.kind == "rounded" or value.kind == "cut")
end

function S.copy(value)
    assert(S.is(value), "unknown Shape kind")
    local out = { kind = value.kind }
    local corner_based = value.kind == "rounded" or value.kind == "cut"
    for key in pairs(value) do
        local known = key == "kind"
        if corner_based then
            for _, name in ipairs(names) do
                if key == name or key == name .. "_unit" then known = true end
            end
        end
        assert(known, "unknown Shape field: " .. tostring(key))
    end
    if corner_based then
        for _, name in ipairs(names) do
            out[name], out[name .. "_unit"] = size({value = value[name] == nil and 0 or value[name], unit = value[name .. "_unit"] == nil and "px" or value[name .. "_unit"]})
        end
    end
    return out
end

function S.resolve(value, w, h)
    if value.kind == "rectangle" then return 0 end
    local out = { kind = value.kind == "circle" and "rounded" or value.kind }
    local side = math.min(math.max(0,w),math.max(0,h))
    for _, name in ipairs(names) do
        local v = value.kind == "circle" and side / 2 or value[name]
        if value[name .. "_unit"] == "percent" then v = side * (v / 100) end
        out[name] = v == math.huge and side / 2 or v
    end
    return out
end

return S
