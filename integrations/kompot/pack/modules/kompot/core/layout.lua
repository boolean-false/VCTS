-- Раскладка: измерение и размещение дерева узлов.
--
-- Кэш: узел хранит последние ограничения и размер. Повторное измерение с
-- теми же ограничениями отдаёт сохранённое, пока узел не устарел (_stale):
-- его или потомка перекомпоновали, либо изменился State, прочитанный им во
-- время раскладки. Наблюдатель State при раскладке - сам измеряемый узел.
-- Все поля, которые раскладка пишет в узел (размеры слоёв, позиции детей,
-- text_layout), соответствуют последнему измерению, поэтому кэш хранит
-- только одну запись.
--
-- Ограничения - четыре числа (minW, maxW, minH, maxH), math.huge - без предела.
-- Каждый модификатор раскладки - слой: у слоя i есть размер (lw[i], lh[i]) и
-- смещение вложенного слоя (lox[i], loy[i]). После последнего слоя - содержимое
-- узла (cw, ch), дети размещаются относительно его начала (child.x, child.y).

local text = require "kompot:kompot/core/text"
local runtime = require "kompot:kompot/core/runtime"

local L = {}

local INF = math.huge
local max, min, floor, ceil = math.max, math.min, math.floor, math.ceil

local ctx = { rt = nil, m = nil, gen = 0 }

local function coerce(v, lo, hi)
    if v < lo then
        return lo
    end
    if v > hi then
        return hi
    end
    return v
end
L.coerce = coerce

-- Выравнивания: строка -> доли (0 .. 1)

local ALIGN2 = {
    top_start = { 0, 0 },
    top_center = { 0.5, 0 },
    top_end = { 1, 0 },
    center_start = { 0, 0.5 },
    center = { 0.5, 0.5 },
    center_end = { 1, 0.5 },
    bottom_start = { 0, 1 },
    bottom_center = { 0.5, 1 },
    bottom_end = { 1, 1 },
}
local ALIGN1 = {
    start = 0,
    top = 0,
    center = 0.5,
    ["end"] = 1,
    bottom = 1,
}
L.ALIGN2, L.ALIGN1 = ALIGN2, ALIGN1

local function align2(a)
    return ALIGN2[a or "top_start"] or ALIGN2.top_start
end

local function align1(a, default)
    if type(a) == "number" then
        return a
    end
    local v = ALIGN1[a or default or "start"]
    return v or 0
end

-- Дети с раскрытыми фрагментами (фрагмент - прозрачный узел области)

local pass = 0
-- счётчик поколений кэша раскладки (см. L.run)
local gen_counter = 0

