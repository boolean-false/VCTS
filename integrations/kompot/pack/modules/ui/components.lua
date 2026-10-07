-- Компоненты дизайн-системы Kompot UI

local K = require "kompot:kompot"
local R = require "kompot:kompot/core/runtime"
local T = require "kompot:ui/tokens"
local Common = require "kompot:ui/components/common"
local Buttons = require "kompot:ui/components/buttons"
local Lua = require "kompot:ui/components/lua"

local Skin = require "kompot:ui/skin"
local M = K.M
local color = K.color
local Box, Row, Column, Text, Image, Spacer = K.Box, K.Row, K.Column, K.Text, K.Image, K.Spacer

local C = {}
C.Lua = Lua
C.SplitPane = require "kompot:ui/components/split_pane"
local mods, state_color = Common.mods, Common.state_color
local any_icon, with_tooltip = Common.any_icon, Common.with_tooltip
local variant_colors = Common.variant_colors

-- Подсказки

-- Всплывающая подсказка: тёмная плашка с рамкой.
-- props: text, delay (0.45), placement ("below"), modifier; content - цель.
C.Tooltip = Common.Tooltip

-- Кнопки

C.Button = Buttons.Button

-- Квадратная кнопка со значком. props: icon, on_click, tooltip, selected,
--   variant, enabled, size (сторона; по умолчанию metrics.control)
C.IconButton = K.component(function(props)
    props = T.props("IconButton", props)
    local th = T.current()
    local c = th.colors
    local enabled = props.enabled ~= false
    local inter = K.interaction()
    local base, hover, pressed = variant_colors(c, props.variant, props.selected)
    local bg = state_color(enabled and base or c.disabled_bg, hover, pressed, inter, enabled)
    local s = props.size or th.metrics.control
    with_tooltip(props.tooltip, function()
        Box({
            modifier = mods(props):size(s):clickable(props.on_click, {
                interaction = inter,
                enabled = enabled,
                on_right_click = props.on_right_click,
            }),
            align = "center",
        }, function()
            Skin.Surface({
                kind = "button",
                color = bg,
                pressed = inter.pressed.value,
                selected = props.selected,
                edge = c.primary,
            })
            any_icon(props.icon, math.floor(s * 0.62), enabled and c.text or c.disabled_fg)
        end)
    end)
end)

-- Кнопка панели инструментов: значок 24 в ячейке 34x26, выбранная
-- обведена фирменным цветом. props: icon (текстура), selected, on_click,
-- on_right_click, tooltip
C.ToolButton = K.component(function(props)
    props = T.props("ToolButton", props)
    local th = T.current()
    local c, mt = th.colors, th.metrics
    local inter = K.interaction()
    local bg = state_color(c.control, c.hover, c.pressed, inter)
    local ring = props.selected and c.accent or color.with_alpha(c.accent, 0)
    with_tooltip(props.tooltip, function()
        Box({
            modifier = mods(props):size(mt.tool_w + 4, mt.tool_h + 4):background(ring),
            align = "center",
        }, function()
            Box({
                modifier = M:size(mt.tool_w, mt.tool_h):clickable(
                    props.on_click,
                    { interaction = inter, on_right_click = props.on_right_click }
                ),
                align = "center",
            }, function()
                Skin.Surface({ kind = "button", color = bg, pressed = inter.pressed.value })
                any_icon(props.icon, 24, props.tint)
            end)
        end)
    end)
end)

-- Выбор

-- Флажок: квадрат 20 с рамкой, отмеченный залит фирменным цветом.
-- props: checked, on_change(bool), label, tooltip, enabled, modifier
C.Checkbox = K.component(function(props)
    props = T.props("Checkbox", props)
    local c = T.current().colors
    local enabled = props.enabled ~= false
    local inter = K.interaction()
    local on = props.checked == true
    local fill = on and c.action or c.sunken
    local frame = (inter.hovered.value and enabled) and c.accent or c.hover
    local toggle = function()
        if props.on_change then
            props.on_change(not on)
        end
    end
    with_tooltip(props.tooltip, function()
        Row({
            modifier = mods(props)
                :height(T.current().metrics.control_lg)
                :clickable(toggle, { interaction = inter, enabled = enabled }),
            align = "center",
            spacing = 10,
        }, function()
            Box({ modifier = M:size(24), align = "center" }, function()
                Skin.Surface({
                    kind = "inset",
                    color = fill,
                    selected = inter.hovered.value,
                    edge = frame,
                })
                if on then
                    Skin.Icon("check", 14, c.text)
                end
            end)
            if props.label then
                Text(props.label, {
                    style = T.current().type.body,
                    color = enabled and c.text or c.disabled_fg,
                    wrap = false,
                })
            end
        end)
    end)
end)

