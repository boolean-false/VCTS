-- Фрагмент Lua на общем текстовом основании, со своим оформлением
local K = require "kompot:kompot"
local T = require "kompot:ui/tokens"

-- Lua(code, props?) или Lua({code, title?, line_numbers?, lines?, height?, font?, modifier?}).
-- Готовый фрагмент доступен для выделения, но не для редактирования
return function(code, props)
    if type(code) == "table" then
        props, code = code, code.code
    end
    props = props or {}
    code = tostring(code or "")
    local lines = 1
    for _ in code:gmatch("\n") do
        lines = lines + 1
    end
    local theme = T.current()
    local count = math.max(2, props.lines or lines)
    local font = props.font
    if font == nil then
        font = theme.type.mono.font
    end
    K.Column({ modifier = props.modifier or K.M:fill_max_width(), spacing = 6 }, function()
        if props.title then
            K.Text(props.title, { style = theme.type.body, color = theme.colors.muted })
        end
        K.BasicTextField({
            value = code,
            syntax = "lua",
            line_numbers = props.line_numbers == true,
            editable = false,
            font = font,
            color = theme.colors.text,
            wrap = false,
            presentation = props.presentation,
            lines = count,
            pad = theme.metrics.field_pad,
            modifier = (
                props.height and K.M:fill_max_width():height(props.height) or K.M:fill_max_width()
            ):background(theme.colors.sunken, theme.shapes.field):border(
                1,
                theme.colors.outline,
                theme.shapes.field
            ),
        })
    end)
end
