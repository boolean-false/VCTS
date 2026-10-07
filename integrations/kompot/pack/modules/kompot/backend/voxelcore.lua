-- Бэкенд VoxelCore: отображает список примитивов Kompot на элементы GUI
-- движка, измеряет текст, читает мышь.
--
-- Устройство:
--   * хост - прозрачный container. Кадр Kompot вызывается из его интервала
--     (Container::act после обхода детей - там безопасно менять дерево).
--   * примитивы сверяются по ключам: у существующих элементов меняются
--     только изменившиеся свойства; неизменяемые (шрифт) - пересоздание.
--   * скругления, рамки и тени - текстуры, сгенерированные на Canvas
--     (одна на радиус), нарезанные на 9 частей и окрашенные цветом элемента.
--   * текст измеряется невидимыми label-линейками (autoresize): после первой
--     отрисовки шрифт закэширован, измерение синхронное.
--   * попадание мыши в хост вычисляется по его текущей геометрии: события
--     onmouseover/onmouseout могут устареть после изменения размера окна.
--     Все элементы Kompot неинтерактивны, кроме полей ввода и обрезок.

local Corners = require "kompot:kompot/core/corners"
local App = require "kompot:kompot/core/app"
local color = require "kompot:kompot/core/color"
local text = require "kompot:kompot/core/text"
local Th = require "kompot:kompot/theme"
local Presentation = require "kompot:kompot/ui/text_presentation"
local R = require "kompot:kompot/core/runtime"
local InventoryLock = require "kompot:kompot/backend/inventory_lock"

local RasterCanvas = require "kompot:kompot/core/canvas"
local Affine = require "kompot:kompot/core/affine"
local Render = require "kompot:kompot/core/render"
local LayerCache = require "kompot:kompot/backend/layer_cache"
local B = {}
local free_layer_frames, layer_frame_counter = {}, 0

local floor, max, min, sqrt, exp = math.floor, math.max, math.min, math.sqrt, math.exp

local mount_counter = 0

-- This observer belongs to the GUI root, not to any mount/document being
-- watched. Hidden layouts remain alive; only missing hosts are disposed.
local mounts, mount_watcher = {}, nil
local function watch_mount(handle, prefix)
    mounts[handle] = true
    if mount_watcher then return end
    local id = prefix .. "watcher"
    gui.root.root:add("<container id='" .. id .. "' size='0,0' color='#00000000' interactive='false'/>")
    mount_watcher = gui.root[id]
    mount_watcher:setInterval(50, function()
        for mounted in pairs(mounts) do
            if not mounted.host.exists then
                local ok, err = pcall(mounted.dispose, mounted)
                if not ok then print("[kompot] " .. tostring(err)) end
            end
        end
        if not next(mounts) then
            mount_watcher:destruct()
            mount_watcher = nil
        end
    end)
end


local function hex(c)
    return color.to_hex(c)
end

local function esc(s)
    return string.escape_xml and string.escape_xml(s)
        or (
            tostring(s)
                :gsub("&", "&amp;")
                :gsub("<", "&lt;")
                :gsub(">", "&gt;")
                :gsub("'", "&apos;")
                :gsub('"', "&quot;")
        )
end

-- Текстуры фигур (общие для всех хостов)

local Paint = require "kompot:kompot/core/paint"
local paint_cache = require("kompot:kompot/backend/paint_cache").new()
B._paint_cache = paint_cache
local textures = {}
local texture_counter = 0
-- Имена текстур удалённых холстов. Выгрузить текстуру из assets нельзя,
-- а create_texture с тем же именем заменяет её: имена переиспользуются.
local free_canvas_names = {}
local texture_epoch = 0
local probe_canvas, probe_name

-- Lua-модуль переживает app.reset_content(), а текстуры Canvas - нет.
-- Проверяем маленькую контрольную текстуру вместо копирования больших фигур.
local function current_texture_epoch()
    if not probe_name or not assets.to_canvas(probe_name) then
        texture_epoch = texture_epoch + 1
        textures = {}
        RasterCanvas.reset()
        free_layer_frames = {}
        free_canvas_names = {}
        paint_cache:reset(texture_epoch)
        probe_name = "kompot_probe_" .. texture_epoch
        probe_canvas = Canvas({ 1, 1 })
        probe_canvas:update()
        probe_canvas:create_texture(probe_name)
    end
    return texture_epoch
end

-- UV (region) текстур, созданных на Canvas, отсчитывается снизу: строка
-- холста y = 0 - это v = 0 (низ изображения). Регионы четвертинок ниже
-- заданы с учётом этого.
local Q_TL, Q_TR, Q_BL, Q_BR =
    { 0, 0.5, 0.5, 1 }, { 0.5, 0.5, 1, 1 }, { 0, 0, 0.5, 0.5 }, { 0.5, 0, 1, 0.5 }
-- регион, переворачивающий холст по вертикали (для пользовательских холстов)
local FLIP_V = { 0, 1, 1, 0 }

-- Заполняет холст w x h по функции покрытия f(px, py) -> 0..1.
-- y = 0 - верх фигуры (с учётом регионов выше фигуры симметричны).
local function make_texture(name, w, h, f)
    current_texture_epoch()
    name = name .. "_" .. texture_epoch
    if textures[name] then
        return name
    end
    local data = {}
    local i = 1
    for y = 0, h - 1 do
        for x = 0, w - 1 do
            local a = f(x + 0.5, y + 0.5)
            if a < 0 then
                a = 0
            elseif a > 1 then
                a = 1
            end
            data[i], data[i + 1], data[i + 2], data[i + 3] = 255, 255, 255, floor(a * 255 + 0.5)
            i = i + 4
        end
    end
    local canvas = Canvas({ w, h })
    canvas:set_data(data)
    canvas:update()
    canvas:create_texture(name)
    textures[name] = { canvas = canvas, w = w, h = h }
    return name
end

-- Круг диаметром 2r: четвертинки - углы скруглённого прямоугольника.
local function circle_texture(r)
    r = max(1, floor(r + 0.5))
    return make_texture("kompot_circle_" .. r, r * 2, r * 2, function(x, y)
        local d = sqrt((x - r) ^ 2 + (y - r) ^ 2)
        return r - d + 0.5
    end),
        r
end

-- Кольцо внешнего радиуса r и толщины w.
local function ring_texture(r, w)
    r = max(1, floor(r + 0.5))
    w = max(1, floor(w + 0.5))
    return make_texture("kompot_ring_" .. r .. "_" .. w, r * 2, r * 2, function(x, y)
        local d = sqrt((x - r) ^ 2 + (y - r) ^ 2)
        local outer = r - d + 0.5
        local inner = d - (r - w) + 0.5
        return min(outer, inner)
    end),
        r
end

-- Размытый скруглённый квадрат: тень. Квадрант - угол размера r + blur.
local function shadow_texture(r, blur)
    r = floor(r + 0.5)
    blur = max(1, floor(blur + 0.5))
    local c = r + blur
    local size = c * 2
    local base_name = "kompot_shadow_" .. r .. "_" .. blur
    current_texture_epoch()
    local name = base_name .. "_" .. texture_epoch
    if textures[name] then
        return name, c
    end
    -- исходная форма: скруглённый прямоугольник, отступивший на blur от краёв
    local src = {}
    for y = 0, size - 1 do
        for x = 0, size - 1 do
            local px, py = x + 0.5, y + 0.5
            local x0, y0, x1, y1 = blur + r, blur + r, size - blur - r, size - blur - r
            local dx = px < x0 and x0 - px or (px > x1 and px - x1 or 0)
            local dy = py < y0 and y0 - py or (py > y1 and py - y1 or 0)
            local d = sqrt(dx * dx + dy * dy)
            local a = r - d + 0.5
            if r == 0 then
                a = (px >= blur and px <= size - blur and py >= blur and py <= size - blur) and 1
                    or 0
            end
            src[y * size + x] = a < 0 and 0 or (a > 1 and 1 or a)
        end
    end
    -- гауссово размытие, разделимое
    local sigma = blur / 2
    local kernel, ksum = {}, 0
    for k = -blur, blur do
        local v = exp(-(k * k) / (2 * sigma * sigma))
        kernel[k] = v
        ksum = ksum + v
    end
    local tmp = {}
    for y = 0, size - 1 do
        for x = 0, size - 1 do
            local s = 0
            for k = -blur, blur do
                local xx = x + k
                if xx >= 0 and xx < size then
                    s = s + src[y * size + xx] * kernel[k]
                end
            end
            tmp[y * size + x] = s / ksum
        end
    end
    local out = {}
    for y = 0, size - 1 do
        for x = 0, size - 1 do
            local s = 0
            for k = -blur, blur do
                local yy = y + k
                if yy >= 0 and yy < size then
                    s = s + tmp[yy * size + x] * kernel[k]
                end
            end
            out[y * size + x] = s / ksum
        end
    end
    name = make_texture(base_name, size, size, function(x, y)
        return out[floor(y) * size + floor(x)]
    end)
    return name, c