-- Переключатель: дорожка 34x18 и прямоугольный бегунок.
-- props: checked, on_change(bool), label, enabled, modifier
C.Switch = K.component(function(props)
    props = T.props("Switch", props)
    local c = T.current().colors
    local enabled = props.enabled ~= false
    local inter = K.interaction()
    local on = props.checked == true
    local t = on and 1 or 0
    local track = color.mix(c.sunken, c.action, t)
    local knob = color.mix(c.dim, c.accent, t)
    local toggle = function()
        if props.on_change then
            props.on_change(not on)
        end
    end
    Row({
        modifier = mods(props)
            :height(T.current().metrics.control_lg)
            :clickable(toggle, { interaction = inter, enabled = enabled }),
        align = "center",
        spacing = 10,
    }, function()
        if props.label then
            Text(props.label, {
                style = T.current().type.body,
                color = enabled and c.text or c.disabled_fg,
                modifier = M:weight(1),
            })
        end
        Box({ modifier = M:size(40, 24) }, function()
            Skin.Surface({ kind = "inset", color = track })
            Box({ modifier = M:offset(4 + t * 16, 4):size(16) }, function()
                Skin.Surface({ kind = "button", color = knob })
            end)
        end)
    end)
end)

local function normalize_options(options)
    local out = {}
    for i, o in ipairs(options) do
        if type(o) == "table" then
            out[i] = {
                value = o.value or o[1],
                text = o.text or o[2] or tostring(o[1]),
                icon = o.icon,
                tooltip = o.tooltip,
            }
        else
            out[i] = { value = o, text = tostring(o) }
        end
    end
    return out
end