-- _parent у детей и фрагментов - путь, по которому перекомпозиция
-- помечает устаревшие размеры (runtime.invalidate_node).
local function flatten_into(list, node, owner)
    for _, c in ipairs(node.children) do
        c._parent = owner
        if c.kind == "fragment" then
            flatten_into(list, c, owner)
        else
            list[#list + 1] = c
        end
    end
end

local function kids(node)
    if node._pass == pass then
        return node._kids
    end
    local list = node.children
    local flat = true
    for _, c in ipairs(list) do
        c._parent = node
        if c.kind == "fragment" then
            flat = false
        end
    end
    if not flat then
        list = {}
        flatten_into(list, node, node)
    end
    node._kids, node._pass = list, pass
    return list
end
L.kids = kids

-- Данные для родителя из модификаторов ребёнка (weight, align, z).
local function parent_data(node)
    local pd = node.pd
    if pd then
        return pd
    end
    pd = {}
    for _, m in ipairs(node.mods) do
        if m.t == "weight" then
            pd.weight, pd.fill = m.w, m.fill
        elseif m.t == "align" then
            pd.align = m.a
        elseif m.t == "z" then
            pd.z = m.z
        elseif m.t == "match" then
            pd.match = true
        end
    end
    node.pd = pd
    return pd
end
L.parent_data = parent_data

-- Измерение

local POLICIES = {}
local LAYERS = {}
local measure

local function measure_layer(node, i, minW, maxW, minH, maxH)
    local m = node.mods[i]
    if m == nil then
        local pol = POLICIES[node.kind] or POLICIES.box
        local w, h = pol(node, minW, maxW, minH, maxH)
        w = coerce(w, minW, maxW)
        h = coerce(h, minH, maxH)
        node.cw, node.ch = w, h
        return w, h
    end
    local handler = LAYERS[m.t]
    local w, h, ox, oy
    if handler then
        w, h, ox, oy = handler(node, i, m, minW, maxW, minH, maxH)
    else
        w, h = measure_layer(node, i + 1, minW, maxW, minH, maxH)
        ox, oy = 0, 0
    end
    node.lw[i], node.lh[i], node.lox[i], node.loy[i] = w, h, ox or 0, oy or 0
    return w, h
end

function measure(node, minW, maxW, minH, maxH)
    if maxW < minW then
        maxW = minW
    end
    if maxH < minH then
        maxH = minH
    end
    if
        not node._stale
        and node._minW == minW
        and node._maxW == maxW
        and node._minH == minH
        and node._maxH == maxH
        and node._gen == ctx.gen
    then
        L.stats.hits = L.stats.hits + 1
        return node.w, node.h
    end
    L.stats.misses = L.stats.misses + 1
    -- подписки прошлого измерения; чтения этого соберут их заново
    if node.deps then
        runtime.unsubscribe(node)
    end
    local prev = runtime.swap_observer(node)
    node.lw, node.lh, node.lox, node.loy =
        node.lw or {}, node.lh or {}, node.lox or {}, node.loy or {}
    local w, h = measure_layer(node, 1, minW, maxW, minH, maxH)
    runtime.swap_observer(prev)
    node.w, node.h = w, h
    node._minW, node._maxW, node._minH, node._maxH = minW, maxW, minH, maxH
    node._gen = ctx.gen
    -- отметки, сделанные во время собственного измерения (например, State,
    -- записанный раскладкой), уже учтены
    node._stale = nil
    -- поддерево перемерено: отрисовку тоже строить заново (render.lua)
    node._rdirty = true
    return w, h
end
-- Счётчики кэша (для тестов и замеров).
L.stats = { hits = 0, misses = 0 }
L.measure = measure

-- padding
LAYERS.padding = function(node, i, m, minW, maxW, minH, maxH)
    local hp, vp = m.l + m.r, m.tp + m.b
    local w, h = measure_layer(
        node,
        i + 1,
        max(0, minW - hp),
        max(0, maxW - hp),
        max(0, minH - vp),
        max(0, maxH - vp)
    )
    return coerce(w + hp, minW, maxW), coerce(h + vp, minH, maxH), m.l, m.tp
end

-- size / width / height / size_in / required_size
LAYERS.size = function(node, i, m, minW, maxW, minH, maxH)
    local a, b, c, d
    if m.required then
        a = m.minw or minW
        b = m.maxw or maxW
        c = m.minh or minH
        d = m.maxh or maxH
    else
        a = m.minw and coerce(m.minw, minW, maxW) or minW
        b = m.maxw and coerce(m.maxw, minW, maxW) or maxW
        c = m.minh and coerce(m.minh, minH, maxH) or minH
        d = m.maxh and coerce(m.maxh, minH, maxH) or maxH
        if m.range then
            -- диапазон не сужает минимум родителя сверх заданного
            if m.minw == nil then
                a = minW
            end
            if m.minh == nil then
                c = minH
            end
        end
    end
    if b < a then
        b = a
    end
    if d < c then
        d = c
    end
    local w, h = measure_layer(node, i + 1, a, b, c, d)
    if m.required then
        return w, h, 0, 0
    end
    return coerce(w, minW, maxW), coerce(h, minH, maxH), 0, 0
end

-- fill_max_*
LAYERS.fill = function(node, i, m, minW, maxW, minH, maxH)
    local a, b, c, d = minW, maxW, minH, maxH
    if m.fw and maxW < INF then
        local v = max(minW, floor(maxW * m.fw))
        a, b = v, v
    end
    if m.fh and maxH < INF then
        local v = max(minH, floor(maxH * m.fh))
        c, d = v, v
    end
    local w, h = measure_layer(node, i + 1, a, b, c, d)
    return coerce(w, minW, maxW), coerce(h, minH, maxH), 0, 0
end

-- wrap_content: содержимое по своему размеру, по центру слоя
LAYERS.wrap = function(node, i, m, minW, maxW, minH, maxH)
    local w, h = measure_layer(node, i + 1, 0, maxW, 0, maxH)
    local W, H = coerce(w, minW, maxW), coerce(h, minH, maxH)
    return W, H, floor((W - w) / 2), floor((H - h) / 2)
end

LAYERS.aspect = function(node, i, m, minW, maxW, minH, maxH)
    local r = m.ratio
    local w, h
    if maxW < INF then
        w = maxW
        h = w / r
        if h > maxH then
            h = maxH
            w = h * r
        end
    elseif maxH < INF then
        h = maxH
        w = h * r
    else
        w, h = measure_layer(node, i + 1, minW, maxW, minH, maxH)
        return w, h, 0, 0
    end
    w, h = floor(w), floor(h)
    measure_layer(node, i + 1, w, w, h, h)
    return w, h, 0, 0
end

LAYERS.offset = function(node, i, m, minW, maxW, minH, maxH)
    local w, h = measure_layer(node, i + 1, minW, maxW, minH, maxH)
    return w, h, m.x, m.y
end

-- прокрутка: содержимое без ограничения по оси, слой - по родителю
LAYERS.scroll = function(node, i, m, minW, maxW, minH, maxH)
    local st = m.state
    if m.axis == 2 then
        local w, h = measure_layer(node, i + 1, minW, maxW, 0, INF)
        local H = coerce(h, minH, maxH)
        local W = coerce(w, minW, maxW)
        st:_set_limits(max(0, h - H), H)
        return W, H, 0, -floor(st:_offset())
    else
        local w, h = measure_layer(node, i + 1, 0, INF, minH, maxH)
        local W = coerce(w, minW, maxW)
        local H = coerce(h, minH, maxH)
        st:_set_limits(max(0, w - W), W)
        return W, H, -floor(st:_offset()), 0
    end
end

-- Политики узлов

POLICIES.box = function(node, minW, maxW, minH, maxH)
    local p = node.params
    local cminW = p.propagate_min and minW or 0
    local cminH = p.propagate_min and minH or 0
    local w, h = minW, minH
    local children = kids(node)
    local matched = nil
    for _, c in ipairs(children) do
        if parent_data(c).match then
            matched = matched or {}
            matched[#matched + 1] = c
        else
            local cw, ch = measure(c, cminW, maxW, cminH, maxH)
            if cw > w then
                w = cw
            end
            if ch > h then
                h = ch
            end
        end
    end
    w, h = coerce(w, minW, maxW), coerce(h, minH, maxH)
    -- match_parent_size: размер Box по остальным детям, эти - ровно в него
    if matched then
        for _, c in ipairs(matched) do
            measure(c, w, w, h, h)
        end
    end
    local def = p.align
    for _, c in ipairs(children) do
        local a = align2(parent_data(c).align or def)
        c.x = floor((w - c.w) * a[1])
        c.y = floor((h - c.h) * a[2])
    end
    return w, h
end

POLICIES.spacer = function(node, minW, maxW, minH, maxH)
    return minW, minH
end

POLICIES.anchor = function()
    return 0, 0
end

-- Дети без якорей всплывающих слоёв (они не занимают места).
local function laid_children(node)
    local list = kids(node)
    for _, c in ipairs(list) do
        if c.kind == "anchor" then
            local out = {}
            for _, d in ipairs(list) do
                if d.kind ~= "anchor" then
                    out[#out + 1] = d
                end
            end
            return out
        end
    end
    return list
end

-- Row (axis = 1) и Column (axis = 2)
local function linear(node, axis, minW, maxW, minH, maxH)
    local p = node.params
    local children = laid_children(node)
    local n = #children
    local spacing = p.spacing or 0
    local main_min, main_max, cross_max
    if axis == 1 then
        main_min, main_max, cross_max = minW, maxW, maxH
    else
        main_min, main_max, cross_max = minH, maxH, maxW
    end
    local gaps = n > 1 and spacing * (n - 1) or 0
    local used, weight_sum, cross = 0, 0, 0
    local cross_fill = p.fill_cross -- растянуть детей по поперечной оси
    for _, c in ipairs(children) do
        local pd = parent_data(c)
        if pd.weight then
            weight_sum = weight_sum + pd.weight
        else
            local avail = main_max < INF and max(0, main_max - used - gaps) or INF
            local cm, cc
            local cross_min = cross_fill and cross_max < INF and cross_max or 0
            if axis == 1 then
                cm, cc = measure(c, 0, avail, cross_min, cross_max)
            else
                cc, cm = measure(c, cross_min, cross_max, 0, avail)
            end
            used = used + cm
            if cc > cross then
                cross = cc
            end
        end
    end
    if weight_sum > 0 then
        local remaining = main_max < INF and max(0, main_max - used - gaps) or 0
        local left, left_w = remaining, weight_sum
        for _, c in ipairs(children) do
            local pd = parent_data(c)
            if pd.weight then
                local alloc = left_w > 0 and floor(left * pd.weight / left_w + 0.5) or 0
                left, left_w = left - alloc, left_w - pd.weight
                local cm, cc
                local cross_min = cross_fill and cross_max < INF and cross_max or 0
                if axis == 1 then
                    cm, cc = measure(c, pd.fill and alloc or 0, alloc, cross_min, cross_max)
                else
                    cc, cm = measure(c, cross_min, cross_max, pd.fill and alloc or 0, alloc)
                end
                used = used + cm
                if cc > cross then
                    cross = cc
                end
            end
        end
    end
    local content = used + gaps
    local main
    if weight_sum > 0 and main_max < INF then
        main = max(main_min, main_max)
    else
        main = coerce(content, main_min, main_max)
    end
    local W, H
    if axis == 1 then
        W, H = main, coerce(cross, minH, maxH)
    else
        W, H = coerce(cross, minW, maxW), main
    end
    local cross_size = axis == 1 and H or W

    -- расстановка по главной оси
    local arr = p.arrangement or "start"
    local free = main - content
    local pos, gap = 0, spacing
    if arr == "end" then
        pos = free
    elseif arr == "center" then
        pos = free / 2
    elseif arr == "between" then
        if n > 1 then
            gap = spacing + free / (n - 1)
        end
    elseif arr == "around" then
        local g = n > 0 and free / n or 0
        pos, gap = g / 2, spacing + g
    elseif arr == "evenly" then
        local g = free / (n + 1)
        pos, gap = g, spacing + g
    end
    local def_cross = p.align
    for _, c in ipairs(children) do
        local cross_a = align1(parent_data(c).align or def_cross, "start")
        if axis == 1 then
            c.x = floor(pos + 0.5)
            c.y = floor((cross_size - c.h) * cross_a + 0.5)
            pos = pos + c.w + gap
        else
            c.y = floor(pos + 0.5)
            c.x = floor((cross_size - c.w) * cross_a + 0.5)
            pos = pos + c.h + gap
        end
    end
    return W, H
end

POLICIES.row = function(node, minW, maxW, minH, maxH)
    return linear(node, 1, minW, maxW, minH, maxH)
end

POLICIES.column = function(node, minW, maxW, minH, maxH)
    return linear(node, 2, minW, maxW, minH, maxH)
end

-- Перенос детей по строкам (FlowRow).
POLICIES.flow = function(node, minW, maxW, minH, maxH)
    local p = node.params
    local sx, sy = p.spacing or 0, p.run_spacing or p.spacing or 0
    local x, y, line_h, w = 0, 0, 0, 0
    local line = {}
    local function finish_line()
        -- выравнивание по вертикали внутри строки
        for _, c in ipairs(line) do
            c.y = y + floor((line_h - c.h) * align1(p.align, "top"))
        end
        line = {}
    end
    for _, c in ipairs(laid_children(node)) do
        local cw, ch = measure(c, 0, maxW, 0, INF)
        if x > 0 and x + cw > maxW then
            finish_line()
            y = y + line_h + sy
            x, line_h = 0, 0
        end
        c.x = x
        line[#line + 1] = c
        x = x + cw + sx
        if ch > line_h then
            line_h = ch
        end
        if x - sx > w then
            w = x - sx
        end
    end
    finish_line()
    return max(minW, w), max(minH, y + line_h)
end

POLICIES.text = function(node, minW, maxW, minH, maxH)
    local p = node.params
    local font = p.font
    local lay
    if p.runs then
        lay = text.layout_rich(ctx.m, p.runs, maxW, p.max_lines, p.wrap)
    else
        lay = text.layout(ctx.m, font, p.text, maxW, p.max_lines, p.wrap, p.ellipsis)
    end
    node.text_layout = lay
    local lh = lay.lh
    return ceil(lay.w), max(ceil(lay.h), lh)
end

POLICIES.image = function(node, minW, maxW, minH, maxH)
    local p = node.params
    local sw, sh = p.source_width, p.source_height
    if sw and sh and sw > 0 and sh > 0 then
        local uv = p.region or { 0, 0, 1, 1 }
        sw, sh = sw * math.abs(uv[3] - uv[1]), sh * math.abs(uv[4] - uv[2])
    end
    if p.width and not p.height and sw and sh and sw > 0 and sh > 0 then
        local w = coerce(p.width, minW, maxW)
        return w, w * sh / sw
    elseif p.height and not p.width and sw and sh and sw > 0 and sh > 0 then
        local h = coerce(p.height, minH, maxH)
        return h * sw / sh, h
    end
    return p.width or sw or 24, p.height or sh or 24
end

POLICIES.field = function(node, minW, maxW, minH, maxH)
    local p = node.params
    local lines = p.lines or 1
    local lh = lines > 1 and text.field_line_height(ctx.m, p.font) or ctx.m:line_height(p.font)
    node.field_line_height = lh
    local w = p.width or (maxW < INF and maxW or 200)
    return w, lh * lines + (p.pad or 8) * 2
end

POLICIES.canvas = function(node, minW, maxW, minH, maxH)
    local p = node.params
    return p.width or minW, p.height or minH
end

-- Пользовательская раскладка: params.measure(children, minW, maxW, minH, maxH, api)
POLICIES.layout = function(node, minW, maxW, minH, maxH)
    return node.params.measure(laid_children(node), minW, maxW, minH, maxH, L.api)
end

L.api = {
    measure = function(child, a, b, c, d)
        return measure(child, a or 0, b or INF, c or 0, d or INF)
    end,
    place = function(child, x, y)
        child.x, child.y = floor(x), floor(y)
    end,
    INF = INF,
}

-- Ленивый список: компонует только видимые элементы

POLICIES.lazy = function(node, minW, maxW, minH, maxH)
    local p = node.params
    local st = p.state
    local rt = ctx.rt
    local axis = p.axis or 2
    local spacing = p.spacing or 0
    local count = p.count or 0
    local pad_start, pad_end = p.pad_start or 0, p.pad_end or 0
    local view = axis == 2 and maxH or maxW
    if view == INF then
        view = 4096 -- список без ограничения высоты: разумный предел
    end
    -- версия состояния: прокрутка из ввода перезапускает раскладку
    local _ = st.version.value

    local cache = {}
    local function item(i)
        local it = cache[i]
        if it then
            return it
        end
        local key = p.key and p.key(i) or i
        local wrapper = rt:subcompose(p.owner, p.list_id .. ":" .. tostring(key), p.item, i)
        local w, h
        if axis == 2 then
            w, h = measure(wrapper, p.fill_cross and maxW < INF and maxW or 0, maxW, 0, INF)
        else
            w, h = measure(wrapper, 0, INF, p.fill_cross and maxH < INF and maxH or 0, maxH)
        end
        it = { node = wrapper, size = axis == 2 and h or w, cross = axis == 2 and w or h }
        cache[i] = it
        -- сумма и число известных размеров ведутся на ходу: обходить
        -- st.sizes на каждой раскладке - O(всех когда-либо виденных строк)
        local old = st.sizes[key]
        if old == nil then
            st.size_sum, st.size_n = st.size_sum + it.size, st.size_n + 1
        else
            st.size_sum = st.size_sum + it.size - old
        end
        st.sizes[key] = it.size
        return it
    end

    if count == 0 then
        node.children = {}
        rt:sweep_subcompositions(p.owner, p.list_id)
        st.first, st.offset = 1, 0
        st.pending = 0
        st:_set_total(0, view)
        return minW, minH
    end

    -- Пропущенные при прокрутке строки не входят в композицию. Для них
    -- используем измеренный размер или средний размер известных строк,
    -- как и при оценке длины полосы прокрутки.
    if st.size_n == 0 then
        item(coerce(st.request or st.first or 1, 1, count))
    end
    local avg = st.size_sum / st.size_n
    local function extent(i)
        local key = p.key and p.key(i) or i
        return (st.sizes[key] or avg) + spacing
    end

    -- запрошенная прокрутка к элементу
    if st.request then
        st.first = coerce(st.request, 1, count)
        st.offset = 0
        st.request = nil
    end
    local first = coerce(st.first or 1, 1, count)
    local offset = (st.offset or 0) + (st.pending or 0)
    st.pending = 0

    -- назад, пока смещение отрицательное
    while offset < 0 and first > 1 do
        first = first - 1
        offset = offset + extent(first)
    end
    if first == 1 and offset < -pad_start then
        offset = -pad_start
    end
    -- вперёд, пока первый элемент целиком выше окна
    while first < count and offset >= extent(first) do
        offset = offset - extent(first)
        first = first + 1
    end

    -- Оценка неизвестной строки может отличаться от её реального размера.
    -- Уточняем только границу окна, сохраняя пиксельное смещение.
    while first < count and offset >= item(first).size + spacing do
        offset = offset - item(first).size - spacing
        first = first + 1
    end

    local function fill()
        local visible = {}
        local pos = -offset + (first == 1 and pad_start or 0)
        local i = first
        while i <= count and pos < view do
            local it = item(i)
            visible[#visible + 1] = { it = it, pos = pos }
            pos = pos + it.size + spacing
            i = i + 1
        end
        return visible, pos - spacing, i > count
    end

    local visible, bottom, reached_end = fill()
    -- конец списка поднят выше низа окна: сдвигаем назад
    if reached_end and bottom + pad_end < view then
        local gap = view - bottom - pad_end
        offset = offset - gap
        while offset < 0 and first > 1 do
            first = first - 1
            offset = offset + item(first).size + spacing
        end
        if first == 1 and offset < -pad_start then
            offset = -pad_start
        end
        visible, bottom, reached_end = fill()
    end
    st.first, st.offset = first, offset

    -- элементы, ушедшие из окна, выходят из композиции
    rt:sweep_subcompositions(p.owner, p.list_id)

    local children = {}
    local cross = 0
    for _, v in ipairs(visible) do
        local n = v.it.node
        if axis == 2 then
            n.x, n.y = 0, floor(v.pos)
        else
            n.x, n.y = floor(v.pos), 0
        end
        if v.it.cross > cross then
            cross = v.it.cross
        end
        children[#children + 1] = n
    end
    node.children = children

    -- оценка полной длины для полосы прокрутки
    avg = st.size_n > 0 and st.size_sum / st.size_n or 1
    local total = avg * count + spacing * (count - 1) + pad_start + pad_end
    local before = 0
    for i = 1, first - 1 do
        local key = p.key and p.key(i) or i
        before = before + (st.sizes[key] or avg) + spacing
    end
    st:_set_total(total, view, before + offset)

    if axis == 2 then
        return max(minW, cross), view
    else
        return view, max(minH, cross)
    end
end

-- Проход раскладки

-- Собирает всплывающие слои из фрагментов дерева.
local function collect_overlays(node, out)
    if node.kind == "fragment" and node.overlays then
        for _, ov in ipairs(node.overlays) do
            out[#out + 1] = ov
            collect_overlays(ov.node, out)
        end
    end
    for _, c in ipairs(node.children) do
        collect_overlays(c, out)
    end
end

-- Раскладывает корень на весь вьюпорт. Чтение State во время измерения
-- подписывает измеряемый узел: изменение State помечает его устаревшим.
function L.run(rt, root, w, h)
    ctx.rt, ctx.m = rt, rt.measurer
    pass = pass + 1
    rt.layout_pass = pass
    local overlays = {}
    collect_overlays(root, overlays)
    -- порядок слоёв: по z (Popup{z}), при равных - по порядку объявления
    for i, ov in ipairs(overlays) do
        ov.order = i
    end
    table.sort(overlays, function(a, b)
        local za, zb = a.z or 0, b.z or 0
        if za ~= zb then
            return za < zb
        end
        return a.order < b.order
    end)
    rt.overlays = overlays
    -- rt:invalidate_layout() или новые метрики текста: размеры всех узлов
    -- недействительны, кэш получает новое поколение
    if rt._gen_seen ~= rt.layout_gen or rt._text_version ~= text.version then
        gen_counter = gen_counter + 1
        rt._gen_seen, rt._text_version, rt._gen = rt.layout_gen, text.version, gen_counter
    end
    ctx.gen = rt._gen
    runtime.set_layout_runtime(rt)
    local prev = runtime.swap_observer(nil)
    local ok, err = pcall(function()
        measure(root, w, w, h, h)
        root.x, root.y = 0, 0
        for _, ov in ipairs(rt.overlays) do
            measure(ov.node, 0, w, 0, h)
        end
    end)
    runtime.swap_observer(prev)
    runtime.set_layout_runtime(nil)
    if not ok then
        error(err, 0)
    end
    rt.need_layout = false
end

function L.context()
    return ctx
end

return L