end

B._circle_texture = circle_texture
B._shadow_texture = shadow_texture

-- Измеритель текста

local Measurer = {}
Measurer.__index = Measurer

function Measurer.new(backend)
    return setmetatable(
        {
            backend = backend,
            rulers = {},
            widths = {},
            width_n = {},
            heights = {},
            pending = false,
        },
        Measurer
    )
end

local approx = text.approx_measurer()

-- Предел кэша ширин на шрифт: динамический текст (счётчики, координаты) и
-- префиксы при переносе иначе копятся без конца.
local WIDTH_CACHE_LIMIT = 4000

function Measurer:_ruler(font, multiline)
    local key = font .. (multiline and "|field" or "")
    local r = self.rulers[key]
    if r then
        return r
    end
    local b = self.backend
    local id = b.prefix .. "ruler_" .. key:gsub("[^%w_]", "_")
    b.host:add(
        string.format(
            "<label id='%s' font='%s' multiline='%s' text-wrap='false' autoresize='true' color='#00000000' interactive='false' pos='-20000,-20000'>Ag</label>",
            id,
            font,
            tostring(multiline == true)
        )
    )
    r = { el = b.doc[id], ready = false, ready_after = (b.measure_epoch or 0) + 1 }
    self.rulers[key] = r
    return r
end

-- Готова ли линейка (шрифт закэширован после первой отрисовки).
function Measurer:_ready(r)
    if r.ready then
        return true
    end
    -- У нового label уже есть временный размер. Настоящие метрики появляются
    -- после первой отрисовки, поэтому временный размер не запоминаем.
    if (self.backend.measure_epoch or 0) < r.ready_after then
        return false
    end
    local ok, size = pcall(function()
        return r.el.size
    end)
    if ok and size and size[1] > 0 then
        r.ready = true
        return true
    end
    return false
end

function Measurer:width(font, s)
    if s == "" then
        return 0
    end
    local cache = self.widths[font]
    if not cache then
        cache = {}
        self.widths[font] = cache
    end
    local w = cache[s]
    if w then
        return w
    end
    local r = self:_ruler(font)
    if not self:_ready(r) then
        self.pending = true
        return approx:width(font, s)
    end
    -- Label ограничивает размер снизу одним пикселем. Обрамление
    -- сохраняет настоящий нулевой шаг комбинируемых символов.
    if not r.sentinel_width then
        r.el.text = "||"
        r.sentinel_width = r.el.size[1]
    end
    r.el.text = "|" .. s .. "|"
    w = max(0, r.el.size[1] - r.sentinel_width)
    local n = (self.width_n[font] or 0) + 1
    if n > WIDTH_CACHE_LIMIT then
        cache, n = {}, 1
        self.widths[font] = cache
    end
    self.width_n[font] = n
    cache[s] = w
    return w
end

function Measurer:line_height(font)
    local h = self.heights[font]
    if h then
        return h
    end
    local r = self:_ruler(font)
    if not self:_ready(r) then
        self.pending = true
        return approx:line_height(font)
    end
    r.el.text = "Ag"
    h = r.el.size[2]
    self.heights[font] = h
    return h
end

function Measurer:warm(fonts)
    for _, f in ipairs(fonts) do
        self:_ruler(f)
    end
end

-- Разность высот многострочных label исключает yoffset шрифта и даёт
-- именно шаг строки textbox (с тем же нативным lineInterval).
function Measurer:field_line_height(font)
    local r = self:_ruler(font, true)
    if r.field_height then
        return r.field_height
    end
    if not self:_ready(r) then
        self.pending = true
        return text.field_line_height(approx, font)
    end
    r.el.text = "Ag\nAg"
    local two = r.el.size[2]
    r.el.text = "Ag\nAg\nAg"
    r.field_height = r.el.size[2] - two
    return r.field_height
end

-- Бэкенд

local Backend = {}
Backend.__index = Backend

-- Создание элемента: add(xml, data) в контейнер, доступ через документ по id.
function Backend:_add(container_el, xml, data)
    if data then
        container_el:add(xml, data)
    else
        container_el:add(xml)
    end
end

function Backend:_new_id()
    self.counter = self.counter + 1
    return self.prefix .. self.counter
end

-- Создаёт простой элемент, возвращает {id, el}.
function Backend:_create(container, tag, attrs, inner, data)
    local id = self:_new_id()
    local xml = "<" .. tag .. " id='" .. id .. "' " .. attrs
    if inner then
        xml = xml .. ">" .. inner .. "</" .. tag .. ">"
    else
        xml = xml .. "/>"
    end
    self:_add(container.el, xml, data)
    return { id = id, el = self.doc[id] }
end

local function pos_attr(x, y, w, h)
    return string.format(
        "pos='%d,%d' size='%d,%d'",
        floor(x),
        floor(y),
        max(0, floor(w)),
        max(0, floor(h))
    )
end

-- Части составных примитивов: список {x, y, w, h, kind ("rect"|"image"), src, region}
local function rounded_parts(p)
    local r = p.radius or 0
    -- Округляем весь прямоугольник до разбиения
    local x, y, w, h = floor(p.x), floor(p.y), max(0, floor(p.w)), max(0, floor(p.h))
    r = min(floor(r + 0.5), floor(w / 2), floor(h / 2))
    if r < 0.5 then
        return { { x, y, w, h, "rect" } }
    end
    r = min(r, w / 2, h / 2)
    local tex, tr = circle_texture(r)
    local rr = floor(r + 0.5)
    return {
        { x, y, rr, rr, "image", tex, Q_TL },
        { x + w - rr, y, rr, rr, "image", tex, Q_TR },
        { x, y + h - rr, rr, rr, "image", tex, Q_BL },
        { x + w - rr, y + h - rr, rr, rr, "image", tex, Q_BR },
        { x + rr, y, w - 2 * rr, rr, "rect" },
        { x, y + rr, w, h - 2 * rr, "rect" },
        { x + rr, y + h - rr, w - 2 * rr, rr, "rect" },
    }
end

local function border_parts(p)
    local r = p.radius or 0
    local bw = max(0, floor((p.width or 1) + 0.5))
    if bw == 0 then return {} end
    local x, y, w, h = floor(p.x), floor(p.y), max(0, floor(p.w)), max(0, floor(p.h))
    r = min(floor(r + 0.5), floor(w / 2), floor(h / 2))
    if r < 0.5 then
        return {
            { x, y, w, bw, "rect" },
            { x, y + h - bw, w, bw, "rect" },
            { x, y + bw, bw, h - 2 * bw, "rect" },
            { x + w - bw, y + bw, bw, h - 2 * bw, "rect" },
        }
    end
    r = min(r, w / 2, h / 2)
    local tex = ring_texture(r, bw)
    local rr = floor(r + 0.5)
    return {
        { x, y, rr, rr, "image", tex, Q_TL },
        { x + w - rr, y, rr, rr, "image", tex, Q_TR },
        { x, y + h - rr, rr, rr, "image", tex, Q_BL },
        { x + w - rr, y + h - rr, rr, rr, "image", tex, Q_BR },
        { x + rr, y, w - 2 * rr, bw, "rect" },
        { x + rr, y + h - bw, w - 2 * rr, bw, "rect" },
        { x, y + rr, bw, h - 2 * rr, "rect" },
        { x + w - bw, y + rr, bw, h - 2 * rr, "rect" },
    }
