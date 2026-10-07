-- Реестр превью: как @Preview в Compose.
--
--   K.preview("Кнопки", {width = 360, height = 200, theme = "light"}, function()
--       ButtonsDemo()
--   end)
--
-- Превью отрисовывается без движка в плоский список примитивов
-- (preview.render / preview.to_json) - это формат для внешнего превью в
-- редакторе (VS Code). Спецификация формата: kompot/docs/PREVIEW.md.

local App = require "kompot:kompot/core/app"
local Th = require "kompot:kompot/theme"
local text = require "kompot:kompot/core/text"
local Render = require "kompot:kompot/core/render"
local color = require "kompot:kompot/core/color"

local P = {}

local list = {}
local by_name = {}

-- opts: width, height, theme (таблица темы или функция, возвращающая её;
-- по умолчанию - базовая тема ядра), padding, group
function P.register(name, opts, content)
    if type(opts) == "function" then
        content, opts = opts, {}
    end
    local entry = { name = name, opts = opts or {}, content = content }
    -- место объявления: редактор переходит к нему из превью
    local info = debug and debug.getinfo and debug.getinfo(2, "Sl")
    if info then
        entry.source = info.source
        entry.line = info.currentline
    end
    if by_name[name] then
        for i, e in ipairs(list) do
            if e.name == name then
                list[i] = entry
            end
        end
    else
        list[#list + 1] = entry
    end
    by_name[name] = entry
    return entry
end

function P.list()
    return list
end

function P.get(name)
    return by_name[name]
end

function P.theme_of(opts)
    local th = opts.theme
    if type(th) == "function" then
        th = th()
    end
    return th or Th.BASE
end

-- Оборачивает содержимое превью в тему и фон.
function P.wrap(entry)
    local K = require "kompot:kompot"
    local theme = P.theme_of(entry.opts)
    return function()
        K.Theme(theme, function()
            local bg = (theme.colors or Th.BASE.colors).background or Th.BASE.colors.background
            K.Box(
                { modifier = K.M:fill_max_size():background(bg):padding(entry.opts.padding or 16) },
                entry.content
            )
        end)
    end
end

-- Программный холст (для превью без движка): подмножество Canvas движка

local SoftCanvas = {}
SoftCanvas.__index = SoftCanvas

function P.soft_canvas(w, h)
    return setmetatable({ w = w, h = h, width=w, height=h, px = {} }, SoftCanvas)
end

local function rgba_args(a, b, c, d)
    if b == nil then
        -- упакованное 0xAABBGGRR (как Canvas движка)
        local v = a or 0
        return v % 256, math.floor(v / 256) % 256,
            math.floor(v / 65536) % 256, math.floor(v / 16777216) % 256
    end
    return a, b, c, d or 255
end

local function integer(n) return n<0 and math.ceil(n) or math.floor(n) end
function SoftCanvas:set(x, y, r, g, b, a)
    x,y=integer(x),integer(y)
    if x < 0 or y < 0 or x >= self.w or y >= self.h then
        return
    end
    r, g, b, a = rgba_args(r, g, b, a)
    self.px[y*self.w+x] = {integer(r)%256,integer(g)%256,integer(b)%256,integer(a)%256}
end

function SoftCanvas:at(x, y)
    x,y=integer(x),integer(y)
    local p = self.px[y * self.w + x]
    if not p then
        return 0
    end
    return p[1]+p[2]*256+p[3]*65536+p[4]*16777216
end

function SoftCanvas:clear(r, g, b, a)
    self.px = {}
    if r ~= nil then
        r, g, b, a = rgba_args(r, g, b, a)
        for i = 0, self.w * self.h - 1 do
            self.px[i] = { r, g, b, a }
        end
    end
end

function SoftCanvas:rect(x, y, w, h, r, g, b, a)
    local function integer(n)
        return n < 0 and math.ceil(n) or math.floor(n)
    end
    local function clamp(n, hi)
        return math.min(math.max(n, 0), hi)
    end
    x, y, w, h = integer(x), integer(y), integer(w), integer(h)
    local x1, y1 = clamp(x, self.w - 1), clamp(y, self.h - 1)
    local x2, y2 = clamp(x + w, self.w - 1), clamp(y + h, self.h - 1)
    for yy = y1, y2 do
        for xx = x1, x2 do
            self:set(xx, yy, r, g, b, a)
        end
    end
end

function SoftCanvas:line(x1, y1, x2, y2, r, g, b, a)
    x1,y1,x2,y2=integer(x1),integer(y1),integer(x2),integer(y2)
    local dx, dy = math.abs(x2 - x1), -math.abs(y2 - y1)
    local sx, sy = x1 < x2 and 1 or -1, y1 < y2 and 1 or -1
    local err = dx + dy
    while true do
        self:set(x1, y1, r, g, b, a)
        if x1 == x2 and y1 == y2 then
            break
        end
        local e2 = 2 * err
        if e2 >= dy then
            err = err + dy
            x1 = x1 + sx
        end
        if e2 <= dx then
            err = err + dx
            y1 = y1 + sy
        end
    end
end

function SoftCanvas:update() end
function SoftCanvas:create_texture() end

-- Пиксели строкой RGBA (w * h * 4 байт), построчно сверху вниз.
function SoftCanvas:bytes()
    local out = {}
    local chr = string.char
    for i = 0, self.w * self.h - 1 do
        local p = self.px[i]
        if p then
            out[#out + 1] = chr(p[1], p[2], p[3], p[4])
        else
            out[#out + 1] = "\0\0\0\0"
        end
    end
    return table.concat(out)
end

-- Отрисовка и сериализация

-- Приложение превью (без движка). Кадры - app:frame(dt, событие).
-- measurer - измеритель текста (по умолчанию использует приближённые ширины;
-- внешняя интеграция может передать измеренные метрики).
function P.app(name, measurer)
    local entry = by_name[name]
    if not entry then
        error("no preview " .. tostring(name))
    end
    return App.new({
        content = P.wrap(entry),
        hook_diagnostics = entry.opts.hook_diagnostics ~= false,
        width = entry.opts.width or 400,
        height = entry.opts.height or 300,
        measurer = measurer or text.metrics_measurer(),
    }),
        entry
end

-- Отрисовывает превью: несколько кадров. Возвращает примитивы и приложение.
function P.render(name, measurer, frames)
    local app = P.app(name, measurer)
    app:frame(0)
    -- несколько кадров: on_size/on_placed и анимации появления успевают сработать
    for _ = 1, frames or 12 do
        app:frame(1 / 30)
    end
    return app.dl, app
end

-- Идут ли анимации (интерактивному превью нужны следующие кадры).
function P.animating(app)
    local rt = app.rt
    return #rt.frame_callbacks > 0 or #rt.anims > 0 or rt.need_compose or rt.need_layout
end

-- Шрифты других паков для внешних отрисовщиков:
-- preview.register_font("my_font_14", "my_pack/fonts/My.ttf", 14).
-- Путь файла - от каталога content (как <content>/<pack>/...).
local fonts = {}
local font_registry = require "kompot:kompot/fonts"

function P.register_font(name, file, size, family)
    fonts[name] = { file = file, size = size, family = family, absolute = true }
end

-- Имя шрифта -> файл и размер (для внешних отрисовщиков). Шрифты ядра -
-- относительно пака kompot, зарегистрированные - относительно content.
function P.font_info(font)
    local registered = font_registry.info(font)
    if registered then
        return registered
    end
    if fonts[font] then
        return fonts[font]
    end
    if font == "normal" then
        return {file="@engine/fonts/font",size=16,kind="bitmap",absolute=true}
    end
    error("unregistered preview font: " .. tostring(font)
        .. "; register it with kompot.fonts.register_family or preview.register_font", 2)
end

local function json_escape(s)
    return (
        s:gsub('[%c"\\]', function(ch)
            if ch == '"' then
                return '\\"'
            end
            if ch == "\\" then
                return "\\\\"
            end
            if ch == "\n" then
                return "\\n"
            end
            return string.format("\\u%04x", ch:byte())
        end)
    )
end

local function num(v)
    if v == math.huge then
        return "1e9"
    end
    if v == math.floor(v) then
        return tostring(math.floor(v))
    end
    return string.format("%.9g", v)
end

local function json_value(v)
    if type(v)=="string" then return '"'..json_escape(v)..'"' end
    if type(v)=="number" then return num(v) end
    if type(v)=="boolean" then return tostring(v) end
    if type(v)=="table" then
        local parts={}
        if v[1]~=nil then
            for _,x in ipairs(v) do parts[#parts+1]=json_value(x) end
            return "["..table.concat(parts,",").."]"
        end
        for k,x in pairs(v) do parts[#parts+1]=json_value(k)..":"..json_value(x) end
        return "{"..table.concat(parts,",").."}"
    end
    return "null"
end

-- Пиксели рисуются в Lua; изображения передаются редактору как команды,
-- чтобы использовать те же ресурсы без PNG-декодера в Lua-процессе.
function P.draw_canvas(draw,w,h,encoder)
    local cv=P.soft_canvas(w,h)
    local commands,has_images={},false
    local wrapper={width=w,height=h,raw=cv}
    for _,name in ipairs({"set","line","rect","clear"}) do
        wrapper[name]=function(_, ...)
            local args={...}
            commands[#commands+1]={op=name,args=args}
            cv[name](cv,...)
        end
    end
    wrapper.at=function(_,...) return cv:at(...) end
    wrapper.update=function() end
    function wrapper:image(src,opts)
        has_images=true
        opts=opts or {}
        require("kompot:kompot/core/canvas").validate(opts)
        local copied={}
        for k,v in pairs(opts) do copied[k]=v end
        if copied.color then copied.color=color.of(copied.color) end
        local command={op="image",options=copied}
        if type(src)=="string" then command.src=src
        elseif type(src)=="table" and src.kind=="raster" then
            local data=P.draw_canvas(src.draw,src.width,src.height,encoder)
            command.source={width=src.width,height=src.height,pixels=data.pixels,commands=data.commands}
        else
            command.source={width=src.width or src.w,height=src.height or src.h,pixels=encoder(src:bytes())}
        end
        commands[#commands+1]=command
    end
    draw(wrapper,w,h)
    return has_images and {commands=commands} or {pixels=encoder(cv:bytes())}
end

-- Список примитивов -> JSON (строка). Холсты отрисовываются программно,
-- пиксели - в поле "pixels" (base64, RGBA), если передан encoder(bytes).
function P.to_json(dl, opts)
    opts = opts or {}
    local out, raster_cache = {}, {}
    for _, p in ipairs(dl) do
        local f = {
            '"kind":"' .. p.kind .. '"',
            '"key":"' .. json_escape(p.key) .. '"',
            '"clip":"' .. json_escape(p.clip or "") .. '"',
            '"x":' .. num(p.x),
            '"y":' .. num(p.y),
            '"w":' .. num(p.w),
            '"h":' .. num(p.h),
        }
        if p.shape then f[#f+1]='"shape":'..json_value(p.shape) end
        if p.mask_shape then f[#f+1]='"mask_shape":'..json_value(p.mask_shape) end
        if p.mask_radius then f[#f+1]='"mask_radius":'..json_value(p.mask_radius) end
        if p.kind == "layer" then
            local bx,by,bw,bh=Render.bounds(p.prims)
            f[#f+1]='"source_bounds":'..json_value({bx,by,bw,bh})
            f[#f+1]='"transform":'..json_value(p.transform)
            f[#f+1]='"prims":'..P.to_json(p.prims,opts)
        end
        if p.kind == "nine_patch" then
            local paint = p.paint
            f[#f + 1] = '"source_size":[' .. paint.width .. "," .. paint.height .. "]"
            f[#f + 1] = '"border":[' .. table.concat(paint.border, ",") .. "]"
            f[#f + 1] = '"scale":' .. num(paint.scale)
            f[#f + 1] = '"center":"' .. paint.center .. '","edges":"' .. paint.edges .. '"'
            if type(paint.src) == "string" then
                f[#f + 1] = '"src":"' .. json_escape(paint.src) .. '"'
            elseif opts.encoder then
                local data=P.draw_canvas(paint.src.draw,paint.width,paint.height,opts.encoder)
                if data.pixels then f[#f+1]='"source_pixels":'..json_value(data.pixels) end
                if data.commands then f[#f+1]='"source_commands":'..json_value(data.commands) end
            end
        end
        if p.color then
            f[#f + 1] = '"color":"' .. color.to_hex(p.color) .. '"'
        end
        if p.radius then
            f[#f + 1] = '"radius":' .. json_value(p.radius)
        end
        if p.width and p.kind == "border" then
            f[#f + 1] = '"width":' .. num(p.width)
        end
        if p.blur then
            f[#f + 1] = '"blur":' .. num(p.blur)
        end
        if p.text then
            f[#f + 1] = '"text":"' .. json_escape(p.text) .. '"'
            if p.font and opts.measurer and opts.measurer.advances then
                f[#f + 1] = '"advances":['
                    .. table.concat(opts.measurer:advances(p.font, p.text), ",")
                    .. "]"
            end
        end
        if p.font then
            local fi = P.font_info(p.font)
            f[#f + 1] = '"font":"'
                .. p.font
                .. '","font_file":"'
                .. (fi.absolute and "" or "kompot/")
                .. fi.file
                .. '","font_size":'
                .. fi.size
            if fi.kind then f[#f+1] = '"font_kind":"' .. json_escape(fi.kind) .. '"' end
            if fi.absolute and fi.measured ~= nil then
                f[#f + 1] = '"font_metrics":"'
                    .. (fi.measured and "measured" or "approximate")
                    .. '"'
            end
        end
        if p.hint then
            f[#f + 1] = '"hint":"' .. json_escape(p.hint) .. '"'
        end
        if p.kind == "field" then
            f[#f + 1] = '"pad":' .. num(p.pad or 8) .. ',"lines":' .. num(p.lines or 1)
            f[#f + 1] = '"editable":' .. tostring(p.editable ~= false)
            f[#f + 1] = '"line_numbers":' .. tostring(p.line_numbers == true)
            f[#f + 1] = '"wrap":' .. tostring(p.wrap == true)
            f[#f + 1] = '"line_height":' .. num(p.line_height or 18)
            if p.syntax then
                f[#f + 1] = '"syntax":"' .. json_escape(p.syntax) .. '"'
            end
        end
        if p.src then
            f[#f + 1] = '"src":"' .. json_escape(p.src) .. '"'
        end
        if p.region then
            f[#f + 1] = string.format(
                '"region":[%s,%s,%s,%s]',
                num(p.region[1]),
                num(p.region[2]),
                num(p.region[3]),
                num(p.region[4])
            )
        end
        if p.kind == "canvas" and p.draw and opts.encoder then
            local w, h = math.max(1, math.floor(p.w)), math.max(1, math.floor(p.h))
            local data=P.draw_canvas(p.draw,w,h,opts.encoder)
            if data.pixels then f[#f+1]='"pixels":'..json_value(data.pixels) end
            if data.commands then f[#f+1]='"commands":'..json_value(data.commands) end
        end
        out[#out + 1] = "{" .. table.concat(f, ",") .. "}"
    end
    return "[\n" .. table.concat(out, ",\n") .. "\n]"
end

local B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

-- base64 без зависимостей от движка (для пикселей холстов).
function P.base64(data)
    local out = {}
    local byte, sub = string.byte, string.sub
    for i = 1, #data, 3 do
        local a, b, c = byte(data, i, i + 2)
        local n = a * 65536 + (b or 0) * 256 + (c or 0)
        local c1 = math.floor(n / 262144) % 64
        local c2 = math.floor(n / 4096) % 64
        local c3 = math.floor(n / 64) % 64
        local c4 = n % 64
        out[#out + 1] = sub(B64, c1 + 1, c1 + 1)
            .. sub(B64, c2 + 1, c2 + 1)
            .. (b and sub(B64, c3 + 1, c3 + 1) or "=")
            .. (c and sub(B64, c4 + 1, c4 + 1) or "=")
    end
    return table.concat(out)
end

-- Полный документ превью: размеры, фон, примитивы (формат docs/PREVIEW.md).
-- JSON-документ превью по текущему кадру приложения.
function P.document(name, app, measurer)
    local entry = by_name[name]
    local theme = P.theme_of(entry.opts)
    local src = entry.source and entry.source:gsub("^@", "") or ""
    return string.format(
        '{"format":"kompot-preview/1","name":"%s","group":"%s","width":%s,"height":%s,"background":"%s","source":"%s","line":%d,"animating":%s,"cursor":"%s","error":%s,"prims":%s}',
        json_escape(name),
        json_escape(entry.opts.group or ""),
        num(entry.opts.width or 400),
        num(entry.opts.height or 300),
        color.to_hex((theme.colors or Th.BASE.colors).background or Th.BASE.colors.background),
        json_escape(src),
        entry.line or 0,
        P.animating(app) and "true" or "false",
        json_escape(app.input.cursor or ""),
        app.rt.error_text and ('"' .. json_escape(app.rt.error_text) .. '"') or "null",
        P.to_json(app.dl, { encoder = P.base64, measurer = measurer })
    )
end

function P.export(name, measurer)
    measurer = measurer or text.metrics_measurer()
    local _, app = P.render(name, measurer)
    return P.document(name, app, measurer), app
end

return P
