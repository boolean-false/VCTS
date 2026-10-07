-- Общий набор компонентов (контракт kompot/docs/DESIGN_SYSTEM.md) в
-- исполнении Kompot UI: экран, написанный через K.ui(), в теме Kompot UI
-- использует фирменную тему Kompot UI.

local K = require "kompot:kompot"
local T = require "kompot:ui/tokens"
local C = require "kompot:ui/components"
local Skin = require "kompot:ui/skin"

local M = K.M
local UI = {}

local VARIANTS = { primary = "primary", secondary = "default", ghost = "ghost", danger = "danger" }

function UI.Button(props, content)
    local p = {}
    for k, v in pairs(props) do
        p[k] = v
    end
    p.variant = VARIANTS[props.variant or "secondary"] or props.variant
    C.Button(p, content)
end

UI.IconButton = C.IconButton
UI.Checkbox = C.Checkbox
UI.Switch = C.Switch
UI.Tabs = C.Tabs
UI.Divider = function(props)
    props = props or {}
    C.Divider({ thickness = props.thickness or 1, vertical = props.vertical, inset = props.inset })
end
UI.Badge = C.Badge
UI.ProgressBar = C.ProgressBar
UI.Tooltip = C.Tooltip
UI.Dialog = C.Dialog
UI.Scrollbar = C.Scrollbar
UI.MenuItem = C.MenuItem

function UI.Slider(props)
    local p = {}
    for k, v in pairs(props) do
        p[k] = v
    end
    if props.steps and props.steps > 0 then
        p.step = ((props.max or 1) - (props.min or 0)) / props.steps
    end
    C.Slider(p)
end

-- Поле с подписью. props: state или value, on_change, on_submit, label, hint, supporting, error,
-- lines, height, font, syntax, line_numbers, editable, wrap, on_focus, on_defocus, modifier
function UI.TextField(props)
    props = T.props("TextField", props)
    local c = T.current().colors
    K.Column({ modifier = (props.modifier or M):fill_max_width(), spacing = 4 }, function()
        if props.label then
            K.Text(props.label, { style = T.current().type.body, color = c.muted })
        end
        local field = {}
        for k, v in pairs(props) do
            field[k] = v
        end
        field.modifier, field.mod = nil, nil
        C.Field(field)
        if props.supporting or type(props.error) == "string" then
            K.Text(
                type(props.error) == "string" and props.error or props.supporting,
                { style = T.current().type.caption, color = props.error and c.error or c.dim }
            )
        end
    end)
end

-- Выбор по индексу. props: options, selected, on_select(i), modifier
function UI.Segmented(props)
    props = T.props("Segmented", props)
    local opts = {}
    for i, o in ipairs(props.options or {}) do
        opts[i] = {
            value = i,
            text = type(o) == "table" and (o.text or o[1]) or o,
            icon = type(o) == "table" and o.icon or nil,
        }
    end
    C.Choice({
        options = opts,
        selected = props.selected,
        on_select = props.on_select,
        modifier = props.modifier,
    })
end

function UI.Panel(props, content)
    C.Panel({
        title = props.title,
        accent = props.accent,
        variant = props.variant,
        width = false,
        modifier = props.modifier,
        padding = props.padding,
    }, content)
end

-- Строка списка. props: headline, supporting, icon, trailing, on_click, selected, modifier
UI.ListItem = K.component(function(props)
    props = T.props("ListItem", props)
    local c = T.current().colors
    local inter = K.interaction()
    local base = props.selected and c.action or K.color.with_alpha(c.control, 0)
    local bg = K.animate(
        props.on_click and inter.hovered.value and c.hover or base,
        T.current().motion.hover
    )
    local m = (props.modifier or M):fill_max_width():background(bg)
    if props.on_click then
        m = m:clickable(props.on_click, { interaction = inter })
    end
    K.Row({ modifier = m:padding(10, 6), align = "center", spacing = 10 }, function()
        if props.icon then
            Skin.Icon(props.icon, 18, c.muted)
        end
        K.Column({ modifier = M:weight(1), spacing = 0 }, function()
            K.Text(
                props.headline or "",
                { style = T.current().type.body, color = c.text, max_lines = 1 }
            )
            if props.supporting then
                K.Text(
                    props.supporting,
                    { style = T.current().type.caption, color = c.dim, max_lines = 2 }
                )
            end
        end)
        if type(props.trailing) == "function" then
            props.trailing()
        elseif props.trailing then
            K.Text(tostring(props.trailing), { style = T.current().type.body, color = c.muted })
        end
    end)
end)

function UI.Menu(props, content)
    local p = {}
    for k, v in pairs(props) do
        p[k] = v
    end
    p.width = props.width or 240
    C.Menu(p, content)
end

return UI
