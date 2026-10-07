local K = require "kompot:kompot"
local T = require "kompot:ui/tokens"
local C = require "kompot:ui/components"
local Common = require "kompot:ui/components/common"
local Skin = require "kompot:ui/skin"
local M = K.M
local G = {}
local function clamp(v)
    return math.max(0, math.min(1, v or 0))
end
local function copy(p)
    local o = {}
    for k, v in pairs(p or {}) do
        o[k] = v
    end
    return o
end

-- Предмет: {id, name, src, count, durability, rarity, description}.
-- src содержит имя текстуры или спрайта атласа, например block-previews:base:stone.
G.ItemSlot = K.component(function(p)
    p = T.props("ItemSlot", p)
    local t, inter = T.current(), K.interaction()
    local c, item = t.colors, p.item
    if not item and (p.src or p.icon or p.badge) then
        item = { src = p.src, count = tonumber(p.badge) }
    end
    local enabled = p.enabled ~= false and not p.locked
    local over, valid = K.state(false), K.state(false)
    local drag_pos = K.state(nil)
    local size = p.size or t.metrics.slot
    local function accepts(payload)
        return enabled and (not p.accepts or p.accepts(payload) ~= false)
    end
    local edge = p.selected and c.primary or c.slot_edge
    if over.value then
        edge = valid.value and c.success or c.error
    end
    if inter.focused.value then
        edge = c.primary
    end
    local bg = Common.state_color(c.sunken, c.control, c.pressed, inter, enabled)
    local m = (p.modifier or M):size(size):clickable(p.on_click, {
        interaction = inter,
        enabled = enabled,
        on_right_click = p.on_right_click,
        focus_color = c.primary,
        focus_radius = 0,
    })
    if enabled and item and p.on_drag_event then
        m = m:draggable({
            interaction = inter,
            button = p.drag_button,
            on_event = function(e)
                if e.type == "move" then
                    drag_pos.value = { e.x, e.y }
                elseif e.type == "end" or e.type == "cancel" then
                    drag_pos.value = nil
                end
                return p.on_drag_event(e, item)
            end,
        })
    end
    if p.on_drop then
        m = m:drop_target({
            on_enter = function(payload)
                over.value, valid.value = true, accepts(payload)
            end,
            on_leave = function()
                over.value, valid.value = false, false
            end,
            on_drop = function(payload)
                over.value = false
                if not accepts(payload) then
                    return false
                end
                return p.on_drop(payload)
            end,
        })
    end
    local function draw()
        K.Box({ modifier = m, align = "center" }, function()
            Skin.Surface({
                kind = "inset",
                color = bg,
                selected = p.selected or over.value or inter.focused.value,
                edge = edge,
            })
            if item and item.src then
                K.Image(
                    item.src,
                    { size = size - 12, color = inter.dragged.value and K.hex("#FFFFFF66") or nil }
                )
            elseif p.icon or p.placeholder then
                Skin.Icon(p.icon or p.placeholder, 22, c.dim)
            end
            if p.keycap then
                K.Box({ modifier = M:align("top_start"):padding(3, 0) }, function()
                    K.Text(tostring(p.keycap), { style = t.type.caption, color = c.muted })
                end)
            end
            local count_text = p.badge and tostring(p.badge)
                or (item and item.count and item.count > 1 and tostring(item.count))
            if count_text then
                K.Box({
                    modifier = M:align("bottom_end")
                        :background(K.color.with_alpha(c.shadow, 0.55))
                        :padding(3, 1),
                }, function()
                    K.Text(count_text, {
                        style = t.type.mono,
                        color = c.bright,
                        modifier = M:width_in(
                            math.ceil(
                                #count_text
                                    * (t.type.mono.size or 16)
                                    * (t.type.mono.font == "normal" and 0.5 or 0.65)
                            ),
                            10000
                        ),
                    })
                end)
            end
            if item and item.durability ~= nil then
                K.Box({ modifier = M:align("bottom_start"):padding(4, 0, 4, 4) }, function()
                    K.Box({ modifier = M:size(size - 8, 3):background(c.shadow) }, function()
                        K.Box({
                            modifier = M:size(math.floor((size - 8) * clamp(item.durability)), 3)
                                :background(item.durability < 0.25 and c.error or c.success),
                        })
                    end)
                end)
            end
            if item and item.rarity then
                K.Box({
                    modifier = M:align("top_end"):size(4, 12):background(K.color.of(item.rarity)),
                })
            end
            if not enabled then
                K.Box({
                    modifier = M:match_parent_size():background(K.hex("#171A1699")),
                    align = "center",
                }, function()
                    if p.locked then
                        Skin.Icon("lock", 18, c.muted)
                    end
                end)
            end
            if inter.dragged.value and drag_pos.value and item and item.src then
                local pos = drag_pos.value
                K.Popup({
                    z = 40,
                    placement = function(anchor)
                        return anchor.x + pos[1] + 10, anchor.y + pos[2] + 10
                    end,
                }, function()
                    K.Image(item.src, { size = size - 8 })
                end)
            end
        end)
    end
    local tip = p.tooltip
    if tip == nil and item then
        tip = item.name or item.id
        if tip and item.description then
            tip = tip .. "\n" .. item.description
        end
    end
    Common.Tooltip({ text = tip, suppressed = inter.dragged.value }, draw)
end)
G.Slot = G.ItemSlot

