local K = require "kompot:kompot"
local T = require "kompot:ui/tokens"
local Common = require "kompot:ui/components/common"
local Skin = require "kompot:ui/skin"
local M = K.M
local C = {}
local sizes = { sm = "control_sm", md = "control", lg = "control_lg" }
-- При нажатии меняем край и сдвигаем содержимое вниз.
C.Button = K.component(function(p, content)
    p = T.props("Button", p)
    local t, inter = T.current(), K.interaction()
    local c, mt = t.colors, t.metrics
    local enabled, selected = p.enabled ~= false, p.selected
    local base, hover, pressed = Common.variant_colors(c, p.variant, selected)
    if not enabled then
        base = c.disabled_bg
    end
    local bg = Common.state_color(base, hover, pressed, inter, enabled)
    local fg = not enabled and c.disabled_fg or c.text
    if enabled and (p.variant == "primary" or selected) then
        fg = K.color.on(bg, c.shadow, c.bright)
    end
    local down = enabled and inter.pressed.value
    Common.with_tooltip(p.tooltip, function()
        K.Box({
            modifier = (p.modifier or M)
                :height(mt[sizes[p.size or "md"]] or mt.control)
                :width_in(p.min_width or 0, 100000)
                :clickable(p.on_click, {
                    interaction = inter,
                    enabled = enabled,
                    on_right_click = p.on_right_click,
                    focus_color = c.primary,
                    focus_radius = p.radius or t.shapes.control,
                }),
            align = p.align == "start" and "center_start" or "center",
        }, function()
            Skin.Surface({
                kind = "button",
                color = bg,
                pressed = down,
                selected = selected,
                edge = c.primary,
            })
            K.Row({
                modifier = M:fill_max_height()
                    :offset(0, down and 2 or 0)
                    :padding(p.compact and 6 or mt.button_pad, 0),
                spacing = 8,
                align = "center",
                arrangement = p.align == "start" and "start" or "center",
            }, function()
                K.ContentColor(fg, function()
                    if p.icon then
                        Common.any_icon(p.icon, 16, fg)
                    end
                    if content then
                        content()
                    elseif p.text then
                        K.Text(p.text, {
                            style = t.type.body,
                            color = fg,
                            wrap = false,
                            modifier = p.trailing and M:weight(1) or nil,
                        })
                    end
                    if p.trailing then
                        K.Text(p.trailing, { style = t.type.caption, color = fg, wrap = false })
                    end
                end)
            end)
        end)
    end)
end)
return C
