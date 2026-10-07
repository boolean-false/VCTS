-- Токены фирменной дизайн-системы Kompot UI.
--
-- Матовые пиксельные поверхности. Цвет добавляют предметы и состояния.
-- Обычная плотность подходит для меню, compact для инструментов.
--
--   local theme = UI.theme()                      -- стандартная
--   local theme = UI.theme({colors = {primary = "#E3AF67"}}) -- тема мода

local color = require "kompot:kompot/core/color"
local anim = require "kompot:kompot/core/anim"
local Th = require "kompot:kompot/theme"

local T = {}

local hex = color.hex

-- Фирменная палитра.
T.PALETTE = {
    panel = hex("#46483F"), -- панели
    sunken = hex("#262A23"), -- поля ввода, ячейки, строки состояния
    control = hex("#606456"), -- кнопки
    hover = hex("#747963"), -- наведение, разделители
    pressed = hex("#414639"),
    action = hex("#626C50"), -- выбранные элементы
    action_hover = hex("#778363"),
    danger = hex("#503A34"),
    danger_hover = hex("#65483E"),
    toggle = hex("#626C50"), -- включённое условие
    toggle_hover = hex("#778363"),
    text = hex("#E9E4CF"),
    bright = hex("#F8F7EB"),
    muted = hex("#BCBDAB"),
    dim = hex("#969C85"),
    header = hex("#C8CBBE"),
    status = hex("#C8CBBE"),
    brand = hex("#C7CEB8"), -- светлое выделение
    key = hex("#C8CBBE"), -- клавиши в подсказках
    disabled_bg = hex("#30332D"),
    disabled_fg = hex("#7D8275"),
}

-- Пиксельный шрифт Kompot. Для кода используется моноширинный вариант того же
-- семейства.
T.TYPE = {}
for _, role in ipairs({
    "caption",
    "body",
    "label",
    "strong",
    "title",
    "heading",
    "display",
    "mono",
}) do
    T.TYPE[role] = { font = "kompot_16", size = 16 }
end
T.TYPE.mono = { font = "kompot_mono_16", size = 16 }
T.TYPE.strong = { font = "kompot_sb_16", size = 16 }

-- Размеры: высоты элементов управления, панели, отступы.
T.COMPACT_METRICS = {
    control_sm = 24,
    control = 26,
    control_lg = 28,
    panel_w = 260,
    pad = 10,
    gap = 6,
    header_h = 24,
    stripe_w = 4,
    stripe_h = 34,
    menubar_h = 30,
    bar_h = 22,
    slot = 28,
    tool_w = 34,
    tool_h = 26,
    button_pad = 8,
    field_pad = 4,
}

T.METRICS = {
    control_sm = 28,
    control = 36,
    control_lg = 44,
    panel_w = 320,
    pad = 16,
    gap = 8,
    header_h = 24,
    stripe_w = 3,
    stripe_h = 36,
    menubar_h = 40,
    bar_h = 28,
    slot = 52,
    tool_w = 36,
    tool_h = 32,
    button_pad = 14,
    field_pad = 7,
}

T.MOTION = {
    hover = anim.tween(0.08),
    fast = anim.tween(0.12),
    normal = anim.tween(0.2),
}

-- Копии таблиц не разделяют изменяемые токены с другими темами.
local function clone(value)
    if type(value) ~= "table" or getmetatable(value) then
        return value
    end
    local out = {}
    for k, v in pairs(value) do
        out[k] = clone(v)
    end
    return out
end

