-- Цвета Kompot: таблицы {r, g, b, a} с компонентами 0..1.
-- Цвет считается неизменяемым: все функции возвращают новый.

local color = {}

local floor, min, max, abs = math.floor, math.min, math.max, math.abs

local function clamp01(v)
    if v < 0 then
        return 0
    end
    if v > 1 then
        return 1
    end
    return v
end

function color.rgb(r, g, b, a)
    return { r, g, b, a or 1 }
end

-- "#RGB", "#RRGGBB", "#RRGGBBAA"
function color.hex(s)
    s = s:gsub("^#", "")
    if #s == 3 then
        s = s:sub(1, 1):rep(2) .. s:sub(2, 2):rep(2) .. s:sub(3, 3):rep(2)
    end
    local r = tonumber(s:sub(1, 2), 16) or 0
    local g = tonumber(s:sub(3, 4), 16) or 0
    local b = tonumber(s:sub(5, 6), 16) or 0
    local a = #s >= 8 and (tonumber(s:sub(7, 8), 16) or 255) or 255
    return { r / 255, g / 255, b / 255, a / 255 }
end

-- Принимает цвет в любом виде: таблица, "#hex", nil.
function color.of(v)
    if v == nil then
        return nil
    elseif type(v) == "string" then
        return color.hex(v)
    end
    return v
end

function color.to_hex(c)
    return string.format(
        "#%02X%02X%02X%02X",
        floor(clamp01(c[1]) * 255 + 0.5),
        floor(clamp01(c[2]) * 255 + 0.5),
        floor(clamp01(c[3]) * 255 + 0.5),
        floor(clamp01(c[4] or 1) * 255 + 0.5)
    )
end

function color.with_alpha(c, a)
    return { c[1], c[2], c[3], a }
end

function color.mul_alpha(c, k)
    return { c[1], c[2], c[3], (c[4] or 1) * k }
end

function color.mix(a, b, t)
    return {
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
        a[3] + (b[3] - a[3]) * t,
        (a[4] or 1) + ((b[4] or 1) - (a[4] or 1)) * t,
    }
end

-- Накладывает over поверх base с учётом альфы (как слой в Material).
function color.over(base, over)
    local a = over[4] or 1
    local b = (base[4] or 1) * (1 - a)
    local alpha = a + b
    if alpha == 0 then
        return { 0, 0, 0, 0 }
    end
    return {
        (over[1] * a + base[1] * b) / alpha,
        (over[2] * a + base[2] * b) / alpha,
        (over[3] * a + base[3] * b) / alpha,
        alpha,
    }
end

function color.equals(a, b)
    if a == b then
        return true
    end
    if not a or not b then
        return false
    end
    return abs(a[1] - b[1]) < 1e-4
        and abs(a[2] - b[2]) < 1e-4
        and abs(a[3] - b[3]) < 1e-4
        and abs((a[4] or 1) - (b[4] or 1)) < 1e-4
end

-- HSL

function color.to_hsl(c)
    local r, g, b = c[1], c[2], c[3]
    local mx, mn = max(r, g, b), min(r, g, b)
    local l = (mx + mn) / 2
    if mx == mn then
        return 0, 0, l
    end
    local d = mx - mn
    local s = l > 0.5 and d / (2 - mx - mn) or d / (mx + mn)
    local h
    if mx == r then
        h = (g - b) / d + (g < b and 6 or 0)
    elseif mx == g then
        h = (b - r) / d + 2
    else
        h = (r - g) / d + 4
    end
    return h * 60, s, l
end

local function hue2rgb(p, q, t)
    if t < 0 then
        t = t + 1
    end
    if t > 1 then
        t = t - 1
    end
    if t < 1 / 6 then
        return p + (q - p) * 6 * t
    end
    if t < 1 / 2 then
        return q
    end
    if t < 2 / 3 then
        return p + (q - p) * (2 / 3 - t) * 6
    end
    return p
end

-- h в градусах, s и l 0..1.
function color.hsl(h, s, l, a)
    h = (h % 360) / 360
    s, l = clamp01(s), clamp01(l)
    if s == 0 then
        return { l, l, l, a or 1 }
    end
    local q = l < 0.5 and l * (1 + s) or l + s - l * s
    local p = 2 * l - q
    return { hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3), a or 1 }
end

function color.lighten(c, amount)
    local h, s, l = color.to_hsl(c)
    return color.hsl(h, s, l + amount, c[4])
end

function color.darken(c, amount)
    return color.lighten(c, -amount)
end

-- Контраст (WCAG)

local function channel(v)
    if v <= 0.03928 then
        return v / 12.92
    end
    return ((v + 0.055) / 1.055) ^ 2.4
end

function color.luminance(c)
    return 0.2126 * channel(c[1]) + 0.7152 * channel(c[2]) + 0.0722 * channel(c[3])
end

function color.contrast(a, b)
    local la, lb = color.luminance(a), color.luminance(b)
    if la < lb then
        la, lb = lb, la
    end
    return (la + 0.05) / (lb + 0.05)
end

-- Цвет текста/иконок, читаемый на фоне bg.
function color.on(bg, dark, light)
    dark = dark or { 0.07, 0.07, 0.09, 1 }
    light = light or { 1, 1, 1, 1 }
    if color.contrast(bg, dark) >= color.contrast(bg, light) then
        return dark
    end
    return light
end

-- Тональная палитра: тон 0 (чёрный) .. 100 (белый) при сохранении оттенка.
-- Насыщенность слегка гасится у краёв, чтобы светлые и тёмные тона не
-- "кислотили" (упрощение HCT из Material 3).

function color.tone(c, tone, chroma)
    local h, s = color.to_hsl(c)
    local l = tone / 100
    local edge = 1 - abs(l - 0.5) * 2 -- 1 в середине, 0 по краям
    local sat = (chroma or s) * (0.35 + 0.65 * edge ^ 0.6)
    return color.hsl(h, sat, l, 1)
end

function color.palette(c, chroma)
    local p = {}
    for _, t in ipairs({
        0,
        5,
        10,
        15,
        20,
        25,
        30,
        35,
        40,
        50,
        60,
        70,
        80,
        85,
        90,
        92,
        94,
        95,
        96,
        98,
        99,
        100,
    }) do
        p[t] = color.tone(c, t, chroma)
    end
    return p
end

-- Для бэкенда: {r, g, b, a} в 0..255.
function color.to255(c, alpha_mul)
    return {
        floor(clamp01(c[1]) * 255 + 0.5),
        floor(clamp01(c[2]) * 255 + 0.5),
        floor(clamp01(c[3]) * 255 + 0.5),
        floor(clamp01((c[4] or 1) * (alpha_mul or 1)) * 255 + 0.5),
    }
end

color.WHITE = { 1, 1, 1, 1 }
color.BLACK = { 0, 0, 0, 1 }
color.TRANSPARENT = { 0, 0, 0, 0 }

return color
