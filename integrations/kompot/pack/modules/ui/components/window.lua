local K = require "kompot:kompot"
local T = require "kompot:ui/tokens"
local M = K.M
local min, max = math.min, math.max
local function clamp(v, lo, hi)
    return max(lo, min(hi, v))
end

return function(Panel, Button)
    return K.component(function(props, content)
        props = T.props("Window", props)
        local th, rt = T.current(), K.runtime()
        local saved = K.state(nil)
        local geometry = K.remember(function()
            return {}
        end)
        local bounds = props.bounds or saved.value
        local v = K.animate(props.visible ~= false and 1 or 0, th.motion.fast)
        local function update(dx, dy, edge)
            local g = geometry
            if not g.x then
                return
            end
            local x, y, w, h = g.x, g.y, g.w, g.h
            if edge then
                local left, right = edge:find("w"), edge:find("e")
                local top, bottom = edge:find("n"), edge:find("s")
                local minw = min(rt.width, props.min_width or 200)
                local minh = min(rt.height, props.min_height or 100)
                if left then
                    w = clamp(w - dx, minw, max(minw, min(props.max_width or rt.width, x + w)))
                    x = g.x + g.w - w
                elseif right then
                    w = clamp(
                        w + dx,
                        minw,
                        max(minw, min(props.max_width or rt.width, rt.width - x))
                    )
                end
                if top then
                    h = clamp(h - dy, minh, max(minh, min(props.max_height or rt.height, y + h)))
                    y = g.y + g.h - h
                elseif bottom then
                    h = clamp(
                        h + dy,
                        minh,
                        max(minh, min(props.max_height or rt.height, rt.height - y))
                    )
                end
            else
                x, y = x + dx, y + dy
            end
            local next_bounds = {
                x = clamp(x, 0, max(0, rt.width - w)),
                y = clamp(y, 0, max(0, rt.height - h)),
                width = w,
                height = h,
            }
            if not props.bounds then
                saved.value = next_bounds
            end
            if props.on_bounds_change then
                props.on_bounds_change(next_bounds)
            end
        end
        if v < 0.01 and props.visible == false then
            return
        end
        if props.modal then
            K.Popup({ placement = "fill", key = "win_scrim", z = props.z or 0 }, function()
                K.Box({
                    modifier = M:fill_max_size()
                        :background(K.color.mul_alpha(th.colors.scrim, v))
                        :clickable(function()
                            local f = props.on_dismiss or props.on_close
                            if f then
                                f()
                            end
                        end, {
                            cursor = "arrow",
                            focusable = false,
                            focus_scope = true,
                        }),
                })
            end)
        end
        ---@type KompotPlacement
        local placement = props.placement or "center"
        if bounds then
            placement = function(_, w, h, W, H)
                return clamp(bounds.x, 0, max(0, W - w)), clamp(bounds.y, 0, max(0, H - h))
            end
        end
        local width = bounds and bounds.width or props.width or 480
        local height = bounds and bounds.height or props.height
        if props.resizable then
            width = clamp(
                width,
                props.min_width or 200,
                max(props.min_width or 200, props.max_width or math.huge)
            )
            if height then
                height = clamp(
                    height,
                    props.min_height or 100,
                    max(props.min_height or 100, props.max_height or math.huge)
                )
            end
        end
        K.Popup({ placement = placement, z = props.z or 0 }, function()
            local frame = (props.modifier or M)
                :alpha(v)
                :offset(0, math.floor((1 - v) * 10))
                :on_placed(function(x, y, w, h)
                    geometry.x, geometry.y, geometry.w, geometry.h = x, y, w, h
                end)
            local title = props.title_modifier
            if props.draggable then
                title = (title or M):draggable({
                    cursor = "all-resize",
                    on_event = function(e)
                        if e.type == "move" then update(e.parent_dx, e.parent_dy) end
                    end,
                })
            end
            K.Layout({
                modifier = frame,
                measure = function(children, _, W, _, H, api)
                    local w, h = api.measure(children[1], 0, W, 0, H)
                    api.place(children[1], 0, 0)
                    local grip = min(6, w / 2, h / 2)
                    local handles = {
                        { grip, 0, w - grip * 2, grip },
                        { grip, h - grip, w - grip * 2, grip },
                        { 0, grip, grip, h - grip * 2 },
                        { w - grip, grip, grip, h - grip * 2 },
                        { 0, 0, grip, grip },
                        { w - grip, 0, grip, grip },
                        { 0, h - grip, grip, grip },
                        { w - grip, h - grip, grip, grip },
                    }
                    for i = 2, #children do
                        local r = handles[i - 1]
                        api.measure(children[i], r[3], r[3], r[4], r[4])
                        api.place(children[i], r[1], r[2])
                    end
                    return w, h
                end,
            }, function()
                Panel({
                    title = props.title,
                    accent = props.accent,
                    variant = props.variant,
                    width = width,
                    icon = props.icon,
                    background = th.colors.menu_bg,
                    modifier = height and M:height(height)
                        or (
                            props.resizable
                                and M:height_in(
                                    props.min_height or 100,
                                    max(props.min_height or 100, props.max_height or math.huge)
                                )
                            or nil
                        ),
                    spacing = props.spacing,
                    fill_height = props.resizable and height ~= nil,
                    title_modifier = title,
                    content_modifier = props.resizable and (height and M:weight(1) or M)
                        :fill_max_width()
                        :clip() or nil,
                    header = function()
                        if props.header then
                            props.header()
                        end
                        if props.on_close then
                            Button({
                                text = props.close_text or "Закрыть",
                                on_click = props.on_close,
                                min_width = 96,
                            })
                        end
                    end,
                }, content)
                if props.resizable then
                    for _, edge in ipairs({ "n", "s", "w", "e", "nw", "ne", "sw", "se" }) do
                        K.key(edge, function()
                            local cursor = #edge == 1
                                    and ((edge == "n" or edge == "s") and "ns-resize" or "ew-resize")
                                or (
                                    (edge == "nw" or edge == "se") and "nwse-resize"
                                    or "nesw-resize"
                                )
                            K.Box({
                                modifier = M:block_pointer():draggable({
                                    cursor = cursor,
                                    on_event = function(e)
                                        if e.type == "move" then update(e.parent_dx, e.parent_dy, edge) end
                                    end,
                                }),
                            })
                        end)
                    end
                end
            end)
        end)
    end)
end