-- opts: density (comfortable|compact), accent, panel_alpha, name, colors, skin, accents, type, metrics, motion,
-- shapes ({control, panel, card, field}), components ({Button = {size = "lg"}}),
-- ui (частичная замена общего контракта K.ui()). base - тема для наследования.
function T.theme(opts, base)
    opts = opts or {}
    local P = T.PALETTE
    local colors = clone(P)
    colors.edge = hex("#787E68")
    colors.shadow = hex("#10120F")
    colors.health = hex("#DF846E")
    colors.energy = hex("#EAC778")
    colors.experience = hex("#C7CEB8")
    colors.accent = P.brand
    colors.panel_bg = color.with_alpha(P.panel, 1)
    colors.menu_bg = color.with_alpha(P.panel, 1)
    colors.bar_bg = color.with_alpha(P.sunken, 0.82)
    colors.toast_bg = color.with_alpha(P.sunken, 0.97)
    colors.scrim = { 0, 0, 0, 0.28 }
    colors.background, colors.on_background = P.sunken, P.text
    colors.surface, colors.surface_raised, colors.on_surface = P.panel, P.control, P.text
    colors.primary, colors.on_primary = P.brand, P.sunken
    colors.outline = hex("#787E68")
    colors.slot_edge = hex("#707762")
    colors.error, colors.success, colors.warning =
        color.hex("#EF9697"), color.hex("#9DCBA3"), color.hex("#E9C46A")
    local out = Th.extend(
        clone(base or {
            name = "kompot-ui",
            dark = true,
            kompot_ui = true,
            colors = colors,
            accents = {},
            type = T.TYPE,
            icons = "kompot_ui_icons",
            skin = {
                panel = "kompot_ui_skin:panel",
                button = "kompot_ui_skin:button",
                button_pressed = "kompot_ui_skin:button_pressed",
                inset = "kompot_ui_skin:inset",
            },
            default_style = "body",
            metrics = T.METRICS,
            motion = T.MOTION,
            density = "comfortable",
            shapes = { control = 0, panel = 0, card = 0, field = 0 },
            components = {},
            ui = T.ui,
        }),
        opts
    )
    out = clone(out)
    out.kompot_ui = true
    if opts.density ~= nil then
        assert(
            opts.density == "compact" or opts.density == "comfortable",
            "unknown Kompot UI density"
        )
        if not base or opts.density ~= base.density then
            out.metrics = Th.extend(
                clone(opts.density == "compact" and T.COMPACT_METRICS or T.METRICS),
                opts.metrics or {}
            )
        end
    end
    -- Общие роли и подробные роли Kompot UI согласованы при создании темы.
    local changed = opts.colors or {}
    for k, v in pairs(out.colors) do
        out.colors[k] = color.of(v) or v
    end
    for k, v in pairs(out.accents) do
        out.accents[k] = color.of(v) or v
    end
    local c = out.colors
    for native, role in pairs({
        accent = "primary",
        panel = "surface",
        control = "surface_raised",
        text = "on_surface",
        sunken = "background",
        hover = "outline",
    }) do
        if changed[role] ~= nil then
            c[native] = c[role]
        elseif changed[native] ~= nil then
            c[role] = c[native]
        end
    end
    if opts.accent ~= nil then
        local accent = out.accents[opts.accent]
        if not accent and type(opts.accent) == "string" then
            local value = opts.accent:gsub("^#", "")
            assert(
                (#value == 3 or #value == 6 or #value == 8) and value:match("^%x+$"),
                "Kompot UI accent must be a hex color or a name supplied by the mod"
            )
        end
        c.primary = clone(accent or color.of(opts.accent))
        c.accent = c.primary
    end
    if opts.accent ~= nil or changed.primary or changed.accent then
        if not changed.on_primary then
            c.on_primary = clone(color.on(c.primary, P.sunken, P.bright))
        end
        if not changed.action then
            c.action = color.mix(c.surface, c.primary, 0.3)
        end
        if not changed.action_hover then
            c.action_hover = color.mix(c.surface, c.primary, 0.45)
        end
        if not changed.toggle then
            c.toggle = c.action
        end
        if not changed.toggle_hover then
            c.toggle_hover = c.action_hover
        end
    end
    if opts.panel_alpha ~= nil or changed.panel or changed.surface then
        if not changed.panel_bg then
            c.panel_bg = color.with_alpha(c.surface, out.panel_alpha or 0.97)
        end
        if not changed.menu_bg then
            c.menu_bg = color.with_alpha(c.surface, 0.97)
        end
    end
    if changed.background or changed.sunken then
        if not changed.bar_bg then
            c.bar_bg = color.with_alpha(c.background, 0.82)
        end
        if not changed.toast_bg then
            c.toast_bg = color.with_alpha(c.background, 0.97)
        end
    end
    if opts.ui then
        out.ui = {}
        for k, v in pairs((base and base.ui) or T.ui or {}) do
            out.ui[k] = v
        end
        for k, v in pairs(opts.ui) do
            out.ui[k] = v
        end
    end
    return out
end

T.DEFAULT = T.theme()

-- Kompot UI в чужой теме использует свои значения по умолчанию.
function T.current()
    local t = Th.theme()
    return t.kompot_ui and t or T.DEFAULT
end

-- Настройки компонента из темы; явно переданные свойства имеют приоритет.
function T.props(name, props)
    local defaults = T.current().components[name]
    if not defaults then
        return props or {}
    end
    local out = {}
    for k, v in pairs(defaults) do
        out[k] = v
    end
    for k, v in pairs(props or {}) do
        out[k] = v
    end
    return out
end

return T
