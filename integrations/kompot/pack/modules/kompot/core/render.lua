-- Отрисовка разложенного дерева в плоский список примитивов (display list)
-- и сбор областей ввода.
--
-- Примитив: {key, kind, x, y, w, h, clip, ...}. Координаты - относительно
-- области обрезки clip (ключ примитива "clip", "" - корень). Порядок в
-- списке - порядок наложения. Ключи стабильны между кадрами (путь в дереве),
-- поэтому бэкенд обновляет элементы, а не пересоздаёт.
--
-- Область ввода: {key, x, y, w, h, clip = {x0, y0, x1, y1}, mods...} в
-- абсолютных координатах, в порядке наложения (последняя - сверху).
--
-- Кэш: узел помнит, какой отрезок списков прошлого кадра дало его
-- поддерево. Если узел не перемерялся (раскладка снимает _rdirty только при
-- промахе своего кэша, а перекомпозиция потомка перемеряет всех предков) и
-- стоит на том же месте, с той же обрезкой, прозрачностью, путём и фокусом,
-- отрезок копируется теми же таблицами. Бэкенд пропускает такие примитивы
-- без сверки свойств.

local Corners = require "kompot:kompot/core/corners"
local color = require "kompot:kompot/core/color"
local L = require "kompot:kompot/core/layout"

local A = require "kompot:kompot/core/affine"
local Render = {}
local active_matrix, active_space

local floor, max, min = math.floor, math.max, math.min

local out, regions, rt_cur, placed, modal_boundary
-- Сколько раз поддерево поднимало modal_boundary: кэш узла запоминает,
-- поднимало ли его собственное поддерево.
local modal_sets = 0
-- Якоря всплывающих слоёв в порядке записи: {id, rect}.
local anchor_log
-- Списки прошлого кадра текущего рантайма и номер этого кадра.
local prev, render_pass
local focus_key, focus_visible

local function mul_alpha(c, a)
    if a >= 0.999 then
        return c
    end
    return { c[1], c[2], c[3], (c[4] or 1) * a }
end