end

local function shadow_parts(p)
    local tex, c = shadow_texture(p.radius or 0, p.blur or 8)
    local x, y, w, h = p.x, p.y, p.w, p.h
    local cw, ch = min(c, floor(w / 2)), min(c, floor(h / 2))
    -- средние полоски текстуры (две центральные колонки/строки одинаковы)
    local size = c * 2
    local m0, m1 = (c - 1) / size, (c + 1) / size
    return {
        { x, y, cw, ch, "image", tex, Q_TL },
        { x + w - cw, y, cw, ch, "image", tex, Q_TR },
        { x, y + h - ch, cw, ch, "image", tex, Q_BL },
        { x + w - cw, y + h - ch, cw, ch, "image", tex, Q_BR },
        { x + cw, y, w - 2 * cw, ch, "image", tex, { m0, 0.5, m1, 1 } },
        { x + cw, y + h - ch, w - 2 * cw, ch, "image", tex, { m0, 0, m1, 0.5 } },
        { x, y + ch, cw, h - 2 * ch, "image", tex, { 0, m0, 0.5, m1 } },
        { x + w - cw, y + ch, cw, h - 2 * ch, "image", tex, { 0.5, m0, 1, m1 } },
        { x + cw, y + ch, w - 2 * cw, h - 2 * ch, "image", tex, { m0, m0, m1, m1 } },
    }
end

-- Сигнатура неизменяемых свойств: при смене - пересоздание.
local function signature(p)
    local k = p.kind
    if (p.shape or type(p.radius) == "table") and (k == "rect" or k == "border" or k == "shadow") then return k .. "_corners" end
    if k == "text" then
        return "t" .. p.font
    elseif k == "field" then
        return "f"
            .. tostring(p.font)
            .. (p.multiline and "m" or "")
            .. (p.wrap and "w" or "")
            .. ":"
            .. tostring(p.pad or 8)
    elseif k == "rect" then
        return "r" .. ((p.radius or 0) >= 0.5 and "r" or "")
    elseif k == "border" then
        return "b" .. ((p.radius or 0) >= 0.5 and "r" or "")
    end
    return k
end

-- Обновляет свойство, только если оно изменилось.
local function set_prop(entry, el, name, value, cache_key)
    cache_key = cache_key or name
    local old = entry.cache[cache_key]
    if type(value) == "table" then
        if old and #old == #value then
            local same = true
            for i = 1, #value do
                if old[i] ~= value[i] then
                    same = false
                    break
                end
            end
            if same then
                return
            end
        end
    elseif old == value then
        return
    end
    entry.cache[cache_key] = value
    el[name] = value
end

