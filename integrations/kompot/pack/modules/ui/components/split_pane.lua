local K = require "kompot:kompot"
local T = require "kompot:ui/tokens"
local Common = require "kompot:ui/components/common"
local M = K.M
local min, max, floor = math.min, math.max, math.floor

return K.component(function(props)
    props = T.props("SplitPane", props)
    local vertical = props.orientation == "vertical"
    assert(
        props.orientation == nil or props.orientation == "horizontal" or vertical,
        "SplitPane: orientation must be horizontal or vertical"
    )
    assert(
        type(props.first) == "function" and type(props.second) == "function",
        "SplitPane: first and second content required"
    )
    local size = K.state(props.default_size or 240)
    local requested = props.size == nil and size.value or props.size
    local geometry = K.remember(function()
        return {}
    end)
    local inter = K.interaction()
    local c = T.current().colors
    local enabled = props.enabled ~= false
    local function change(delta)
        if not enabled or not geometry.first then
            return
        end
        local value = max(geometry.lo, min(geometry.hi, geometry.first + delta))
        if value == geometry.first then
            return
        end
        if props.size == nil then
            size.value = value
        end
        if props.on_change then
            props.on_change(value)
        end
    end
    local divider = (props.divider_modifier or M):hoverable(inter):block_pointer()
    if enabled then
        divider = divider
            :draggable({
                axis = vertical and 2 or 1,
                interaction = inter,
                cursor = vertical and "ns-resize" or "ew-resize",
                on_event = function(e)
                    if e.type == "move" then change(vertical and e.parent_dy or e.parent_dx) end
                end,
            })
            :focusable(function(key)
                if key == (vertical and "up" or "left") then
                    change(-(props.step or 10))
                elseif key == (vertical and "down" or "right") then
                    change(props.step or 10)
                end
            end, { interaction = inter })
    end
    K.Layout({
        modifier = Common.mods(props),
        measure = function(children, _, w, _, h, api)
            assert(w < math.huge and h < math.huge, "SplitPane requires bounded width and height")
            local extent = vertical and h or w
            local handle = min(extent, max(1, props.divider_size or 12))
            local available = max(0, extent - handle)
            local lo, second_min = max(0, props.min_first or 0), max(0, props.min_second or 0)
            if lo + second_min > available then
                lo = available * lo / (lo + second_min)
                second_min = available - lo
            end
            local hi = max(lo, min(available - second_min, props.max_first or available))
            local first = floor(max(lo, min(hi, requested)))
            geometry.first, geometry.lo, geometry.hi = first, lo, hi
            local sizes, positions =
                { first, available - first, handle }, { 0, first + handle, first }
            for i, child in ipairs(children) do
                local cw, ch = vertical and w or sizes[i], vertical and sizes[i] or h
                api.measure(child, cw, cw, ch, ch)
                api.place(child, vertical and 0 or positions[i], vertical and positions[i] or 0)
            end
            return w, h
        end,
    }, function()
        K.Box({ modifier = M:clip() }, props.first)
        K.Box({ modifier = M:clip() }, props.second)
        K.Box({ modifier = divider, align = "center" }, function()
            local line = vertical and M:fill_max_width():height(2) or M:width(2):fill_max_height()
            K.Box({
                modifier = line:background(
                    enabled
                            and (inter.pressed.value and c.accent or (inter.hovered.value and c.text or c.outline))
                        or c.outline
                ),
            })
        end)
    end)
end)