-- Выбор одного из вариантов - ряд плоских кнопок, выбранная подсвечена.
-- props: options ({{value, text}} | {"a", "b"}), selected (значение),
--   on_select(value), columns (кнопок в ряду; по умолчанию все в один),
--   size, modifier
C.Choice = K.component(function(props)
    props = T.props("Choice", props)
    local opts = normalize_options(props.options or {})
    local cols = props.columns or #opts
    local gap = T.current().metrics.gap
    Column({ modifier = mods(props):fill_max_width(), spacing = gap }, function()
        for r = 0, math.ceil(#opts / cols) - 1 do
            Row({ modifier = M:fill_max_width(), spacing = gap }, function()
                for i = r * cols + 1, math.min(#opts, r * cols + cols) do
                    local o = opts[i]
                    K.key(tostring(o.value), function()
                        C.Button({
                            text = o.text,
                            icon = o.icon,
                            tooltip = o.tooltip,
                            size = props.size or "sm",
                            compact = true,
                            selected = props.selected == o.value,
                            modifier = M:weight(1),
                            on_click = function()
                                if props.on_select then
                                    props.on_select(o.value)
                                end
                            end,
                        })
                    end)
                end
            end)
        end
    end)
end)

-- Счётчик для настроек: подпись, значение и две кнопки.
-- props: label, value, on_minus, on_plus, minus ("–"), plus ("+"), tooltip, modifier
C.Stepper = K.component(function(props)
    props = T.props("Stepper", props)
    local c = T.current().colors
    Row({
        modifier = mods(props):fill_max_width():height(T.current().metrics.control_lg),
        align = "center",
        spacing = 6,
    }, function()
        local text = props.value ~= nil and (props.label .. ": " .. tostring(props.value))
            or props.label
        Text(text, {
            style = T.current().type.body,
            color = c.text,
            wrap = false,
            modifier = M:weight(1):padding(4, 0, 0, 0),
        })
        C.Button({
            text = props.minus or "-",
            on_click = props.on_minus,
            min_width = 40,
            tooltip = props.tooltip,
        })
        C.Button({
            text = props.plus or "+",
            on_click = props.on_plus,
            min_width = 40,
            tooltip = props.tooltip,
        })
    end)
end)

-- Ползунок: плоская дорожка, заливка фирменным цветом, прямоугольный
-- бегунок. props: value, min (0), max (1), step, on_change(v), on_change_end,
--   label, format(v) -> текст значения, enabled, modifier
C.Slider = K.component(function(props)
    props = T.props("Slider", props)
    local c = T.current().colors
    local lo, hi = props.min or 0, props.max or 1
    local v = math.max(lo, math.min(hi, props.value or lo))
    local width = R.state(160)
    local inter = K.interaction()
    local f = (hi > lo) and (v - lo) / (hi - lo) or 0
    local function set_from(x)
        if props.enabled == false then
            return
        end
        local w = width:peek()
        local nf = math.max(0, math.min(1, x / math.max(1, w)))
        local nv = lo + nf * (hi - lo)
        if props.step and props.step > 0 then
            nv = lo + math.floor((nv - lo) / props.step + 0.5) * props.step
        end
        nv = math.max(lo, math.min(hi, nv))
        if props.on_change then
            props.on_change(nv)
        end
    end
    local function adjust(dir)
        if props.enabled == false then
            return
        end
        local step = props.step and props.step > 0 and props.step or (hi - lo) / 100
        local nv = math.max(lo, math.min(hi, v + dir * step))
        if nv ~= v and props.on_change then
            props.on_change(nv)
        end
        if nv ~= v and props.on_change_end then
            props.on_change_end()
        end
    end
    local active = inter.hovered.value or inter.dragged.value or inter.focused.value
    Column({ modifier = mods(props):fill_max_width(), spacing = 2 }, function()
        if props.label or props.format then
            Row({ modifier = M:fill_max_width() }, function()
                Text(
                    props.label or "",
                    { style = T.current().type.body, color = c.text, modifier = M:weight(1) }
                )
                local shown = props.format and props.format(v)
                    or tostring(math.floor(v * 100 + 0.5) / 100)
                Text(shown, { style = T.current().type.body, color = c.muted })
            end)
        end
        Box({
            modifier = M:fill_max_width()
                :height(20)
                :on_size(function(w)
                    width.value = w
                end)
                :pointer_input(function(ev)
                    if ev.type == "down" or ev.type == "move" then
                        set_from(ev.x)
                    end
                    if props.enabled ~= false and ev.type == "up" and props.on_change_end then
                        props.on_change_end()
                    end
                end)
                :hoverable(inter)
                :focusable(function(key)
                    if key == "left" or key == "down" then
                        adjust(-1)
                    elseif key == "right" or key == "up" then
                        adjust(1)
                    end
                end, {
                    interaction = inter,
                    enabled = props.enabled ~= false,
                    focus_color = c.accent,
                }),
            align = "center_start",
        }, function()
            Box({ modifier = M:fill_max_width():height(4):background(c.sunken) })
            Box({ modifier = M:width(math.floor(width.value * f)):height(4):background(c.accent) })
            Box(
                { modifier = M:offset(math.floor((width.value - 12) * f), 0):size(12, 20) },
                function()
                    Skin.Surface({ kind = "button", color = active and c.hover or c.control })
                end
            )
        end)
    end)
end)

-- Вкладки: текст, выбранная - светлее и с полосой фирменного цвета снизу.
-- props: tabs ({"A", "B"} | {{text, icon}}), selected (индекс), on_select(i), modifier
C.Tabs = K.component(function(props)
    props = T.props("Tabs", props)
    local c = T.current().colors
    Row({
        modifier = mods(props):fill_max_width():height(T.current().metrics.header_h),
        spacing = 2,
    }, function()
        for i, tab in ipairs(props.tabs or {}) do
            local text = type(tab) == "table" and (tab.text or tab[1]) or tab
            local icon = type(tab) == "table" and tab.icon or nil
            K.key(i, function()
                local inter = K.interaction()
                local sel = props.selected == i
                local bg = state_color(
                    color.with_alpha(c.control, sel and 1 or 0),
                    c.hover,
                    c.pressed,
                    inter
                )
                Box({
                    modifier = M:fill_max_height():background(bg):clickable(function()
                        if props.on_select then
                            props.on_select(i)
                        end
                    end, { interaction = inter }),
                }, function()
                    Row({
                        modifier = M:fill_max_height():padding(12, 0),
                        align = "center",
                        spacing = 6,
                    }, function()
                        if icon then
                            any_icon(icon, 16, sel and c.bright or c.muted)
                        end
                        Text(text, {
                            style = sel and T.current().type.strong or T.current().type.body,
                            color = sel and c.bright or c.muted,
                            wrap = false,
                        })
                    end)
                    if sel then
                        Box({ modifier = M:match_parent_size() }, function()
                            Box({
                                modifier = M:align("bottom_start")
                                    :fill_max_width()
                                    :height(2)
                                    :background(c.accent),
                            })
                        end)
                    end
                end)
            end)
        end
    end)
end)

-- Ввод текста

-- Поле ввода: тёмная плашка, при фокусе - рамка фирменного цвета.
-- props: state или value, on_change(text), on_submit(text), hint, lines, font
--   (false - шрифт движка), on_focus, on_defocus, syntax, line_numbers, wrap,
--   editable (false разрешает только выделение и копирование), width, height, tooltip, modifier
C.Field = K.component(function(props)
    props = T.props("Field", props)
    local c = T.current().colors
    local focused = K.state(false)
    local lines = props.lines or 1
    local h = props.height or (lines == 1 and T.current().metrics.control or nil)
    local m = mods(props)
    if props.width then
        m = m:width(props.width)
    else
        m = m:fill_max_width()
    end
    with_tooltip(props.tooltip, function()
        local fm = h and m:height(h) or m
        Box({ modifier = fm }, function()
            Skin.Surface({
                kind = "inset",
                color = c.sunken,
                selected = props.error or focused.value,
                edge = props.error and c.error or c.accent,
            })
            K.BasicTextField({
                state = props.state,
                value = props.value,
                editor_state = props.editor_state,
                presentation = props.presentation,
                on_selection_change = props.on_selection_change,
                on_change = props.on_change,
                on_submit = props.on_submit,
                hint = props.hint,
                lines = lines,
                font = props.font,
                color = c.text,
                pad = T.current().metrics.field_pad,
                syntax = props.syntax,
                line_numbers = props.line_numbers,
                editable = props.editable,
                wrap = props.wrap,
                on_focus = function()
                    focused.value = true
                    if props.on_focus then
                        props.on_focus()
                    end
                end,
                on_defocus = function()
                    focused.value = false
                    if props.on_defocus then
                        props.on_defocus()
                    end
                end,
                modifier = h and M:fill_max_size() or M:fill_max_width(),
            })
        end)
    end)
end)

-- Подпись слева и поле. props: label, label_width (70), остальное - как у Field
C.LabeledField = K.component(function(props)
    props = T.props("LabeledField", props)
    local c = T.current().colors
    Row({ modifier = mods(props):fill_max_width(), align = "center", spacing = 4 }, function()
        Text(props.label or "", {
            style = T.current().type.body,
            color = c.muted,
            wrap = false,
            modifier = M:width(props.label_width or 70),
        })
        local p = {}
        for k, v in pairs(props) do
            p[k] = v
        end
        p.modifier = props.field_width and M:width(props.field_width) or M:weight(1)
        p.width = nil
        C.Field(p)
    end)
end)

-- Три поля X/Y/Z с подписью. props: label, values ({x, y, z} - строки или
--   числа), on_change(axis_index, text), on_focus, on_defocus, label_width
C.VectorField = K.component(function(props)
    props = T.props("VectorField", props)
    local c = T.current().colors
    Row({ modifier = mods(props):fill_max_width(), align = "center", spacing = 4 }, function()
        Text(props.label or "", {
            style = T.current().type.body,
            color = c.muted,
            wrap = false,
            modifier = M:width(props.label_width or 60),
        })
        for i, axis in ipairs({ "X", "Y", "Z" }) do
            K.key(axis, function()
                Text(
                    axis,
                    { style = T.current().type.body, color = c.muted, modifier = M:width(12) }
                )
                C.Field({
                    value = tostring(props.values and props.values[i] or ""),
                    modifier = M:weight(1),
                    on_change = function(t)
                        if props.on_change then
                            props.on_change(i, t)
                        end
                    end,
                    on_submit = function(t)
                        if props.on_submit then
                            props.on_submit(i, t)
                        end
                    end,
                    on_focus = props.on_focus,
                    on_defocus = props.on_defocus,
                })
            end)
        end
    end)
end)

-- Панели и окна

-- Панель: фон поверх мира, необязательная полоса-акцент, выразительный
-- заголовок. Панель «непрозрачна» для указателя (клики не проходят в мир).
-- props: title, markup ("md" - разметка в заголовке), icon, accent (цвет или
--   имя из accents темы мода), header (функция справа от заголовка), width (metrics.panel_w по
--   умолчанию; false - ширину задаёт modifier, например fill_max_width),
--   variant ("plain"|"flat"|"accent"), padding, spacing, background, radius, modifier
C.Panel = K.component(function(props, content)
    props = T.props("Panel", props)
    local th = T.current()
    local c, mt = th.colors, th.metrics
    local accent = props.accent
    if type(accent) == "string" and th.accents[accent] then
        accent = th.accents[accent]
    end
    accent = color.of(accent) or c.accent
    local m = mods(props)
    if props.width ~= false then
        m = m:width(props.width or mt.panel_w)
    end
    Box({ modifier = m:block_pointer() }, function()
        if props.variant ~= "flat" then
            Skin.Surface({ color = props.background or c.panel_bg })
        end
        if props.variant == "accent" then
            Box({ modifier = M:offset(0, mt.pad):size(mt.stripe_w, mt.stripe_h):background(accent) })
        end
        Column({
            modifier = (props.fill_height and M:fill_max_size() or M:fill_max_width()):padding(
                props.padding or mt.pad
            ),
            spacing = props.spacing or mt.gap,
        }, function()
            if props.title or props.header then
                Row({
                    modifier = M:fill_max_width():height(mt.header_h),
                    align = "center",
                    spacing = 6,
                }, function()
                    if props.title_modifier then
                        Box(
                            { modifier = props.title_modifier:weight(1):height(mt.header_h) },
                            function()
                                Row({
                                    modifier = M:fill_max_size(),
                                    align = "center",
                                    spacing = 6,
                                }, function()
                                    if props.icon then
                                        any_icon(props.icon, 20)
                                    end
                                    if props.title then
                                        Text(props.title, {
                                            style = T.current().type.title,
                                            color = c.text,
                                            wrap = false,
                                            max_lines = 1,
                                            ellipsis = true,
                                            markup = props.markup,
                                            modifier = M:weight(1),
                                        })
                                    end
                                end)
                            end
                        )
                    else
                        if props.icon then
                            any_icon(props.icon, 20)
                        end
                        if props.title then
                            Text(props.title, {
                                style = T.current().type.title,
                                color = c.text,
                                wrap = false,
                                markup = props.markup,
                                modifier = M:weight(1),
                            })
                        else
                            Spacer(M:weight(1))
                        end
                    end
                    if props.header then
                        props.header()
                    end
                end)
            end
            if content then
                if props.content_modifier then
                    Box({ modifier = props.content_modifier }, content)
                else
                    content()
                end
            end
        end)
    end)
end)

-- Окно поверх всего: панель с заголовком и кнопкой закрытия, по центру
-- экрана (или placement). props: visible, title, accent, variant, on_close (кнопка
--   «Закрыть»), close_text, width, height, header, modal (затемнение),
--   on_dismiss (щелчок по затемнению; по умолчанию on_close), placement,
--   z (порядок среди окон; меню - 20, подсказки - 30, диалог - 10),
--   draggable, resizable, bounds, on_bounds_change, min_width/min_height,
--   max_width/max_height, modifier, title_modifier
C.Window = require("kompot:ui/components/window")(C.Panel, C.Button)

-- Диалог подтверждения. props: visible, title, text, confirm ({text, on_click,
--   variant}), dismiss ({text, on_click}), on_dismiss, accent, variant, icon, width
C.Dialog = K.component(function(props, content)
    props = T.props("Dialog", props)
    local c = T.current().colors
    C.Window({
        visible = props.visible,
        title = props.title,
        accent = props.accent,
        variant = props.variant,
        icon = props.icon,
        width = props.width or 420,
        modal = true,
        on_dismiss = props.on_dismiss or function() end,
        placement = "center",
        z = 10,
    }, function()
        if props.text then
            Text(props.text, {
                style = T.current().type.body,
                color = c.muted,
                markup = "md",
                modifier = M:fill_max_width(),
            })
        end
        if content then
            content()
        end
        if props.confirm or props.dismiss then
            Row({
                modifier = M:fill_max_width():padding(0, 6, 0, 0),
                arrangement = "end",
                spacing = 6,
            }, function()
                if props.dismiss then
                    C.Button({
                        text = props.dismiss.text,
                        min_width = 100,
                        on_click = function()
                            if props.dismiss.on_click then
                                props.dismiss.on_click()
                            end
                            if props.on_dismiss then
                                props.on_dismiss()
                            end
                        end,
                    })
                end
                if props.confirm then
                    C.Button({
                        text = props.confirm.text,
                        variant = props.confirm.variant or "primary",
                        min_width = 100,
                        on_click = props.confirm.on_click,
                    })
                end
            end)
        end
    end)
end)

-- Меню

-- Выпадающее меню под местом вызова. props: expanded, on_dismiss, width (336)
C.Menu = K.component(function(props, content)
    props = T.props("Menu", props)
    local c = T.current().colors
    local v = K.animate(props.expanded and 1 or 0, T.current().motion.fast)
    if v < 0.01 and not props.expanded then
        return
    end
    if props.expanded then
        K.Popup({ placement = "fill", key = "menu_scrim", z = 20 }, function()
            Box({
                modifier = M:fill_max_size():clickable(function()
                    if props.on_dismiss then
                        props.on_dismiss()
                    end
                end, {
                    cursor = "arrow",
                    on_right_click = function()
                        if props.on_dismiss then
                            props.on_dismiss()
                        end
                    end,
                }),
            })
        end)
    end
    K.Popup({ placement = props.placement or "below", gap = props.gap or 2, z = 20 }, function()
        Box({ modifier = M:alpha(v):width(props.width or 336):block_pointer() }, function()
            Skin.Surface({ color = c.menu_bg })
            Column({ modifier = M:fill_max_width():padding(6) }, content)
        end)
    end)
end)

-- Пункт меню: текст слева, сочетание клавиш справа.
-- props: text, shortcut, icon, on_click, enabled, danger
C.MenuItem = K.component(function(props)
    props = T.props("MenuItem", props)
    local c = T.current().colors
    local enabled = props.enabled ~= false
    local inter = K.interaction()
    local bg = state_color(
        color.with_alpha(c.hover, 0),
        props.danger and c.danger_hover or c.hover,
        c.pressed,
        inter,
        enabled
    )
    Row({
        modifier = M:fill_max_width()
            :height(T.current().metrics.control)
            :background(bg, T.current().shapes.control)
            :clickable(props.on_click, { interaction = inter, enabled = enabled })
            :padding(8, 0),
        align = "center",
        spacing = 8,
    }, function()
        if props.icon then
            any_icon(props.icon, 16, enabled and c.text or c.disabled_fg)
        end
        Text(props.text or "", {
            style = T.current().type.body,
            color = enabled and c.text or c.disabled_fg,
            wrap = false,
            modifier = M:weight(1),
        })
        if props.shortcut then
            Text(props.shortcut, { style = T.current().type.body, color = c.muted, wrap = false })
        end
    end)
end)

-- Разделитель пунктов меню.
function C.MenuDivider()
    local c = T.current().colors
    Box({ modifier = M:fill_max_width():padding(4, 3):height(1):background(c.hover) })
end

-- Строка меню: название слева, кнопки меню, действия справа.
-- props: brand (текст), menus ({{text, width, items = {{text, shortcut, on_click, divider}}}}),
--   actions (функция справа), open (индекс открытого меню, для управления снаружи),
--   on_open(i | nil)
C.MenuBar = K.component(function(props)
    props = T.props("MenuBar", props)
    local th = T.current()
    local c, mt = th.colors, th.metrics
    local own = K.state(nil)
    local open = props.on_open and props.open or own.value
    local function set_open(i)
        if props.on_open then
            props.on_open(i)
        else
            own.value = i
        end
    end
    Row({
        modifier = mods(props)
            :fill_max_width()
            :height(mt.menubar_h)
            :background(c.panel_bg)
            :block_pointer()
            :padding(12, 2, 4, 2),
        align = "center",
        spacing = 4,
    }, function()
        if props.brand then
            Text(props.brand, {
                style = T.current().type.strong,
                color = c.accent,
                wrap = false,
                modifier = M:padding(0, 0, 8, 0),
            })
        end
        for i, menu in ipairs(props.menus or {}) do
            K.key(i, function()
                Box(function()
                    C.Button({
                        text = menu.text,
                        min_width = menu.width or 100,
                        selected = open == i,
                        on_click = function()
                            set_open(open == i and nil or i)
                        end,
                    })
                    C.Menu({
                        expanded = open == i,
                        on_dismiss = function()
                            set_open(nil)
                        end,
                        width = menu.menu_width,
                    }, function()
                        for j, item in ipairs(menu.items or {}) do
                            K.key(j, function()
                                if item.divider then
                                    C.MenuDivider()
                                else
                                    C.MenuItem({
                                        text = item.text,
                                        shortcut = item.shortcut,
                                        icon = item.icon,
                                        enabled = item.enabled,
                                        on_click = function()
                                            set_open(nil)
                                            if item.on_click then
                                                item.on_click()
                                            end
                                        end,
                                    })
                                end
                            end)
                        end
                    end)
                end)
            end)
        end
        Spacer(M:weight(1))
        if props.actions then
            props.actions()
        end
    end)
end)

-- Строки подсказок и состояния, уведомления

-- Строка на тёмной полупрозрачной подложке. Текст - разметка md движка.
-- props: text, right (текст справа), height (22), color, modifier
C.Bar = K.component(function(props)
    props = T.props("Bar", props)
    local th = T.current()
    local c = th.colors
    Row({
        modifier = mods(props)
            :fill_max_width()
            :height(props.height or th.metrics.bar_h)
            :background(c.bar_bg)
            :padding(8, 0),
        align = "center",
        spacing = 12,
    }, function()
        Text(props.text or "", {
            style = T.current().type.body,
            color = props.color or c.text,
            markup = "md",
            wrap = false,
            max_lines = 1,
            modifier = M:weight(1),
        })
        if props.right then
            Text(props.right, {
                style = T.current().type.body,
                color = c.muted,
                markup = "md",
                wrap = false,
                max_lines = 1,
            })
        end
    end)
end)

-- Подсказки клавиш: {{"ЛКМ", "рисовать"}, {"Esc", "отмена"}} -> «ЛКМ рисовать    Esc отмена».
-- Возвращает строку разметки md для Text{markup = "md"} или Bar.
function C.key_chips(list)
    local c = T.current().colors
    local key = "[" .. color.to_hex(c.key):sub(1, 7) .. "]"
    local txt = "[" .. color.to_hex(c.text):sub(1, 7) .. "]"
    local out = {}
    for _, item in ipairs(list) do
        out[#out + 1] = key .. item[1] .. txt .. " " .. item[2]
    end
    return table.concat(out, "    ")
end

-- Уведомление сверху по центру. tone: neutral|info|success|warning|error.
-- props: text (пустой или nil - скрыто), width (до 900), top (80),
--   icon (имя/текстура, false скрывает), accent (цвет/имя), variant (plain|accent).
C.Toast = K.component(function(props)
    props = T.props("Toast", props)
    local th = T.current()
    local c, mt = th.colors, th.metrics
    local text = props.text
    local shown = text ~= nil and text ~= ""
    local v = K.animate(shown and 1 or 0, th.motion.normal)
    local last = K.remember(function()
        return {}
    end)
    if shown then
        last.text, last.tone, last.icon = text, props.tone or "neutral", props.icon
        last.accent, last.variant = props.accent, props.variant
    end
    if v < 0.01 or not last.text then
        return
    end
    local tones = {
        neutral = { c.muted, "info" },
        info = { c.primary, "info" },
        success = { c.success, "check" },
        warning = { c.warning, "warning" },
        error = { c.error, "error" },
    }
    local tone = tones[last.tone] or tones.neutral
    local accent = type(last.accent) == "string" and th.accents[last.accent] or last.accent
    accent = color.of(accent) or tone[1]
    local bg = last.tone == "neutral" and c.toast_bg or color.mix(c.toast_bg, tone[1], 0.1)
    local icon = last.icon
    if icon == nil then
        icon = tone[2]
    end
    K.Popup({
        placement = function(_, w, h, W)
            return math.floor((W - w) / 2), (props.top or 80) - math.floor((1 - v) * 12)
        end,
        key = "toast",
        z = -1,
    }, function()
        Box({ modifier = mods(props):alpha(v) }, function()
            Skin.Surface({ color = bg })
            Row({
                modifier = M:height_in(mt.control, 100000)
                    :width_in(200, props.width or 900)
                    :padding(mt.button_pad, 8),
                align = "center",
                spacing = 10,
            }, function()
                if icon ~= false then
                    any_icon(icon, 18, accent)
                end
                Text(last.text, { style = th.type.body, color = c.bright, markup = "md" })
            end)
            if last.variant == "accent" then
                Box({ modifier = M:match_parent_size() }, function()
                    Box({ modifier = M:width(mt.stripe_w):fill_max_height():background(accent) })
                end)
            end
        end)
    end)
end)

-- Списки, ячейки, карточки

-- Строка списка: кнопка с текстом слева и, при on_delete, кнопка ×.
-- props: text, on_click, selected, on_delete, delete_tooltip, tooltip, trailing
C.ListRow = K.component(function(props)
    props = T.props("ListRow", props)
    Row({ modifier = mods(props):fill_max_width(), spacing = 4 }, function()
        C.Button({
            text = props.text,
            align = "start",
            selected = props.selected,
            on_click = props.on_click,
            tooltip = props.tooltip,
            trailing = props.trailing,
            icon = props.icon,
            modifier = M:weight(1),
        })
        if props.on_delete then
            C.Button({
                text = "x",
                variant = "danger",
                on_click = props.on_delete,
                min_width = 30,
                tooltip = props.delete_tooltip,
            })
        end
    end)
end)

-- Ячейка с картинкой (блок палитры, предмет). props: src (текстура),
--   icon (иконка kompot), size (28), selected, on_click, on_right_click,
--   tooltip, badge (число в углу)
C.Slot = K.component(function(props)
    props = T.props("Slot", props)
    local c = T.current().colors
    local inter = K.interaction()
    local s = props.size or T.current().metrics.slot
    local bg = state_color(c.sunken, c.hover, c.pressed, inter)
    with_tooltip(props.tooltip, function()
        local m = mods(props):size(s)
        Box({
            modifier = m:clickable(
                props.on_click,
                { interaction = inter, on_right_click = props.on_right_click }
            ),
            align = "center",
        }, function()
            Skin.Surface({ kind = "inset", color = bg, selected = props.selected, edge = c.accent })
            if props.src then
                Image(props.src, { size = s - 6 })
            elseif props.icon then
                Skin.Icon(props.icon, s - 8, c.text)
            end
            if props.badge then
                Box({ modifier = M:align("bottom_end"):padding(0, 0, 1, 0) }, function()
                    Text(
                        tostring(props.badge),
                        { style = T.current().type.caption, color = c.bright }
                    )
                end)
            end
        end)
    end)
end)

-- Карточка: тёмная плашка (чертежи, результаты). props: on_click, selected,
--   padding, tooltip, modifier
C.Card = K.component(function(props, content)
    props = T.props("Card", props)
    local c = T.current().colors
    local inter = K.interaction()
    local bg = state_color(
        c.surface_raised,
        color.mix(c.surface_raised, c.hover, 0.5),
        c.pressed,
        inter,
        props.on_click ~= nil
    )
    local m = mods(props)
    if props.on_click then
        m = m:clickable(props.on_click, { interaction = inter })
    end
    with_tooltip(props.tooltip, function()
        Box({ modifier = m }, function()
            Skin.Surface({ color = bg, selected = props.selected, edge = c.accent })
            Box({ modifier = M:padding(props.padding or T.current().metrics.pad) }, content)
        end)
    end)
end)

-- Заголовок раздела внутри панели.
function C.Section(text, props)
    props = T.props("Section", props)
    local c = T.current().colors
    Text(text, { style = T.current().type.strong, color = c.header, modifier = props.modifier })
end

-- Мелкий поясняющий текст.
function C.Hint(text, props)
    props = T.props("Hint", props)
    local c = T.current().colors
    Text(text, {
        style = props.style or T.current().type.body,
        color = c.dim,
        markup = props.markup,
        max_lines = props.max_lines,
        modifier = props.modifier,
        align = props.align,
    })
end

-- Разделитель: горизонтальный 1 px (как в панели инструментов) или вертикальный.
-- props: vertical, thickness, inset, color
function C.Divider(props)
    props = T.props("Divider", props)
    props = props or {}
    local c = T.current().colors
    local t = props.thickness or 1
    if props.vertical then
        Box({
            modifier = M:width(t)
                :fill_max_height()
                :padding(0, props.inset or 0)
                :background(color.of(props.color) or c.hover),
        })
    else
        Box({
            modifier = M:fill_max_width()
                :padding(props.inset or 0, 0)
                :height(t)
                :background(color.of(props.color) or c.hover),
        })
    end
end

-- Полоса прогресса. props: progress (0..1; nil - бегущая), color, height (4)
C.ProgressBar = K.component(function(props)
    props = T.props("ProgressBar", props)
    local c = T.current().colors
    local w = K.state(100)
    local h = props.height or 8
    local fill = color.of(props.color) or c.accent
    Box({
        modifier = mods(props)
            :fill_max_width()
            :height(h)
            :background(c.sunken)
            :clip()
            :on_size(function(nw)
                w.value = nw
            end),
    }, function()
        if props.progress then
            local p = K.animate(math.max(0, math.min(1, props.progress)), T.current().motion.normal)
            Box({ modifier = M:width(math.floor(w.value * p)):fill_max_height():background(fill) })
        else
            local t = K.clock()
            local x = ((t * 0.8) % 1.4 - 0.4) * w.value
            Box({
                modifier = M:offset(math.floor(x), 0)
                    :width(math.floor(w.value * 0.3))
                    :fill_max_height()
                    :background(fill),
            })
        end
    end)
end)

-- Значок-счётчик. props: count, color
function C.Badge(props)
    props = T.props("Badge", props)
    local c = T.current().colors
    Box({
        modifier = M:height(16)
            :width_in(16, 300)
            :background(color.of(props.color) or c.key)
            :padding(4, 0),
        align = "center",
    }, function()
        Text(
            tostring(props.count or ""),
            { style = T.current().type.caption, color = c.sunken, wrap = false }
        )
    end)
end

-- Клавиша: «колпачок» с подписью (справка, подсказки).
function C.Key(text)
    local c = T.current().colors
    Box({ modifier = M:height(26), align = "center" }, function()
        Skin.Surface({ kind = "button", color = c.control })
        Text(text, {
            style = T.current().type.caption,
            color = c.key,
            wrap = false,
            modifier = M:padding(8, 0),
        })
    end)
end

-- Полоса прокрутки: тонкий прямоугольник у правого края.
-- props: state (scroll_state / lazy_state), modifier
C.Scrollbar = K.component(function(props)
    props = T.props("Scrollbar", props)
    local c = T.current().colors
    local st = props.state
    local frac, visible = st:fraction()
    local height = K.state(100)
    local inter = K.interaction()
    local active = inter.hovered.value or inter.dragged.value
    local hh = height.value
    local thumb_h = math.max(20, math.floor(hh * visible))
    local y = math.floor((hh - thumb_h) * frac)
    if visible >= 0.999 then
        return
    end
    Box({
        modifier = mods(props):width(8):fill_max_height():align("top_end"):on_size(function(_, h)
            height.value = h
        end),
    }, function()
        Box({
            modifier = M:offset(0, y):size(8, thumb_h):draggable({
                interaction = inter,
                on_event = function(e)
                    if e.type ~= "move" then return end
                    local track = height:peek() - thumb_h
                    if track > 0 then
                        local range = (st.max or ((st.total or 0) - (st.view or 0)))
                        st:scroll_by(e.parent_dy / track * range)
                    end
                end,
            }),
            align = "center_end",
        }, function()
            Box({
                modifier = M:size(active and 6 or 4, thumb_h)
                    :background(active and c.accent or c.hover),
            })
        end)
    end)
end)

-- Картинка в рамке-подложке (превью инструментов, миниатюры).
-- props: src, width, height, source_size = {width, height},
--   fit ("fill"|"contain"|"cover"), region, placeholder (текст, если src нет), tooltip
C.Preview = K.component(function(props)
    props = T.props("Preview", props)
    local c = T.current().colors
    with_tooltip(props.tooltip, function()
        Box({
            modifier = mods(props)
                :size(props.width or 240, props.height or 96)
                :background(c.sunken),
            align = "center",
        }, function()
            Skin.Surface({ kind = "inset", color = bg, selected = props.selected, edge = c.accent })
            if props.src then
                Image(props.src, {
                    width = props.width or 240,
                    height = props.height or 96,
                    region = props.region,
                    source_size = props.source_size,
                    fit = props.fit,
                })
            elseif props.placeholder then
                Text(props.placeholder, { style = T.current().type.body, color = c.dim })
            end
        end)
    end)
end)

return C
