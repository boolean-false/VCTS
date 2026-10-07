-- Тема: механизм без дизайна.
--
-- Ядро Kompot не знает ни о Material, ни о каком-либо другом стиле. Тема -
-- обычная таблица, которую дизайн-система собирает как хочет. Ядро читает
-- из неё немногое:
--
--   theme.type[имя]      стили текста {font, bold?, size?}; Text{style = "имя"}
--   theme.default_style  стиль текста по умолчанию (иначе "body")
--   theme.colors         цвета; ядро берёт on_surface (цвет содержимого
--                        по умолчанию) и background (фон превью)
--   theme.ui             компоненты дизайн-системы (K.ui())
--   theme.fonts          шрифты для прогрева измерителя (необязательно)
--
-- Всё остальное (роли цветов, формы, отступы, тени, движение, свои поля)
-- - на усмотрение дизайн-системы. Соглашение об общих именах, с которыми
-- экраны переносимы между системами, - в docs/DESIGN_SYSTEM.md.

local R = require "kompot:kompot/core/runtime"
local color = require "kompot:kompot/core/color"

local Th = {}

local function style(font, bold, size)
    return { font = font, bold = bold, size = size or tonumber(font:match("(%d+)$")) }
end

-- Минимальная нейтральная тема: работает без дизайн-системы (прототипы,
-- тесты). Шрифты - из пака kompot.
Th.BASE = {
    name = "base",
    dark = true,
    colors = {
        background = color.hex("#15171C"),
        on_background = color.hex("#E6E7EA"),
        surface = color.hex("#1D2027"),
        on_surface = color.hex("#E6E7EA"),
        surface_raised = color.hex("#272B34"),
        muted = color.hex("#A0A6B1"),
        primary = color.hex("#7FB3FF"),
        on_primary = color.hex("#0B1A2E"),
        outline = color.hex("#3A404B"),
        error = color.hex("#FF6B6B"),
        success = color.hex("#5CCB7B"),
        warning = color.hex("#F2B84B"),
    },
    type = {
        caption = style("kompot_12", "kompot_sb_12"),
        body = style("kompot_14", "kompot_sb_14"),
        label = style("kompot_sb_14"),
        title = style("kompot_sb_16"),
        heading = style("kompot_sb_20"),
        display = style("kompot_32"),
        mono = style("kompot_mono_13"),
    },
    default_style = "body",
}

Th.LocalTheme = R.local_of(Th.BASE, "theme")
Th.LocalContentColor = R.local_of(Th.BASE.colors.on_surface, "content_color")
Th.LocalTextStyle = R.local_of(Th.BASE.type.body, "text_style")

-- Текущая тема.
function Th.theme()
    return Th.LocalTheme:get()
end

-- Стиль текста по имени из текущей темы. Неизвестное имя - стиль по
-- умолчанию (экран, написанный для другой системы, не падает).
function Th.style(name, theme)
    if type(name) ~= "string" then
        return name
    end
    theme = theme or Th.LocalTheme:get()
    local types = theme.type or Th.BASE.type
    return types[name] or types[theme.default_style or "body"] or Th.BASE.type.body
end

-- Задаёт тему поддереву: тема, цвет содержимого и стиль текста по умолчанию.
function Th.Theme(theme, content)
    local colors = theme.colors or Th.BASE.colors
    R.provide(Th.LocalTheme, theme, function()
        R.provide(
            Th.LocalContentColor,
            colors.on_surface or colors.on_background or Th.BASE.colors.on_surface,
            function()
                R.provide(
                    Th.LocalTextStyle,
                    Th.style(theme.default_style or "body", theme),
                    content
                )
            end
        )
    end)
end

-- Цвет содержимого (текст, иконки) для поддерева.
function Th.ContentColor(c, content)
    R.provide(Th.LocalContentColor, color.of(c), content)
end

-- Стиль текста по умолчанию для поддерева (имя или таблица).
function Th.TextStyle(s, content)
    R.provide(Th.LocalTextStyle, Th.style(s), content)
end

-- Компоненты дизайн-системы текущей темы: UI = K.ui(); UI.Button{...}.
function Th.ui()
    local t = Th.LocalTheme:get()
    if not t.ui then
        error("theme '" .. tostring(t.name) .. "' has no components (theme.ui)", 2)
    end
    return t.ui
end

-- Глубокое слияние: тема на основе другой. Таблицы сливаются, остальные
-- значения (в том числе цвета - массивы чисел) заменяются целиком.
local function is_color(v)
    return type(v) == "table" and type(v[1]) == "number"
end

function Th.extend(base, overrides)
    local out = {}
    for k, v in pairs(base) do
        out[k] = v
    end
    for k, v in pairs(overrides or {}) do
        local b = out[k]
        if
            type(v) == "table"
            and type(b) == "table"
            and not is_color(v)
            and not is_color(b)
            and getmetatable(v) == nil
            and k ~= "ui"
        then
            out[k] = Th.extend(b, v)
        else
            out[k] = v
        end
    end
    return out
end

-- Все шрифты темы (для прогрева измерителя текста).
function Th.fonts(theme)
    local seen, out = {}, {}
    local function add(f)
        if f and not seen[f] then
            seen[f] = true
            out[#out + 1] = f
        end
    end
    for _, f in ipairs(theme.fonts or {}) do
        add(f)
    end
    for _, st in pairs(theme.type or {}) do
        add(st.font)
        add(st.bold)
    end
    return out
end

return Th