-- В items могут быть пропуски. count задаёт число ячеек, а менять items должен вызывающий код.
G.InventoryGrid = K.component(function(p)
    local columns = math.max(1, math.floor(p.columns or 8))
    local count = math.max(0, math.floor(p.count or #(p.items or {})))
    local gap = p.gap or 4
    local identity = K.remember(function()
        return {}
    end)
    local group = p.drag_group or identity
    K.Column({ modifier = p.modifier, spacing = gap }, function()
        for row = 0, math.ceil(count / columns) - 1 do
            K.Row({ spacing = gap }, function()
                for col = 1, columns do
                    local i = row * columns + col
                    if i <= count then
                        K.key(i, function()
                            local q = copy(p.slot_props)
                            q.item, q.selected, q.size =
                                (p.items or {})[i], p.selected == i, p.size or q.size
                            q.modifier = M:tag((p.tag_prefix or "slot_") .. i)
                            q.on_click = p.on_select
                                    and function()
                                        p.on_select(i)
                                    end
                                or nil
                            q.on_right_click = p.on_right_click
                                    and function()
                                        p.on_right_click(i)
                                    end
                                or nil
                            if p.on_move then
                                local callback = q.on_drag_event
                                q.on_drag_event = function(e, item)
                                    if callback then callback(e, item) end
                                    if e.type == "start" then
                                        return { index = i, item = item, group = group }
                                    end
                                end
                            end
                            q.accepts = function(payload)
                                return type(payload) == "table"
                                    and payload.group == group
                                    and type(payload.index) == "number"
                                    and payload.index >= 1
                                    and payload.index <= count
                                    and (not p.accepts or p.accepts(i, payload))
                            end
                            q.on_drop = p.on_move
                                    and function(payload)
                                        if payload.index == i then
                                            return false
                                        end
                                        return p.on_move(payload.index, i, payload.item)
                                    end
                                or nil
                            G.ItemSlot(q)
                        end)
                    end
                end
            end)
        end
    end)
end)

G.Hotbar = K.component(function(p)
    local t = T.current()
    K.Column({ modifier = p.modifier, spacing = 6, align = "center" }, function()
        local selected = (p.items or {})[p.selected or 1]
        if p.show_name ~= false and selected then
            K.Box({}, function()
                Skin.Surface({ color = t.colors.panel_bg })
                K.Text(
                    selected.name or selected.id or "",
                    { style = t.type.title, modifier = M:padding(12, 8) }
                )
            end)
        end
        K.Box({}, function()
            Skin.Surface({ color = t.colors.panel_bg })
            K.Row({ modifier = M:padding(6), spacing = 4 }, function()
                for i = 1, p.count or 10 do
                    K.key(i, function()
                        G.ItemSlot({
                            item = (p.items or {})[i],
                            selected = (p.selected or 1) == i,
                            keycap = i == 10 and "0" or i,
                            size = p.size,
                            on_click = p.on_select and function()
                                p.on_select(i)
                            end or nil,
                        })
                    end)
                end
            end)
        end)
    end)
end)

G.ResourceBar = K.component(function(p)
    local t = T.current()
    local max = math.max(0.0001, p.max or 100)
    local fraction = clamp((p.value or 0) / max)
    local segments = math.max(1, math.floor(p.segments or 10))
    local fill = K.color.of(p.color) or t.colors[p.kind or "energy"] or t.colors.primary
    K.Column({ modifier = (p.modifier or M):fill_max_width(), spacing = 4 }, function()
        if p.label then
            local value_text = p.text or (tostring(p.value or 0) .. " / " .. tostring(p.max or 100))
            local layout = p.compact and K.Column or K.Row
            layout({ modifier = M:fill_max_width(), spacing = 2 }, function()
                K.Text(p.label, {
                    style = t.type.caption,
                    wrap = false,
                    modifier = not p.compact and M:weight(1) or nil,
                })
                K.Text(value_text, {
                    style = t.type.mono,
                    wrap = false,
                    modifier = M:width_in(
                        math.ceil(
                            #value_text
                                * (t.type.mono.size or 16)
                                * (t.type.mono.font == "normal" and 0.5 or 0.65)
                        ),
                        10000
                    ),
                })
            end)
        end
        K.Row({
            modifier = M:fill_max_width()
                :height(p.height or 12)
                :background(t.colors.shadow)
                :padding(2),
            spacing = 2,
        }, function()
            for i = 1, segments do
                local amount = clamp(fraction * segments - i + 1)
                K.Box(
                    { modifier = M:weight(1):fill_max_height():background(t.colors.control) },
                    function()
                        if amount > 0 then
                            K.Box({
                                modifier = M:fill_max_width(amount)
                                    :fill_max_height()
                                    :background(fill),
                            })
                        end
                    end
                )
            end
        end)
    end)
end)

function G.ActionHint(p)
    local c = T.current().colors
    K.Box({ modifier = p.modifier }, function()
        Skin.Surface({ color = c.panel_bg })
        K.Row({ modifier = M:padding(10, 6), spacing = 8, align = "center" }, function()
            C.Key(p.binding or "E")
            K.Text(
                p.text or "Взаимодействовать",
                { style = T.current().type.body }
            )
            if p.detail then
                K.Text(p.detail, { color = c.muted, style = T.current().type.caption })
            end
        end)
    end)
end

function G.ItemDetails(p)
    local item, t = p.item, T.current()
    C.Panel({
        title = item and (item.name or item.id) or "Предмет не выбран",
        width = p.width or 240,
        modifier = p.modifier,
    }, function()
        if item then
            if item.src then
                K.Image(item.src, { size = 80 })
            end
            if item.description then
                K.Text(item.description, { color = t.colors.muted })
            end
            if item.count then
                K.Text("Количество: " .. item.count, { style = t.type.mono })
            end
            if item.durability then
                G.ResourceBar({
                    label = "Прочность",
                    value = math.floor(clamp(item.durability) * 100),
                    kind = "health",
                })
            end
        else
            K.Text("Выберите ячейку инвентаря.", { color = t.colors.muted })
        end
        if p.actions then
            p.actions(item)
        end
    end)
end

G.MachinePanel = K.component(function(p)
    local t = T.current()
    C.Panel({
        title = p.title or "Устройство",
        width = p.width or 380,
        modifier = p.modifier,
        header = nil,
    }, function()
        K.Row({ modifier = M:fill_max_width(), spacing = 12, align = "center" }, function()
            G.ItemSlot({
                item = p.input,
                placeholder = "arrow_down",
                on_click = p.on_input,
                accepts = p.accepts,
                on_drop = p.on_drop,
            })
            K.Column({ modifier = M:weight(1), spacing = 6 }, function()
                K.Text(p.recipe or "Обработка", { style = t.type.caption })
                C.ProgressBar({
                    progress = p.progress or 0,
                    color = t.colors.energy,
                    height = 5,
                })
            end)
            G.ItemSlot({
                item = p.output,
                placeholder = "arrow_up",
                on_click = p.on_output,
                modifier = M:tag("machine_output"),
            })
        end)
        if p.energy ~= nil then
            G.ResourceBar({
                label = "Энергия",
                value = p.energy,
                max = p.max_energy or 100,
                kind = "energy",
            })
        end
        if p.status then
            K.Text(p.status, { color = t.colors.muted, style = t.type.caption })
        end
        if p.on_start then
            C.Button({
                text = p.running and "Остановить" or "Запустить",
                variant = "primary",
                on_click = p.on_start,
                modifier = M:tag("machine_start"),
            })
        end
        if p.content then
            p.content()
        end
    end)
end)
-- HUD можно монтировать сразу. Пустая область не перехватывает клики по миру.
G.HUD = K.component(function(p)
    local available = K.state(K.runtime().width)
    local width = available.value
    local count = p.count or 10
    local slot_size =
        math.max(20, math.min(T.current().metrics.slot, math.floor((width - 40) / count) - 4))
    local bar_width = math.max(70, math.min(164, math.floor((width - 56) / 3)))
    K.Box({
        modifier = (p.modifier or M)
            :fill_max_size()
            :on_size(function(w)
                available.value = w
            end)
            :padding(16),
    }, function()
        K.Column({ modifier = M:align("bottom_center"), spacing = 8, align = "center" }, function()
            if p.prompt then
                G.ActionHint(p.prompt)
            end
            K.Row({ spacing = 8 }, function()
                for _, entry in ipairs({
                    { "health", "Здоровье" },
                    { "energy", "Энергия" },
                    { "experience", "Опыт" },
                }) do
                    local value = p[entry[1]]
                    if value ~= nil then
                        local maximum = p[entry[1] .. "_max"] or 100
                        Common.Tooltip(
                            { text = entry[2] .. ": " .. value .. " / " .. maximum },
                            function()
                                K.Row({
                                    modifier = M:width(bar_width),
                                    spacing = 6,
                                    align = "center",
                                }, function()
                                    Skin.Icon(entry[1], 14, T.current().colors[entry[1]])
                                    G.ResourceBar({
                                        kind = entry[1],
                                        value = value,
                                        max = maximum,
                                        height = 10,
                                        modifier = M:weight(1),
                                    })
                                end)
                            end
                        )
                    end
                end
            end)
            G.Hotbar({
                items = p.items,
                selected = p.selected,
                count = count,
                size = slot_size,
                on_select = p.on_select,
                show_name = p.show_name,
            })
        end)
    end)
end)
return G