-- Создаёт или обновляет части составного примитива. Части нулевого
-- размера отбрасываются: движок рисует их как линию в 1 px.
function Backend:_apply_parts(entry, container, parts, rgba)
    local kept = {}
    for _, part in ipairs(parts) do
        if part[3] >= 0.5 and part[4] >= 0.5 then
            kept[#kept + 1] = part
        end
    end
    parts = kept
    entry.parts = entry.parts or {}
    local list = entry.parts
    for i, part in ipairs(parts) do
        local x, y, w, h, kind, src, region =
            part[1], part[2], part[3], part[4], part[5], part[6], part[7]
        local e = list[i]
        if e and e.kind ~= kind then
            e.el:destruct()
            e = nil
        end
        if not e then
            local attrs
            if kind == "rect" then
                attrs = pos_attr(x, y, w, h) .. " color='" .. hex(rgba.c) .. "' interactive='false'"
                e = self:_create(container, "container", attrs)
            else
                attrs = pos_attr(x, y, w, h)
                    .. string.format(
                        " src='%s' region='%g,%g,%g,%g' color='%s' interactive='false'",
                        src,
                        region[1],
                        region[2],
                        region[3],
                        region[4],
                        hex(rgba.c)
                    )
                e = self:_create(container, "image", attrs)
            end
            e.kind = kind
            e.cache = {
                pos = { floor(x), floor(y) },
                size = { max(0, floor(w)), max(0, floor(h)) },
                color = rgba.c255,
                src = src,
            }
            list[i] = e
            self.order_dirty[container.key] = true
        else
            set_prop(e, e.el, "pos", { floor(x), floor(y) })
            set_prop(e, e.el, "size", { max(0, floor(w)), max(0, floor(h)) })
            set_prop(e, e.el, "color", rgba.c255)
            if kind == "image" then
                set_prop(e, e.el, "src", src)
                set_prop(e, e.el, "region", region)
            end
        end
    end
    for i = #parts + 1, #list do
        list[i].el:destruct()
        list[i] = nil
    end
end

function Backend:supports_text_presentation()
    if self.text_presentation_supported == nil then
        local probe = self:_create({ el = self.host }, "textbox", "visible='false' size='1,1'")
        local ok, value = pcall(function()
            return probe.el.externalRendering
        end)
        probe.el:destruct()
        self.text_presentation_supported = ok and type(value) == "boolean"
    end
    return self.text_presentation_supported
end

function Backend:_destroy(entry)
    if entry.layer_backend then
        entry.layer_backend:dispose()
        entry.layer_white_backend:dispose()
        entry.layer_frame.white_host.size={1,1}
        entry.layer_frame.white_host.visible=false
        entry.layer_frame.host.size={1,1}
        entry.layer_frame.host.visible=false
        if entry.layer_epoch==texture_epoch then free_layer_frames[#free_layer_frames+1]=entry.layer_frame end
        entry.layer_backend=nil
    end
    paint_cache:release(entry.patch_resource)
    entry.patch_resource = nil
    if entry.is_field and entry.el and entry.el.focused then
        -- Удаление узла не снимает GUI-фокус в VoxelCore. Передаём его
        -- хосту, чтобы вызвать on_defocus и не оставить ввод в снятом поле.
        if not self.host.focused then
            self.host.focused = true
        end
    end
    if entry.parts then
        for _, e in ipairs(entry.parts) do
            e.el:destruct()
        end
    end
    if entry.el then
        entry.el:destruct()
    end
    if entry.paint then
        entry.paint.el:destruct()
    end
    if entry.canvas_name and entry.canvas_epoch == texture_epoch then
        free_canvas_names[#free_canvas_names + 1] = entry.canvas_name
    end
end

function Backend:_apply_patch(entry, container, p, rgba)
    local key = Paint.key(p.paint)
    local r = entry.patch_resource
    if not r or r.key ~= key or paint_cache.lookup[key] ~= r then
        paint_cache:release(r)
        entry.patch_resource = nil
        r = paint_cache:acquire(p.paint)
        entry.patch_resource = r
    end
    local parts = {}
    for _, q in ipairs(Paint.parts(p.paint, p.x, p.y, p.w, p.h)) do
        local rx = q.repeat_x and q.w / (q.sw * q.scale) or 1
        local ry = q.repeat_y and q.h / (q.sh * q.scale) or 1
        parts[#parts + 1] = {
            q.x,
            q.y,
            q.w,
            q.h,
            "image",
            r.cells[q.index].name,
            -- Image переворачивает UV по Y при отрисовке. Верх плитки
            -- должен начинаться с 0 (Canvas) или 1 (PNG), независимо от
            -- дробной длины повтора, иначе узор привязывается к низу.
            r.flip and { 0, ry, rx, 0 } or { 0, 1 - ry, rx, 1 },
        }
    end
    self:_apply_parts(entry, container, parts, rgba)
end

-- Применяет список примитивов.
function Backend:apply(dl)
    LayerCache.reconcile(self, dl)
    local seen = {}
    local containers = self.containers
    local new_order = {}

    for _, p in ipairs(dl) do
        local ckey = p.clip or ""
        local container = containers[ckey]
        if not container then
            -- контейнер ещё не создан (обрезка удалена) - пропускаем
            goto continue
        end
        seen[p.key] = true
        local order = new_order[ckey]
        if not order then
            order = {}
            new_order[ckey] = order
        end
        order[#order + 1] = p.key

        local entry = self.entries[p.key]
        -- тот же примитив, что в прошлом кадре (кэш render.lua): свойства
        -- не менялись. У полей между кадрами меняется input_blocked, холсты
        -- пересоздаются после сброса текстур.
        if
            entry
            and entry.prim == p
            and entry.container == container
            and p.kind ~= "field"
            and p.kind ~= "canvas"
        then
            goto continue
        end
        local sig = signature(p)
        if entry and (entry.sig ~= sig or entry.container ~= container) then
            self:_destroy(entry)
            if entry.is_clip then
                containers[p.key] = nil
            end
            entry = nil
        end
        local kind = p.kind
        local c = p.color and p.color or color.WHITE
        local rgba = { c = c, c255 = color.to255(c) }
        if not entry then
            entry = { sig = sig, container = container, cache = {} }
            self.entries[p.key] = entry
            self.order_dirty[ckey] = true
            if kind == "input" then
                entry.is_input = true
                entry.el = self:_create(
                    container,
                    "container",
                    pos_attr(p.x, p.y, p.w, p.h) .. " color='#00000000' interactive='true'"
                ).el
                set_prop(entry, entry.el, "cursor", self.cursor or "arrow")
            elseif kind == "clip" then
                local e = self:_create(
                    container,
                    "container",
                    pos_attr(p.x, p.y, p.w, p.h) .. " color='#00000000' interactive='true'"
                )
                entry.el = e.el
                entry.is_clip = true
                entry.cache.pos = { floor(p.x), floor(p.y) }
                entry.cache.size = { floor(p.w), floor(p.h) }
                containers[p.key] = { key = p.key, el = e.el }
            elseif kind == "text" then
                local e = self:_create(
                    container,
                    "label",
                    pos_attr(p.x, p.y, p.w + 2, p.h)
                        .. string.format(
                            " font='%s' color='%s' interactive='false'",
                            p.font,
                            hex(c)
                        ),
                    esc(p.text)
                )
                entry.el = e.el
                entry.cache.pos = { floor(p.x), floor(p.y) }
                entry.cache.size = { max(0, floor(p.w + 2)), max(0, floor(p.h)) }
                entry.cache.text = p.text
                entry.cache.color = rgba.c255
            elseif kind == "image" then
                local attrs = pos_attr(p.x, p.y, p.w, p.h)
                    .. string.format(" src='%s' color='%s' interactive='false'", p.src, hex(c))
                if p.region then
                    attrs = attrs
                        .. string.format(
                            " region='%g,%g,%g,%g'",
                            p.region[1],
                            p.region[2],
                            p.region[3],
                            p.region[4]
                        )
                end
                local e = self:_create(container, "image", attrs)
                entry.el = e.el
                entry.cache.pos = { floor(p.x), floor(p.y) }
                entry.cache.size = { floor(p.w), floor(p.h) }
                entry.cache.src = p.src
                entry.cache.color = rgba.c255
            elseif kind == "field" then
                entry.is_field = true
                entry.handlers = {}
                local data = {
                    change = function(s)
                        entry.last_text = s
                        if entry.handlers.on_change then
                            entry.handlers.on_change(
                                s,
                                entry.extended and entry.el.selection or nil
                            )
                        end
                    end,
                    submit = function(s)
                        if entry.handlers.on_submit then
                            entry.handlers.on_submit(s)
                        end
                    end,
                    focus = function()
                        if entry.handlers.on_focus then
                            entry.handlers.on_focus()
                        end
                    end,
                    defocus = function()
                        if entry.handlers.on_defocus then
                            entry.handlers.on_defocus()
                        end
                    end,
                }
                -- Фон и рамку рисует Kompot. У textbox отдельные цвета
                -- наведения и фокуса; по умолчанию фокус даёт чёрную заливку.
                local attrs = pos_attr(p.x, p.y, p.w, p.h)
                    .. string.format(
                        " color='#00000000' hover-color='#00000000' focused-color='#00000000'"
                            .. " text-color='%s' interactive='true' padding='%d' sub-consumer='DATA.change' consumer='DATA.submit'"
                            .. " onfocus='DATA.focus()' ondefocus='DATA.defocus()'",
                        hex(c),
                        p.pad or 8
                    )
                if p.font and p.font ~= "normal" then
                    attrs = attrs .. " font='" .. p.font .. "'"
                end
                if p.hint then
                    attrs = attrs .. " hint='" .. esc(p.hint) .. "'"
                end
                if p.multiline then
                    -- VoxelCore оставляет шаг колеса нулевым, если каретка
                    -- обновилась до загрузки шрифта. Задаём шаг сразу.
                    attrs = attrs
                        .. " scroll-step='"
                        .. max(1, floor((p.line_height or 24) + 0.5))
                        .. "'"
                    attrs = attrs
                        .. " multiline='true' text-wrap='"
                        .. tostring(p.wrap == true)
                        .. "'"
                    if p.syntax then
                        attrs = attrs .. " syntax='" .. p.syntax .. "'"
                    end
                end
                if p.line_numbers then
                    attrs = attrs .. " line-numbers='true'"
                end
                -- XML обрезает пробелы по краям. Текст задаётся свойством
                -- в первом apply, чтобы сохранить отступы и пустые строки.
                local e = self:_create(container, "textbox", attrs, "", data)
                entry.el = e.el
                entry.last_text = nil
                entry.cache.pos = { floor(p.x), floor(p.y) }
                -- XML textbox прибавляет padding к size. Первый apply обязан
                -- установить точный размер раскладки, а не доверять XML.
                entry.cache.size = nil
            elseif kind == "canvas" or kind == "layer" then
                entry.cache = {}
            end
        end

        -- обновление
        if kind == "clip" or kind == "input" then
            set_prop(entry, entry.el, "pos", { floor(p.x), floor(p.y) })
            set_prop(entry, entry.el, "size", { max(0, floor(p.w)), max(0, floor(p.h)) })
        elseif kind == "nine_patch" then
            self:_apply_patch(entry, container, p, rgba)
        elseif (p.shape or type(p.radius) == "table") and (kind == "rect" or kind == "border" or kind == "shadow") then
            self:_apply_corner_shape(entry, container, p)
        elseif kind == "rect" then
            self:_apply_parts(entry, container, rounded_parts(p), rgba)
        elseif kind == "border" then
            self:_apply_parts(entry, container, border_parts(p), rgba)
        elseif kind == "shadow" then
            self:_apply_parts(entry, container, shadow_parts(p), rgba)
        elseif kind == "text" then
            local el = entry.el
            set_prop(entry, el, "pos", { floor(p.x), floor(p.y) })
            set_prop(entry, el, "size", { max(0, floor(p.w + 2)), max(0, floor(p.h)) })
            set_prop(entry, el, "text", p.text)
            set_prop(entry, el, "color", rgba.c255)
        elseif kind == "image" then
            local el = entry.el
            set_prop(entry, el, "pos", { floor(p.x), floor(p.y) })
            set_prop(entry, el, "size", { max(0, floor(p.w)), max(0, floor(p.h)) })
            set_prop(entry, el, "src", p.src)
            set_prop(entry, el, "color", rgba.c255)
            set_prop(entry, el, "region", p.region or { 0, 0, 1, 1 })
        elseif kind == "field" then
            local el = entry.el
            entry.field_props, entry.field_container = p, container
            if p.input_blocked and el.focused and not self.host.focused then
                self.host.focused = true
            end
            set_prop(entry, el, "interactive", not p.input_blocked)
            set_prop(entry, el, "enabled", not p.input_blocked)
            if p.presentation or p.editor_state then
                if entry.extended == nil then
                    local ok, supported = pcall(function()
                        return el.externalRendering
                    end)
                    entry.extended = ok and type(supported) == "boolean"
                end
                assert(
                    entry.extended,
                    "Text presentation/editor_state requires VoxelCore textbox presentation API"
                )
            end
            if entry.extended then
                set_prop(entry, el, "externalRendering", p.presentation ~= nil)
            end
            set_prop(entry, el, "editable", p.editable ~= false)
            set_prop(entry, el, "hint", p.hint or "")
            set_prop(entry, el, "syntax", p.syntax or "")
            set_prop(entry, el, "lineNumbers", p.line_numbers == true)
            entry.handlers.on_change = p.on_change
            entry.handlers.on_submit = p.on_submit
            entry.handlers.on_focus = p.on_focus
            entry.handlers.on_defocus = p.on_defocus
            set_prop(entry, el, "pos", { floor(p.x), floor(p.y) })
            set_prop(entry, el, "size", { max(0, floor(p.w)), max(0, floor(p.h)) })
            -- атрибут text-color в XML не применяется: цвет - свойством
            set_prop(entry, el, "textColor", rgba.c255)
            -- управляемое поле: пишем только внешние изменения текста
            if p.text ~= entry.last_text then
                entry.last_text = p.text
                el.text = p.text or ""
                -- setText не нормализует прежнее выделение/курсор.
                -- Программная замена сбрасывает выделение и ограничивает курсор.
                el.caret = el.caret
            end
            if p.editor_state and p.editor_value ~= entry.editor_applied then
                el.selection = { p.editor_value.anchor, p.editor_value.caret }
                entry.editor_applied = p.editor_value
            end
            if not p.editor_state then
                entry.editor_applied = nil
            end
            if not p.presentation and entry.paint then
                entry.paint.el:destruct()
                entry.paint = nil
            end
            if p.focus and not p.input_blocked and not entry.focused_once then
                entry.focused_once = true
                el.focused = true
            end
        elseif kind == "layer" then
            self:_apply_layer(entry, container, p)
        elseif kind == "canvas" then
            self:_apply_canvas(entry, container, p)
        end
        entry.prim = p
        ::continue::
    end

    -- удаление ушедших
    for key, entry in pairs(self.entries) do
        if not seen[key] then
            self:_destroy(entry)
            self.entries[key] = nil
            if entry.is_clip then
                containers[key] = nil
            end
        end
    end

    -- порядок наложения внутри контейнеров
    for ckey, order in pairs(new_order) do
        local old = self.orders[ckey]
        local changed = self.order_dirty[ckey] or not old or #old ~= #order
        if not changed then
            for i = 1, #order do
                if old[i] ~= order[i] then
                    changed = true
                    break
                end
            end
        end
        if changed then
            local container = containers[ckey]
            for i, key in ipairs(order) do
                local entry = self.entries[key]
                if entry then
                    local z = i * 2
                    entry.z = z
                    if entry.parts then
                        for _, part in ipairs(entry.parts) do
                            set_prop(part, part.el, "zIndex", z)
                        end
                    end
                    if entry.el then
                        set_prop(entry, entry.el, "zIndex", z)
                    end
                    if entry.paint then
                        set_prop(entry.paint, entry.paint.el, "zIndex", z + 1)
                    end
                end
            end
            if container and container.el then
                pcall(function()
                    container.el:refresh()
                end)
            end
        end
        self.orders[ckey] = order
    end
    self.order_dirty = {}
end

-- VoxelCore сохраняет кадры в GUI. Пул ограничен пиковым числом слоёв;
-- освобождённые кадры очищены, скрыты и уменьшены до 1x1.
local function layer_frame(w,h)
    local f=table.remove(free_layer_frames)
    if not f then
        layer_frame_counter=layer_frame_counter+1
        local id="kompot_layer_frame_"..layer_frame_counter
        local host,doc=gui.create_frame(id,id.."_texture",{w,h})
        local white_host,white_doc=gui.create_frame(id.."_white",id.."_white_texture",{w,h})
        -- При resize framebuffer VoxelCore сбрасывает GL texture binding,
        -- но Batch2D сохраняет свой кэш. Одноцветный фон может нарисоваться
        -- без blank texture и испортить пару снимков для восстановления alpha.
        -- Image принудительно привязывает текстуру перед заливкой подложки.
        local matte=make_texture("kompot_layer_matte",1,1,function() return 1 end)
        local attrs=" src='"..matte.."' pos='0,0' size='1,1' interactive='false' z-index='-1'"
        host:add("<image id='matte'"..attrs.." color='#000000'/>")
        white_host:add("<image id='matte'"..attrs.." color='#FFFFFF'/>")
        f={id=id,host=host,doc=doc,white_host=white_host,white_doc=white_doc,
            matte=doc.matte,white_matte=white_doc.matte}
    end
    f.host.size={w,h}
    f.host.visible=true
    f.host.color={0,0,0,0}
    f.host.interactive=false
    f.white_host.size={w,h}
    f.white_host.visible=true
    f.white_host.color={0,0,0,0}
    f.white_host.interactive=false
    f.matte.size={w,h}
    f.white_matte.size={w,h}
    -- destruct() is deferred by VoxelCore. A new lease must not register
    -- the same IDs while nodes from the previous lease are still alive.
    f.generation=(f.generation or 0)+1
    return f
end
local function same_source(a,b)
    if not a or #a~=#b then return false end
    for i,p in ipairs(a) do
        local q=b[i]
        for k,v in pairs(p) do
            if k=="prims" then
                if not same_source(v,q[k]) then return false end
            elseif k=="draw" and p.version~=nil then
                -- version является контрактом перерисовки Canvas.
            elseif type(v)=="table" then
                if not R.shallow_equal(v,q[k]) then return false end
            elseif v~=q[k] then return false end
        end
        for k in pairs(q) do if p[k]==nil then return false end end
    end
    return true
end
-- Положение самого слоя не меняет его текстуру. Версия зависит только от
-- источника и преобразования внутри холста; копируем числа, а не ссылки
-- на изменяемые таблицы цвета/UV/матрицы.
local function raster_version(entry,source,w,h,m,opts,top)
    opts=opts or {}
    local c,uv=opts.color or color.WHITE,opts.region or {0,0,1,1}
    local signature={source,w,h,top==true,m[1],m[2],m[3],m[4],m[5],m[6],
        c[1],c[2],c[3],c[4] or 1,uv[1],uv[2],uv[3],uv[4],
        opts.mask_w or 0,opts.mask_h or 0,
        type(opts.mask_radius)=="table" and opts.mask_radius.kind or "rounded",
        (table.unpack or unpack)(Corners.values(opts.mask_radius))}
    if not R.shallow_equal(entry.raster_signature,signature) then
        entry.raster_signature=signature
    end
    return entry.raster_signature
end
function Backend:_apply_corner_shape(entry,container,p)
    local shape=p.shape or p.radius
    local version={p.w,p.h,p.kind,p.width or 0,p.blur or 0,shape.kind or "rounded",(table.unpack or unpack)(Corners.values(shape))}
    if not R.shallow_equal(entry.shape_version,version) then entry.shape_version=version end
    self:_apply_canvas(entry,container,{x=p.x,y=p.y,w=p.w,h=p.h,color=p.color,
        version=entry.shape_version,draw=function(cv,w,h)
            if p.w<=0 or p.h<=0 then return end
            cv.raw:set_data(Corners.pixels(w,h,shape,p.kind=="border" and p.width or nil,
                p.kind=="shadow" and p.blur or nil))
        end})
end

local function mask_layer(cv,w,h,p,x0,y0)
    if not (p.mask_shape or p.mask_radius) then return end
    local buffer=cv:get_data()
    local data=buffer.bytes
    local r=Corners.values(p.mask_shape or p.mask_radius)
    for y=0,h-1 do for x=0,w-1 do
        local a=max(0,min(1,Corners.distance(x+x0+0.5,y+y0+0.5,p.w,p.h,r)+0.5))
        local i=(y*w+x)*4+3
        data[i]=floor(data[i]*a+0.5)
    end end
    cv:set_data(buffer)
end

function Backend:_apply_layer(entry,container,p)
    -- Один PNG не требует промежуточного GUI-кадра. Это основной путь
    -- для вращающихся голов, иконок и других отдельных изображений.
    if not p.mask_shape and not p.mask_radius and not entry.layer_backend and #p.prims==1 and p.prims[1].kind=="image" then
        local image=p.prims[1]
        local source,top=RasterCanvas.engine_loader(image.src)
        assert(source,"transformed image not loaded: "..image.src)
        local m=Affine.multiply(p.transform,{1,0,0,1,image.x,image.y})
        local x0,y0,x1,y1=Affine.bounds(m,0,0,image.w,image.h)
        x0,y0=floor(x0),floor(y0)
        local w,h=max(1,math.ceil(x1)-x0),max(1,math.ceil(y1)-y0)
        assert(w<=2048 and h<=2048,"transformed layer output exceeds 2048 pixels")
        m[5],m[6]=m[5]-x0,m[6]-y0
        local opts={region=image.region,color=image.color}
        self:_apply_canvas(entry,container,{x=p.x+x0,y=p.y+y0,w=w,h=h,color=color.WHITE,
            version=raster_version(entry,source,image.w,image.h,m,opts,top),
            draw=function(cv)
                RasterCanvas.composite(cv.raw,w,h,source,image.w,image.h,m,opts,top)
            end})
        return
    end
    local bx,by,bw,bh=Render.bounds(p.prims)
    assert(bw<=2048 and bh<=2048,"transformed layer source exceeds 2048 pixels")
    local changed=not same_source(entry.source_prims,p.prims)
        or entry.source_x~=bx or entry.source_y~=by
    if not entry.layer_backend or entry.layer_epoch~=texture_epoch then
        if entry.layer_backend then entry.layer_backend:dispose(); entry.layer_white_backend:dispose() end
        local f=layer_frame(bw,bh)
        entry.layer_frame=f
        entry.layer_epoch=texture_epoch
        entry.layer_backend=setmetatable({doc=f.doc,host=f.host,prefix=f.id.."_g"..f.generation.."_",counter=0,
            entries={},orders={},order_dirty={},texture_epoch=texture_epoch,
            containers={[""]={key="",el=f.host}}},Backend)
        entry.layer_white_backend=setmetatable({doc=f.white_doc,host=f.white_host,prefix=f.id.."_white_g"..f.generation.."_",counter=0,
            entries={},orders={},order_dirty={},texture_epoch=texture_epoch,
            containers={[""]={key="",el=f.white_host}}},Backend)
        changed=true
    end
    local stage=entry.layer_backend
    if changed then
        entry.layer_frame.host.size={bw,bh}
        entry.layer_frame.white_host.size={bw,bh}
        entry.layer_frame.matte.size={bw,bh}
        entry.layer_frame.white_matte.size={bw,bh}
        local prims={}
        for _,q in ipairs(p.prims) do
            assert(q.kind~="field","native TextInput cannot be transformed or placed inside a rounded clip")
            local c={}
            for k,v in pairs(q) do c[k]=v end
            if c.clip=="" then c.x,c.y=c.x-bx,c.y-by end
            prims[#prims+1]=c
        end
        stage:apply(prims)
        entry.layer_white_backend:apply(prims)
        entry.source_prims=p.prims
        entry.source_x,entry.source_y=bx,by
        entry.source_width,entry.source_height=bw,bh
        entry.pending_source=entry.pending_source or 2
    end
    entry.layer_props,entry.layer_container=p,container
    -- Содержимое кадра становится доступно после GPU draw. Поворот уже
    -- готового источника обновляется сразу, без повторного снятия кадра.
    if entry.source_canvas then self:_raster_layer(entry) end
end
function Backend:_raster_layer(entry)
    local p=entry.layer_props
    local bx,by=entry.source_canvas_x,entry.source_canvas_y
    local source=entry.source_canvas
    local m=Affine.multiply(p.transform,{1,0,0,1,bx,by})
    local x0,y0,x1,y1=Affine.bounds(m,0,0,source.width,source.height)
    x0,y0=math.floor(x0),math.floor(y0)
    local w,h=math.max(1,math.ceil(x1)-x0),math.max(1,math.ceil(y1)-y0)
    assert(w<=2048 and h<=2048,"transformed layer output exceeds 2048 pixels")
    m[5],m[6]=m[5]-x0,m[6]-y0
    local q={key=p.key,kind="canvas",x=p.x+x0,y=p.y+y0,w=w,h=h,
        color=color.WHITE,version=raster_version(entry,source,source.width,source.height,m,
            {mask_radius=p.mask_shape or p.mask_radius,mask_w=p.w,mask_h=p.h}),draw=function(cv)
            RasterCanvas.composite(cv.raw,w,h,source,source.width,source.height,m,nil,false)
            mask_layer(cv.raw,w,h,p,x0,y0)
        end}
    self:_apply_canvas(entry,entry.layer_container,q)
    if entry.el then set_prop(entry,entry.el,"zIndex",entry.z or 0) end
end
function Backend:refresh_layers()
    local changed=false
    for _,entry in pairs(self.entries) do
        if entry.layer_backend then
            if entry.pending_source then
                entry.pending_source=entry.pending_source-1
                if entry.pending_source<=0 then
                    local black=gui.screenshot(entry.layer_frame.id)
                    local white=gui.screenshot(entry.layer_frame.id.."_white")
                    if black and white and black.width==white.width and black.height==white.height
                        and black.width==entry.source_width and black.height==entry.source_height then
                        -- Две непрозрачные подложки восстанавливают настоящий RGBA,
                        -- независимо от alpha blend режима framebuffer движка.
                        local cv=Canvas({black.width,black.height})
                        local buffer,white_buffer=black:get_data(),white:get_data()
                        local data,white_data=buffer.bytes,white_buffer.bytes
                        for i=0,black.width*black.height*4-1,4 do
                            local br,bg,bb=data[i],data[i+1],data[i+2]
                            local wr,wg,wb=white_data[i],white_data[i+1],white_data[i+2]
                            local a=255-max(wr-br,wg-bg,wb-bb)
                            data[i],data[i+1],data[i+2],data[i+3]=
                                a>0 and min(255,floor(br*255/a+0.5)) or 0,
                                a>0 and min(255,floor(bg*255/a+0.5)) or 0,
                                a>0 and min(255,floor(bb*255/a+0.5)) or 0,a
                        end
                        -- Сохраняем владельца памяти белой подложки до конца
                        -- прохода с указателем; bytearray освобождается через GC.
                        assert(white_buffer.size==buffer.size,"layer matte data size mismatch")
                        cv:set_data(buffer)
                        entry.source_canvas=cv
                        entry.source_canvas_x,entry.source_canvas_y=entry.source_x,entry.source_y
                        entry.pending_source=nil
                        self:_raster_layer(entry)
                        changed=true
                    else entry.pending_source=1 end
                end
            end
            -- Снимок выше читает предыдущий GPU draw. Обновлённый дочерний
            -- холст попадёт в него только в следующем кадре.
            local child_changed=entry.layer_backend:refresh_layers()
            local white_changed=entry.layer_white_backend:refresh_layers()
            if child_changed or white_changed then entry.pending_source=entry.pending_source or 1 end
        end
    end
    return changed
end

-- Курсор/выделение/прокрутка меняются и без рекомпозиции. Снимаем раскладку
-- каждый кадр, рисуем только видимые строки, обновляя существующие элементы.
function Backend:refresh_text_fields(dt)
    for _, entry in pairs(self.entries) do
        local p = entry.field_props
        if p and entry.extended and (p.editor_state or p.presentation) then
            local el = entry.el
            local selection = el.selection
            if p.editor_state and p.editor_state:peek() == entry.editor_applied then
                local old = entry.editor_applied
                if old.anchor ~= selection[1] or old.caret ~= selection[2] then
                    local next_value =
                        { text = old.text, anchor = selection[1], caret = selection[2] }
                    p.editor_state.value = next_value
                    entry.editor_applied = next_value
                    if p.on_selection_change then
                        p.on_selection_change(selection[1], selection[2])
                    end
                end
            end
            if p.presentation then
                local layout = el.textLayout
                if layout.ready then
                    local focused = el.focused
                    if
                        entry.caret_index ~= selection[2]
                        or entry.paint_text ~= p.text
                        or entry.paint_focus ~= focused
                    then
                        entry.caret_age = 0
                        entry.caret_index, entry.paint_text, entry.paint_focus =
                            selection[2], p.text, focused
                    else
                        entry.caret_age = (entry.caret_age or 0) + dt
                    end
                    local prims = Presentation.draw(layout, p.presentation, {
                        focused = focused,
                        editable = p.editable ~= false,
                        color = p.color,
                        hint = p.text == "",
                        alpha = p.presentation_alpha,
                        caret_age = entry.caret_age,
                    })
                    self:_paint_text_field(entry, p, prims)
                elseif entry.paint then
                    self:_paint_text_field(entry, p, {})
                end
            end
        end
    end
end

function Backend:_paint_text_field(entry, p, prims)
    if not entry.paint then
        entry.paint = self:_create(
            entry.field_container,
            "container",
            pos_attr(p.x, p.y, p.w, p.h) .. " color='#00000000' interactive='false'"
        )
        entry.paint.cache, entry.paint.nodes = {}, {}
    end
    local paint = entry.paint
    set_prop(paint, paint.el, "pos", { floor(p.x), floor(p.y) })
    set_prop(paint, paint.el, "size", { floor(p.w), floor(p.h) })
    set_prop(paint, paint.el, "zIndex", (entry.z or 0) + 1)
    for i, primitive in ipairs(prims) do
        assert(
            primitive.kind == "rect" or primitive.kind == "text",
            "text presentation supports rect/text primitives"
        )
        local sig = primitive.kind .. (primitive.font or "")
        local n = paint.nodes[i]
        if n and n.sig ~= sig then
            n.el:destruct()
            n = nil
        end
        if not n then
            local attrs = "interactive='false'"
            if primitive.kind == "text" then
                attrs = attrs .. " font='" .. esc(primitive.font) .. "' valign='top'"
            end
            n = self:_create(
                { el = paint.el },
                primitive.kind == "text" and "label" or "container",
                attrs,
                primitive.kind == "text" and "" or nil
            )
            n.cache, n.sig = {}, sig
            paint.nodes[i] = n
        end
        set_prop(n, n.el, "zIndex", i)
        set_prop(n, n.el, "pos", { floor(primitive.x), floor(primitive.y) })
        set_prop(
            n,
            n.el,
            "size",
            { max(0, primitive.w + (primitive.kind == "text" and 2 or 0)), max(0, primitive.h) }
        )
        set_prop(n, n.el, "color", color.to255(color.of(primitive.color) or color.WHITE))
        if primitive.kind == "text" then
            set_prop(n, n.el, "text", primitive.text)
        end
    end
    for i = #paint.nodes, #prims + 1, -1 do
        paint.nodes[i].el:destruct()
        paint.nodes[i] = nil
    end
    paint.el:refresh()
end

-- Растровый холст: перерисовка при смене версии или размера.
function Backend:_apply_canvas(entry, container, p)
    local w, h = max(1, floor(p.w)), max(1, floor(p.h))
    -- entry.canvas сбрасывается после app.reset_content(): текстура пропала
    local needs = not entry.canvas
        or entry.cv_w ~= w
        or entry.cv_h ~= h
        or entry.version ~= p.version
        or entry.version == nil
    if needs then
        if not entry.canvas or entry.cv_w ~= w or entry.cv_h ~= h then
            -- после сброса контента старое имя принадлежит прежней эпохе
            if not entry.canvas_name or entry.canvas_epoch ~= texture_epoch then
                local n = #free_canvas_names
                if n > 0 then
                    entry.canvas_name = free_canvas_names[n]
                    free_canvas_names[n] = nil
                else
                    texture_counter = texture_counter + 1
                    entry.canvas_name = "kompot_canvas_" .. texture_counter
                end
                entry.canvas_epoch = texture_epoch
            end
            entry.canvas = Canvas({ w, h })
            entry.cv_w, entry.cv_h = w, h
            entry.canvas:create_texture(entry.canvas_name)
            if entry.el then
                entry.el:destruct()
                entry.el = nil
            end
        end
        entry.canvas:clear()
        if p.draw then
            local ok, err = pcall(p.draw, RasterCanvas.wrap(entry.canvas,w,h,RasterCanvas.engine_loader), w, h)
            if not ok then
                print("kompot canvas: " .. tostring(err))
            end
        end
        entry.canvas:update()
        entry.version = p.version or {}
    end
    if not entry.el then
        local e = self:_create(
            container,
            "image",
            pos_attr(p.x, p.y, w, h)
                .. string.format(
                    " src='%s' region='%g,%g,%g,%g' interactive='false'",
                    entry.canvas_name,
                    FLIP_V[1],
                    FLIP_V[2],
                    FLIP_V[3],
                    FLIP_V[4]
                )
        )
        entry.el = e.el
        entry.cache = { pos = { floor(p.x), floor(p.y) } }
        self.order_dirty[container.key] = true
    end
    set_prop(entry, entry.el, "pos", { floor(p.x), floor(p.y) })
    set_prop(entry, entry.el, "color", color.to255(p.color or color.WHITE))
end

function Backend:set_cursor(name)
    name = name or "arrow"
    if name ~= self.cursor then
        self.cursor = name
        pcall(function()
            self.host.cursor = name
        end)
        for _, entry in pairs(self.entries) do
            if entry.is_input then
                set_prop(entry, entry.el, "cursor", name)
            end
        end
    end
end

function Backend:dispose()
    for _, entry in pairs(self.entries) do
        pcall(self._destroy, self, entry)
    end
    self.entries = {}
end

-- Монтирование

-- opts: content, target, theme, z_index, interactive, fullscreen.
-- Шрифты темы прогреваются сразу (линейкам нужна одна отрисовка).
function B.mount(opts)
    assert(opts and opts.content, "kompot.mount: content required")
    mount_counter = mount_counter + 1
    local target = opts.target or gui.root.root
    local docname = rawget(target, "docname")
    local doc = Document.new(docname)
    local prefix = "kompot" .. mount_counter .. "_"
    local host_id = prefix .. "host"

    local host_xml = string.format(
        "<container id='%s' pos='0,0' size='%d,%d' color='#00000000' interactive='%s' z-index='%d'/>",
        host_id,
        1,
        1,
        opts.interactive == false and "false" or "true",
        opts.z_index or 5
    )
    target:add(host_xml)
    local host = doc[host_id]

    local backend = setmetatable({
        doc = doc,
        host = host,
        prefix = prefix,
        counter = 0,
        entries = {},
        orders = {},
        order_dirty = {},
        texture_epoch = current_texture_epoch(),
        containers = { [""] = { key = "", el = host } },
    }, Backend)
    local measurer = Measurer.new(backend)
    backend.measurer = measurer
    local theme = opts.theme or Th.BASE
    measurer:warm(Th.fonts(theme))
    local user_content = opts.content
    -- Новое содержимое - новая группа: иначе хуки прежнего экрана по
    -- позиции достались бы новому.
    local content_id = 0
    local content = function()
        Th.Theme(theme, function()
            R.key(content_id, user_content)
        end)
    end

    local function target_size()
        local s = target.size
        if opts.fullscreen ~= false and not opts.target then
            local vp = gui.get_viewport()
            return vp[1], vp[2]
        end
        return s[1], s[2]
    end
    local w, h = target_size()
    host.size = { w, h }

    local app = App.new({
        content = content,
        hook_diagnostics = opts.hook_diagnostics,
        backend = backend,
        measurer = measurer,
        width = w,
        height = h,
    })
    local handle = { app = app, backend = backend, host = host }

    local warmup = 0
    local last_down, last_rdown = false, false
    local last_keys = {}
    local pending_tab
    local pending_field_wheel
    -- снимается сторожем HUD, если хост перестал тикать без dispose()
    local inventory_lock = InventoryLock.new()
    local function field_under_mouse(x, y)
        local found, top_z
        for _, entry in pairs(backend.entries) do
            local p, el = entry.field_props, entry.el
            if p and p.multiline and el and el.visible and el.interactive then
                local pos, size = el.wpos, el.size
                if x >= pos[1] and y >= pos[2]
                    and x < pos[1] + size[1] and y < pos[2] + size[2]
                then
                    local clipped = false
                    local clip = entry.field_container and entry.field_container.el
                    if clip then
                        local pp, ps = clip.wpos, clip.size
                        clipped = clip.visible == false
                            or x < pp[1] or y < pp[2]
                            or x >= pp[1] + ps[1] or y >= pp[2] + ps[2]
                    end
                    if not clipped and (not top_z or (entry.z or 0) >= top_z) then
                        found, top_z = entry, entry.z or 0
                    end
                end
            end
        end
        return found
    end
    local function text_focused()
        for _, entry in pairs(backend.entries) do
            if entry.is_field and entry.el and entry.el.focused then
                return true
            end
        end
        return false
    end
    local function block_inventory(block)
        inventory_lock:set(opts.lock_inventory ~= false and block)
    end
    -- Tab по умолчанию привязан к hud.inventory. Перехватываем событие до
    -- стандартного обработчика игры, затем отдаём его фокусу Kompot в кадре.
    local function intercept_tab()
        if handle.disposed or not inventory_lock.held then
            return false
        end
        pending_tab =
            { shift = input.is_pressed("key:left-shift") or input.is_pressed("key:right-shift") }
        for _, entry in pairs(backend.entries) do
            if entry.is_field and entry.el and entry.el.focused then
                -- node.focused=false только помечает textbox: GUI ещё может
                -- доставить ему тот же Tab и вставить отступ. Смена владельца
                -- GUI-фокуса предотвращает двойную обработку клавиши.
                if not host.focused then
                    host.focused = true
                end
                break
            end
        end
        return true
    end
    input.add_callback("key:tab", intercept_tab, host, true)
    -- Стандартное действие инвентаря VoxelCore тоже привязано к Tab и
    -- выполняется независимо от результата Lua callback key:tab.
    -- Отключаем его на время оверлея или пока указатель/фокус в обычном UI.
    -- lock_inventory = false: хост с target не трогает Tab (например, экран
    -- во фрейме-текстуре, который не перекрывает игровой интерфейс).
    local lock_target = opts.target ~= nil and opts.lock_inventory ~= false
    if lock_target then
        block_inventory(true)
    end
    host:setInterval(1, function()
        if handle.disposed then
            return
        end
        inventory_lock:touch()
        backend.measure_epoch = (backend.measure_epoch or 0) + 1
        local ok, err = xpcall(function()
            local epoch = current_texture_epoch()
            if backend.texture_epoch ~= epoch then
                backend.texture_epoch = epoch
                app.rt.need_layout = true
                for _, entry in pairs(backend.entries) do
                    -- имена текстур фигур сменились: сверить все примитивы
                    entry.prim = nil
                    if entry.canvas_name then
                        entry.canvas = nil
                    end
                end
            end
            backend:refresh_layers()
            local dt = time.delta()
            local nw, nh = target_size()
            if nw ~= app.rt.width or nh ~= app.rt.height then
                host.size = { nw, nh }
                app:set_size(nw, nh)
            end
            -- первые кадры: линейкам нужна одна отрисовка, чтобы шрифт закэшировался
            if warmup < 2 then
                warmup = warmup + 1
                return
            end
            -- GUI обрабатывает колесо после интервала хоста. На следующем
            -- кадре видно, смог ли нативный TextBox сдвинуть содержимое.
            if pending_field_wheel then
                local pending = pending_field_wheel
                pending_field_wheel = nil
                if pending.el.valid and pending.el.scroll == pending.scroll then
                    app.input:scroll_ancestors(
                        pending.key, pending.x, pending.y, pending.wheel, app.regions
                    )
                end
            end
            local ev
            if handle.fake_input then
                -- подменённый ввод (тесты, демонстрации)
                ev = handle.fake_input
                if ev.once then
                    handle.fake_input = nil
                end
            else
                local mp = input.get_mouse_pos()
                local hp = host.wpos
                local hs = host.size
                local mx, my = mp[1] - hp[1], mp[2] - hp[2]
                local inside = host.interactive ~= false
                    and host.visible ~= false
                    and mx >= 0
                    and my >= 0
                    and mx < hs[1]
                    and my < hs[2]
                local down = input.is_pressed("mouse:left")
                local rdown = input.is_pressed("mouse:right")
                local wheel = inside and input.get_mouse_scroll() or 0
                if wheel ~= 0 and inside then
                    local field = field_under_mouse(mp[1], mp[2])
                    if field then
                        pending_field_wheel = {
                            el = field.el,
                            key = field.field_props.key,
                            x = mx,
                            y = my,
                            wheel = wheel,
                            scroll = field.el.scroll,
                        }
                        wheel = 0
                    end
                end
                ev = {
                    x = mx,
                    y = my,
                    down = down and (inside or last_down),
                    rdown = rdown and (inside or last_rdown),
                    wheel = wheel,
                    inside = inside,
                }
                local field_focused = text_focused()
                local keys = { "enter", "space", "escape", "left", "right", "up", "down" }
                for _, key in ipairs(keys) do
                    local pressed = input.is_pressed("key:" .. key)
                    if
                        pressed
                        and not last_keys[key]
                        and not field_focused
                        and (inside or app.input.focus_key)
                    then
                        ev.key = key
                        ev.shift = input.is_pressed("key:left-shift")
                            or input.is_pressed("key:right-shift")
                        break
                    end
                end
                for _, key in ipairs(keys) do
                    last_keys[key] = input.is_pressed("key:" .. key)
                end
                if pending_tab then
                    ev.key, ev.shift = "tab", pending_tab.shift
                    pending_tab = nil
                end
                last_down = down
                last_rdown = rdown
            end
            app:frame(dt, ev)
            backend:refresh_text_fields(dt)
            block_inventory(
                lock_target
                    or app.input.over_ui
                    or app.input.focus_key ~= nil
                    or text_focused()
            )
            -- шрифт стал готов: перераскладка с настоящими размерами
            if measurer.pending then
                measurer.pending = false
                -- clear_cache повышает text.version: кэш раскладки сброшен
                text.clear_cache()
                app.rt.need_layout = true
            end
        end, debug.traceback)
        if not ok then
            if not host.exists then
                handle:dispose()
                return
            end
            print("[kompot] " .. tostring(err))
        end
    end)

    function handle:dispose()
        if self.disposed then
            return
        end
        self.disposed = true
        mounts[self] = nil
        block_inventory(false)
        app:dispose()
        pcall(function()
            host:destruct()
        end)
    end

    function handle:set_content(fn)
        user_content = fn
        content_id = content_id + 1
        app.rt:invalidate()
    end

    function handle:set_theme(th)
        theme = th
        measurer:warm(Th.fonts(th))
        app.rt:invalidate()
    end

    -- Над интерфейсом ли точка экрана (x, y): есть область ввода или
    -- непрозрачная область (M:block_pointer()). Для решений «клик в мир
    -- или в UI».
    function handle:is_over(x, y)
        if self.disposed then
            return false
        end
        local hp = host.wpos
        return app.input:hit(app.regions, x - hp[1], y - hp[2])
    end

    watch_mount(handle, prefix)
    return handle
end

B.Measurer = Measurer
return B