local function push(p)
    if type(p.radius) == "table" and p.radius.kind then
        p.shape, p.radius = p.radius, nil
    end
    out[#out + 1] = p
end

local function region_for(key, x, y, w, h, clip)
    local r = { key = key, x = x, y = y, w = w, h = h, clip = clip,
        singular = active_matrix and not A.inverse(active_matrix),
        inverse = A.inverse(active_matrix), parent_inverse = active_space.inverse,
        parent_x = active_space.x, parent_y = active_space.y }
    regions[#regions + 1] = r
    return r
end

-- Сортировка детей по z-index (стабильная).
local function ordered(children)
    local need = false
    for _, c in ipairs(children) do
        if L.parent_data(c).z then
            need = true
            break
        end
    end
    if not need then
        return children
    end
    local arr = {}
    for i, c in ipairs(children) do
        arr[i] = { c = c, i = i, z = L.parent_data(c).z or 0 }
    end
    table.sort(arr, function(a, b)
        if a.z ~= b.z then
            return a.z < b.z
        end
        return a.i < b.i
    end)
    -- z-index меняет порядок рисования, но не идентичность узлов:
    -- исходный индекс остаётся частью ключа примитива и области ввода.
    local res, indices = {}, {}
    for i, e in ipairs(arr) do
        res[i], indices[e.c] = e.c, e.i
    end
    return res, indices
end

-- Geometry can split/merge adjacent input modifiers. Use the full membership
-- of each group, so a key can never be reassigned to another handler.
local input_types = {click=true, focus=true, hover=true, drag=true, drop=true,
    pointer=true, wheel=true, cursor=true, block=true}
local function input_groups(node, path, x, y)
    local groups, group = {}, nil
    local ordinal = 0
    for i, m in ipairs(node.mods) do
        local t, w, h = m.t, node.lw[i], node.lh[i]
        if t == "transform" then
            group = nil
        elseif t == "scroll" or input_types[t] then
            ordinal = ordinal + 1
            local id = tostring(ordinal) .. ":" .. t
            if t == "scroll" then
                groups[i] = {key=path .. "|r" .. id}
            else
                if not group or group.x ~= x or group.y ~= y or group.w ~= w or group.h ~= h then
                    group = {key=path .. "|r" .. id, x=x, y=y, w=w, h=h}
                else
                    group.key = group.key .. "," .. id
                end
                groups[i] = group
            end
        end
        x, y = x + node.lox[i], y + node.loy[i]
    end
    return groups
end

-- clip: {key, ox, oy, x0, y0, x1, y1} - ключ, начало координат и границы (абс.)
local visit

local function visit_fresh(node, x, y, clip, alpha, path)
    local layers = {}
    local lx, ly = x, y
    local mods = node.mods
    local region = nil
    local groups = input_groups(node, path, x, y)
    local function input_region(i, x, y, w, h, c)
        return region_for(groups[i].key, x, y, w, h, c)
    end
    for i = 1, #mods do
        local m = mods[i]
        local w, h = node.lw[i], node.lh[i]
        local t = m.t
        if t == "transform" then
            local rad = math.rad(m.angle)
            local a,b,c,d = math.cos(rad)*m.sx, math.sin(rad)*m.sx, -math.sin(rad)*m.sy, math.cos(rad)*m.sy
            local key = path .. "|layer" .. i
            local local_matrix = A.around(a,b,c,d,w*m.px,h*m.py)
            local world = A.around(a,b,c,d,lx+w*m.px,ly+h*m.py)
            layers[#layers+1] = {start=#out, clip=clip, matrix=active_matrix,
                p={kind="layer",key=key,clip=clip.key,x=lx-clip.ox,y=ly-clip.oy,
                    w=w,h=h,transform=local_matrix}}
            active_matrix = A.multiply(active_matrix,world)
            -- Сам слой не обрезает содержимое; clip() внутри задаёт явную обрезку.
            clip = {key=key,ox=lx,oy=ly,x0=clip.x0,y0=clip.y0,x1=clip.x1,y1=clip.y1,
                parent=clip, passthrough=true}
            region = nil
        elseif t == "bg" then
            if m.color and (m.color[4] or 1) > 0 then
                push({
                    key = path .. "|b" .. i,
                    kind = "rect",
                    clip = clip.key,
                    x = lx - clip.ox,
                    y = ly - clip.oy,
                    w = w,
                    h = h,
                    color = mul_alpha(m.color, alpha),
                    radius = Corners.resolve(m.radius, w, h),
                })
            end
        elseif t == "image_bg" then
            if (m.color[4] or 1) * alpha > 0 then
                push({
                    key = path .. "|ib" .. i,
                    kind = "nine_patch",
                    clip = clip.key,
                    x = lx - clip.ox,
                    y = ly - clip.oy,
                    w = w,
                    h = h,
                    paint = m.paint,
                    color = mul_alpha(m.color, alpha),
                })
            end
        elseif t == "border" then
            push({
                key = path .. "|o" .. i,
                kind = "border",
                clip = clip.key,
                x = lx - clip.ox,
                y = ly - clip.oy,
                w = w,
                h = h,
                width = m.width,
                color = mul_alpha(m.color, alpha),
                radius = Corners.resolve(m.radius, w, h),
            })
        elseif t == "shadow" then
            local b = m.blur
            push({
                key = path .. "|s" .. i,
                kind = "shadow",
                clip = clip.key,
                x = lx - clip.ox - b,
                y = ly - clip.oy - b + m.dy,
                w = w + b * 2,
                h = h + b * 2,
                blur = b,
                color = mul_alpha(m.color, alpha),
                radius = Corners.resolve(m.radius, w, h),
            })
        elseif t == "alpha" then
            alpha = alpha * m.a
        elseif t == "clip" or t == "scroll" then
            local radius = Corners.resolve(m.radius, w, h)
            if t == "clip" and Corners.any(radius) then
                local key = path .. "|mask" .. i
                layers[#layers+1] = {start=#out, clip=clip, matrix=active_matrix,
                    p={kind="layer",key=key,clip=clip.key,x=lx-clip.ox,y=ly-clip.oy,
                        w=w,h=h,transform=A.identity(),
                        mask_radius=not (type(radius)=="table" and radius.kind) and radius or nil,
                        mask_shape=type(radius)=="table" and radius.kind and radius or nil}}
                active_matrix = active_matrix or A.identity()
                clip = {key=key,ox=lx,oy=ly,x0=clip.x0,y0=clip.y0,x1=clip.x1,y1=clip.y1,
                    parent=clip,passthrough=true,rounded_mask=true}
            end
            local x0, y0 = max(clip.x0, lx), max(clip.y0, ly)
            local x1, y1 = min(clip.x1, lx + w), min(clip.y1, ly + h)
            local key = path .. "|c" .. i
            push({
                key = key,
                kind = "clip",
                clip = clip.key,
                x = lx - clip.ox,
                y = ly - clip.oy,
                w = w,
                h = h,
            })
            clip = { key = key, ox = lx, oy = ly, x0 = x0, y0 = y0, x1 = x1, y1 = y1,
                parent=clip, inverse=A.inverse(active_matrix), x=lx,y=ly,w=w,h=h, radius=radius }
            if t == "scroll" then
                local r = input_region(i, lx, ly, w, h, clip)
                r.scroll = m.state
                r.axis = m.axis
            end
        elseif
            t == "click"
            or t == "focus"
            or t == "hover"
            or t == "drag"
            or t == "drop"
            or t == "pointer"
            or t == "wheel"
            or t == "cursor"
            or t == "block"
        then
            -- модификаторы ввода подряд с тем же прямоугольником - одна область
            if not region or region.key ~= groups[i].key then
                region = input_region(i, lx, ly, w, h, clip)
            end
            if t == "click" then
                region.click = m
                region.focus_scope = m.focus_scope
                if m.focus_scope then
                    modal_boundary = #out
                    modal_sets = modal_sets + 1
                end
                region.cursor = region.cursor or (m.enabled and m.cursor or nil)
                if
                    m.focusable
                    and rt_cur.app.input.focus_visible
                    and rt_cur.app.input.focus_key == region.key
                then
                    push({
                        key = path .. "|focus" .. i,
                        kind = "border",
                        clip = clip.key,
                        x = lx - clip.ox,
                        y = ly - clip.oy,
                        w = w,
                        h = h,
                        width = 2,
                        radius = Corners.resolve(m.focus_radius or 2, w, h),
                        color = m.focus_color or { 0.4, 0.75, 1, 1 },
                    })
                end
            elseif t == "focus" then
                region.focus = m
                if
                    m.enabled
                    and rt_cur.app.input.focus_visible
                    and rt_cur.app.input.focus_key == region.key
                then
                    push({
                        key = path .. "|focus" .. i,
                        kind = "border",
                        clip = clip.key,
                        x = lx - clip.ox,
                        y = ly - clip.oy,
                        w = w,
                        h = h,
                        width = 2,
                        radius = Corners.resolve(m.focus_radius or 2, w, h),
                        color = m.focus_color or { 0.4, 0.75, 1, 1 },
                    })
                end
            elseif t == "hover" then
                region.hover = m.target
            elseif t == "drag" then
                if m.opts.button == "right" then
                    region.rdrag = m.opts
                else
                    region.drag = m.opts
                end
                region.cursor = region.cursor or m.cursor
            elseif t == "drop" then
                region.drop = m.opts
            elseif t == "pointer" then
                region.pointer = m.fn
            elseif t == "wheel" then
                region.wheel = m.fn
            elseif t == "cursor" then
                region.cursor = m.cursor
            elseif t == "block" then
                region.block = true
                push({
                    key = path .. "|input" .. i,
                    kind = "input",
                    clip = clip.key,
                    x = lx - clip.ox,
                    y = ly - clip.oy,
                    w = w,
                    h = h,
                })
            end
        elseif t == "on_size" or t == "on_placed" or t == "tag" then
            placed[#placed + 1] = { m = m, key = path .. "|p" .. i, owner = node.placement_owner,
                x = lx, y = ly, w = w, h = h }
        end
        lx = lx + node.lox[i]
        ly = ly + node.loy[i]
    end

    local kind = node.kind
    local p = node.params
    local cw, ch = node.cw or 0, node.ch or 0
    if kind == "text" then
        local lay = node.text_layout
        if lay and lay.rich then
            local align = p.align
            for li, line in ipairs(lay.lines) do
                local ox = 0
                if align == "center" then
                    ox = floor((cw - line.w) / 2)
                elseif align == "end" then
                    ox = cw - line.w
                end
                for ri, run in ipairs(line.runs) do
                    if run.text ~= "" then
                        push({
                            key = path .. "|t" .. li .. "_" .. ri,
                            kind = "text",
                            clip = clip.key,
                            x = lx - clip.ox + ox + run.x,
                            y = ly - clip.oy + (li - 1) * lay.lh,
                            w = run.w,
                            h = lay.lh,
                            text = run.text,
                            font = run.font,
                            color = mul_alpha(run.color or p.color or color.WHITE, alpha),
                        })
                    end
                end
            end
        elseif lay then
            local c = mul_alpha(p.color or color.WHITE, alpha)
            local align = p.align
            for li, line in ipairs(lay.lines) do
                if line ~= "" then
                    local ox = 0
                    if align == "center" then
                        ox = floor((cw - lay.widths[li]) / 2)
                    elseif align == "end" then
                        ox = cw - lay.widths[li]
                    end
                    push({
                        key = path .. "|t" .. li,
                        kind = "text",
                        clip = clip.key,
                        x = lx - clip.ox + ox,
                        y = ly - clip.oy + (li - 1) * lay.lh,
                        w = lay.widths[li],
                        h = lay.lh,
                        text = line,
                        font = p.font,
                        color = c,
                    })
                end
            end
        end
    elseif kind == "image" then
        local ix, iy, iw, ih = lx - clip.ox, ly - clip.oy, cw, ch
        local uv = p.region
        if p.fit and p.fit ~= "fill" and cw > 0 and ch > 0 then
            uv = uv or { 0, 0, 1, 1 }
            local sw = p.source_width * math.abs(uv[3] - uv[1])
            local sh = p.source_height * math.abs(uv[4] - uv[2])
            if sw > 0 and sh > 0 then
                local scale = p.fit == "contain" and math.min(cw / sw, ch / sh)
                    or math.max(cw / sw, ch / sh)
                if p.fit == "contain" then
                    iw, ih = floor(sw * scale + 0.5), floor(sh * scale + 0.5)
                    ix, iy = ix + floor((cw - iw) / 2), iy + floor((ch - ih) / 2)
                elseif sw / sh > cw / ch then
                    local f = cw / (sw * scale)
                    local mid = (uv[1] + uv[3]) / 2
                    uv = {
                        mid - (uv[3] - uv[1]) * f / 2,
                        uv[2],
                        mid + (uv[3] - uv[1]) * f / 2,
                        uv[4],
                    }
                else
                    local f = ch / (sh * scale)
                    local mid = (uv[2] + uv[4]) / 2
                    uv = {
                        uv[1],
                        mid - (uv[4] - uv[2]) * f / 2,
                        uv[3],
                        mid + (uv[4] - uv[2]) * f / 2,
                    }
                end
            end
        end
        push({
            key = path .. "|i",
            kind = "image",
            clip = clip.key,
            x = ix,
            y = iy,
            w = iw,
            h = ih,
            src = p.src,
            color = mul_alpha(p.color or color.WHITE, alpha),
            region = uv,
        })
    elseif kind == "field" then
        local field_clip = clip
        while field_clip do
            assert(not field_clip.rounded_mask, "native TextInput cannot be placed inside a shaped clip (rounded clip or cut clip); use rounded background/border around the field")
            field_clip = field_clip.parent
        end
        assert(not active_matrix,"native TextInput cannot be transformed")
        push({
            key = path .. "|f",
            kind = "field",
            clip = clip.key,
            x = lx - clip.ox,
            y = ly - clip.oy,
            w = cw,
            h = ch,
            font = p.font,
            text = p.text,
            hint = p.hint,
            color = mul_alpha(p.color or color.WHITE, alpha),
            on_change = p.on_change,
            on_submit = p.on_submit,
            pad = p.pad or 8,
            focus = p.focus,
            multiline = p.lines and p.lines > 1,
            lines = p.lines,
            on_focus = p.on_focus,
            on_defocus = p.on_defocus,
            syntax = p.syntax,
            line_numbers = p.line_numbers,
            editable = p.editable,
            wrap = p.wrap,
            line_height = node.field_line_height,
            presentation = p.presentation,
            presentation_alpha = alpha,
            editor_state = p.editor_state,
            editor_value = p.editor_value,
            on_selection_change = p.on_selection_change,
        })
    elseif kind == "canvas" then
        push({
            key = path .. "|v",
            kind = "canvas",
            clip = clip.key,
            x = lx - clip.ox,
            y = ly - clip.oy,
            w = cw,
            h = ch,
            draw = p.draw,
            version = p.version,
            color = mul_alpha(color.WHITE, alpha),
        })
    end

    local children = L.kids(node)
    if #children > 0 then
        local sorted, indices = ordered(children)
        for idx, c in ipairs(sorted) do
            if c.kind == "anchor" then
                -- якорь всплывающего слоя: область содержимого родителя
                local x0,y0,x1,y1=A.bounds(active_matrix,lx,ly,cw,ch)
                local rect = { x = x0, y = y0, w = x1-x0, h = y1-y0 }
                rt_cur.anchors[c.params.id] = rect
                anchor_log[#anchor_log + 1] = { c.params.id, rect }
            else
                local ckey = c.key ~= nil and ("k" .. tostring(c.key))
                    or tostring(indices and indices[c] or idx)
                visit(c, lx, ly, clip, alpha, path .. "/" .. ckey, active_matrix,
                    {x=lx,y=ly,inverse=A.inverse(active_matrix)})
            end
        end
    end
    for i=#layers,1,-1 do
        local layer=layers[i]
        local prims={}
        for j=layer.start+1,#out do
            local p=out[j]
            if p.clip==layer.p.key then p.clip="" end
            prims[#prims+1]=p
            out[j]=nil
        end
        -- Последовательные преобразования объединяются до растеризации:
        -- текст и изображение выбираются один раз, без потери промежуточных пикселей.
        if not layer.p.mask_radius and not layer.p.mask_shape and #prims==1 and prims[1].kind=="layer" and not prims[1].mask_radius and not prims[1].mask_shape and prims[1].clip=="" then
            local inner=prims[1]
            layer.p.transform=A.multiply(layer.p.transform,A.multiply({1,0,0,1,inner.x,inner.y},inner.transform))
            prims=inner.prims
        end
        layer.p.prims=prims
        out[#out+1]=layer.p
        active_matrix=layer.matrix
    end
end

local function append(dst, src, from, to)
    local n = #dst
    for i = from + 1, to do
        n = n + 1
        dst[n] = src[i]
    end
end

function visit(node, ax, ay, clip, alpha, path, matrix, space)
    local old_matrix, old_space = active_matrix, active_space
    active_matrix, active_space = matrix, space or {x=0,y=0,inverse=A.identity()}
    local x, y = ax + (node.x or 0), ay + (node.y or 0)
    local o0, r0, p0, a0 = #out, #regions, #placed, #anchor_log
    local rc = node._rc
    if
        rc
        and not matrix
        and not rc.in_layer
        and not node._rdirty
        and prev
        and rc.pass == prev.pass
        and rc.x == x
        and rc.y == y
        and rc.px == active_space.x
        and rc.py == active_space.y
        and rc.alpha == alpha
        and rc.path == path
        and rc.ck == clip.key
        and rc.cox == clip.ox
        and rc.coy == clip.oy
        and rc.cx0 == clip.x0
        and rc.cy0 == clip.y0
        and rc.cx1 == clip.x1
        and rc.cy1 == clip.y1
        and rc.fk == focus_key
        and rc.fv == focus_visible
    then
        append(out, prev.out, rc.o0, rc.o1)
        append(regions, prev.regions, rc.r0, rc.r1)
        append(placed, prev.placed, rc.p0, rc.p1)
        for i = rc.a0 + 1, rc.a1 do
            local a = prev.anchors[i]
            rt_cur.anchors[a[1]] = a[2]
            anchor_log[#anchor_log + 1] = a
        end
        if rc.mb then
            modal_boundary = o0 + rc.mb
            modal_sets = modal_sets + 1
        end
        rc.pass = render_pass
        rc.o0, rc.o1, rc.r0, rc.r1 = o0, #out, r0, #regions
        rc.p0, rc.p1, rc.a0, rc.a1 = p0, #placed, a0, #anchor_log
        active_matrix, active_space = old_matrix, old_space
        return
    end
    local sets = modal_sets
    visit_fresh(node, x, y, clip, alpha, path)
    local mb = modal_sets ~= sets and modal_boundary - o0 or nil
    node._rdirty = nil
    active_matrix, active_space = old_matrix, old_space
    if not rc then
        -- одним конструктором: таблица сразу нужного размера
        node._rc = {
            pass = render_pass,
            in_layer = matrix ~= nil,
            px = (space and space.x) or 0, py = (space and space.y) or 0,
            x = x,
            y = y,
            alpha = alpha,
            path = path,
            ck = clip.key,
            cox = clip.ox,
            coy = clip.oy,
            cx0 = clip.x0,
            cy0 = clip.y0,
            cx1 = clip.x1,
            cy1 = clip.y1,
            fk = focus_key,
            fv = focus_visible,
            mb = mb,
            o0 = o0,
            o1 = #out,
            r0 = r0,
            r1 = #regions,
            p0 = p0,
            p1 = #placed,
            a0 = a0,
            a1 = #anchor_log,
        }
        return
    end
    rc.in_layer = matrix ~= nil
    rc.px,rc.py=(space and space.x) or 0,(space and space.y) or 0
    rc.pass, rc.x, rc.y, rc.alpha, rc.path = render_pass, x, y, alpha, path
    rc.ck, rc.cox, rc.coy = clip.key, clip.ox, clip.oy
    rc.cx0, rc.cy0, rc.cx1, rc.cy1 = clip.x0, clip.y0, clip.x1, clip.y1
    rc.fk, rc.fv, rc.mb = focus_key, focus_visible, mb
    rc.o0, rc.o1, rc.r0, rc.r1 = o0, #out, r0, #regions
    rc.p0, rc.p1, rc.a0, rc.a1 = p0, #placed, a0, #anchor_log
end

-- Границы содержимого слоя, включая вложенные преобразования и переполнение.
function Render.bounds(prims)
    local inf=math.huge
    local clips={ [""]={ox=0,oy=0,x0=-inf,y0=-inf,x1=inf,y1=inf} }
    local x0,y0,x1,y1=inf,inf,-inf,-inf
    for _,p in ipairs(prims) do
        local c=clips[p.clip or ""] or clips[""]
        local x,y=c.ox+p.x,c.oy+p.y
        local a,b,e,f=x,y,x+p.w,y+p.h
        if p.kind=="layer" then
            local bx,by,bw,bh=Render.bounds(p.prims)
            a,b,e,f=A.bounds(p.transform,bx,by,bw,bh)
            a,b,e,f=a+x,b+y,e+x,f+y
        end
        a,b,e,f=math.max(a,c.x0),math.max(b,c.y0),math.min(e,c.x1),math.min(f,c.y1)
        if p.kind=="clip" then
            clips[p.key]={ox=x,oy=y,x0=a,y0=b,x1=e,y1=f}
        end
        if e>a and f>b then
            x0,y0,x1,y1=math.min(x0,a),math.min(y0,b),math.max(x1,e),math.max(y1,f)
        end
    end
    if x0==inf then return 0,0,1,1 end
    return math.floor(x0),math.floor(y0),math.max(1,math.ceil(x1)-math.floor(x0)),math.max(1,math.ceil(y1)-math.floor(y0))
end

-- Строит список примитивов и областей ввода. Возвращает dl, regions, placed.
function Render.run(rt, root)
    out, regions, placed, rt_cur = {}, {}, {}, rt
    modal_boundary = 0
    anchor_log = {}
    prev = rt._render_prev
    render_pass = (rt._render_pass or 0) + 1
    rt._render_pass = render_pass
    local input = rt.app and rt.app.input
    focus_key = input and input.focus_key
    focus_visible = input and input.focus_visible
    rt.anchors = {}
    local w, h = rt.width, rt.height
    local clip = { key = "", ox = 0, oy = 0, x0 = 0, y0 = 0, x1 = w, y1 = h }
    visit(root, 0, 0, clip, 1, "r")
    -- всплывающие слои поверх всего
    for oi, ov in ipairs(rt.overlays) do
        local node = ov.node
        local anchor = ov.anchor and rt.anchors[ov.anchor] or nil
        local px, py = ov.place(anchor, node.w, node.h, w, h)
        node.x, node.y = floor(px), floor(py)
        visit(node, 0, 0, clip, 1, "o" .. (ov.key or oi))
    end
    for i, p in ipairs(out) do
        if p.kind == "field" then
            p.input_blocked = i <= modal_boundary
        end
    end
    local dl, rg, pl = out, regions, placed
    -- App может дописать в dl примитивы ошибки: отрезки кэша их не задевают
    rt._render_prev =
        { pass = render_pass, out = dl, regions = rg, placed = pl, anchors = anchor_log }
    out, regions, placed, rt_cur, prev, anchor_log = nil, nil, nil, nil, nil, nil
    return dl, rg, pl
end

return Render
