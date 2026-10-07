-- Хост Kompot Lens: запускает UI Kompot вне движка (Lua 5.1-5.5, LuaJIT).
--
--   lua host.lua render     <content> <модули> [имя]
--   lua host.lua session    <content> <модули> <имя>     кадры - строками stdin
--   lua host.lua introspect <content> <модули>
--
-- <модули> - через запятую, как в require ("pack:path"). Подмена модуля
-- несохранённым текстом редактора:
--   --override <модуль> <временный файл> <настоящий путь>
--
-- Ответ - один JSON в stdout ({"ok": true, ...} или {"ok": false, "error"}).
-- В режиме session каждая строка stdin "frame dt x y down rdown wheel key shift"
-- даёт строку JSON с документом превью; "quit" завершает.

local mode, content, modules = arg[1], arg[2], arg[3]
if not mode or not content or not modules then
    io.stderr:write("usage: lua host.lua <render|session|introspect> <content> <modules> [...]\n")
    os.exit(2)
end
content = content:gsub("/$", "")

unpack = unpack or table.unpack
table.unpack = table.unpack or unpack

-- Аргументы после модулей: позиционные и подмены.
local rest, overrides, real_to_tmp = {}, {}, {}
local metrics_file
local pack_roots = {}
do
    local i = 4
    while arg[i] do
        if arg[i] == "--override" then
            overrides[arg[i + 1]] = {tmp = arg[i + 2], real = arg[i + 3]}
            real_to_tmp[arg[i + 3]] = arg[i + 2]
            i = i + 4
        elseif arg[i] == "--pack" then
            pack_roots[arg[i + 1]] = arg[i + 2]
            i = i + 3
        elseif arg[i] == "--metrics" then
            metrics_file = arg[i + 1]
            i = i + 2
        else
            rest[#rest + 1] = arg[i]
            i = i + 1
        end
    end
end

---------------------------------------------------------------------------
-- JSON
---------------------------------------------------------------------------

local ARRAY = setmetatable({}, {__mode = "k"})
local function array(t)
    ARRAY[t] = true
    return t
end

local function esc(s)
    return (s:gsub('[%c"\\]', function(c)
        if c == '"' then return '\\"' elseif c == "\\" then return "\\\\" elseif c == "\n" then return "\\n"
        elseif c == "\t" then return "\\t" end
        return string.format("\\u%04x", c:byte())
    end))
end

local function encode(v)
    local t = type(v)
    if v == nil then return "null" end
    if t == "boolean" then return v and "true" or "false" end
    if t == "number" then
        if v ~= v or v == math.huge or v == -math.huge then return "null" end
        if v == math.floor(v) and math.abs(v) < 1e15 then return string.format("%d", v) end
        return string.format("%.6g", v)
    end
    if t == "string" then return '"' .. esc(v) .. '"' end
    if t == "table" then
        local out = {}
        if ARRAY[v] or v[1] ~= nil then
            for i = 1, #v do out[i] = encode(v[i]) end
            return "[" .. table.concat(out, ",") .. "]"
        end
        local keys = {}
        for k in pairs(v) do keys[#keys + 1] = tostring(k) end
        table.sort(keys)
        for _, k in ipairs(keys) do out[#out + 1] = '"' .. esc(k) .. '":' .. encode(v[k]) end
        return "{" .. table.concat(out, ",") .. "}"
    end
    return '"' .. esc(tostring(v)) .. '"'
end

local function reply(obj)
    io.write(encode(obj), "\n")
    io.flush()
end

---------------------------------------------------------------------------
-- require "pack:path" -> <content>/<pack>/modules/<path>.lua (+ подмены)
---------------------------------------------------------------------------

local loaded = {}
local plain_require = require
function require(name)
    local pack, path = tostring(name):match("^([%w_%-]+):(.+)$")
    if not pack then return plain_require(name) end
    if loaded[name] ~= nil then return loaded[name] end
    local file = (pack_roots[pack] or (content .. "/" .. pack)) .. "/modules/" .. path .. ".lua"
    local chunk, err
    local o = overrides[name]
    if o then
        local f = io.open(o.tmp, "rb")
        local text = f and f:read("*a") or ""
        if f then f:close() end
        chunk, err = (loadstring or load)(text, "@" .. o.real)
    else
        chunk, err = loadfile(file)
    end
    if not chunk then error(err, 0) end
    loaded[name] = true
    local res = chunk(name)
    if res == nil then res = true end
    loaded[name] = res
    return res
end

local function traceback(err)
    return debug.traceback(tostring(err), 2)
end

local module_list = {}
for m in modules:gmatch("[^,]+") do module_list[#module_list + 1] = m end

local function load_modules()
    local results = {}
    for _, m in ipairs(module_list) do
        local ok, res = xpcall(function() return require(m) end, traceback)
        if not ok then
            return nil, res
        end
        results[m] = res
    end
    return results
end

---------------------------------------------------------------------------
-- Превью
---------------------------------------------------------------------------

local function preview_mod()
    return require("kompot:kompot/preview")
end

-- Метрики собираются webview из TTF. Запрашиваем также символы, которые
-- скрылись при переносе/обрезке: иначе приблизительная раскладка теряет текст.
local function font_measurer()
    local Text = require("kompot:kompot/core/text")
    local Fonts = require("kompot:kompot/fonts")
    local metrics = metrics_file and assert(loadfile(metrics_file))() or {}
    Fonts.register_metrics(metrics)
    local base, requests = Text.metrics_measurer(), {}
    local function request(font, s)
        local info = preview_mod().font_info(font)
        if info.measured and not metrics[font] then return end
        local m = metrics[font] or {}
        local req = requests[font]
        if not req then
            req = {font = font, file = info.absolute and info.file or "kompot/" .. info.file,
                size = info.size, kind = info.kind, codepoints = {}, seen = {}}
            requests[font] = req
        end
        for _, ch in ipairs(Text.chars(s)) do
            local cp = 0
            local first = ch:byte()
            if #ch == 1 then cp = first
            else
                cp = first - (#ch == 2 and 192 or #ch == 3 and 224 or 240)
                for i = 2, #ch do cp = cp * 64 + ch:byte(i) - 128 end
            end
            if m[cp] == nil and not req.seen[cp] then
                req.seen[cp] = true
                req.codepoints[#req.codepoints + 1] = cp
            end
        end
    end
    local measurer = {}
    function measurer:width(font, s) request(font, s); return base:width(font, s) end
    function measurer:advances(font, s) request(font, s); return base:advances(font, s) end
    function measurer:line_height(font) request(font, "Ag"); return base:line_height(font) end
    function measurer:update(font, values)
        metrics[font] = metrics[font] or {}
        for cp, value in pairs(values) do metrics[font][cp] = value end
        Fonts.register_metrics({[font] = metrics[font]})
        -- Не отправляем уже измеренные символы повторно.
        requests[font] = nil
    end
    function measurer:document(doc)
        local out = array({})
        for _, req in pairs(requests) do
            if #req.codepoints > 0 then
                out[#out + 1] = {font = req.font, file = req.file, size = req.size, kind = req.kind,
                    codepoints = array(req.codepoints)}
            end
        end
        return (doc:gsub("}%s*$", function() return ',"font_requests":' .. encode(out) .. '}' end))
    end
    return measurer
end

local function run_render()
    local _, err = load_modules()
    if err then return reply({ok = false, error = err}) end
    local P = preview_mod()
    local text = require("kompot:kompot/core/text")
    local measurer = font_measurer()
    local docs = {}
    for _, e in ipairs(P.list()) do
        if not rest[1] or rest[1] == e.name then
            local ok, doc = xpcall(function() return measurer:document(P.export(e.name, measurer)) end, traceback)
            docs[#docs + 1] = ok and doc or encode({name = e.name, error = doc, width = e.opts.width or 400,
                height = e.opts.height or 300, group = e.opts.group or "", prims = array({})})
        end
    end
    -- документы уже в JSON: собираем ответ вручную
    io.write('{"ok":true,"previews":[', table.concat(docs, ","), "]}\n")
    io.flush()
end

local function run_session()
    local _, err = load_modules()
    if err then return reply({ok = false, error = err}) end
    local P = preview_mod()
    local text = require("kompot:kompot/core/text")
    local measurer = font_measurer()
    local name = rest[1]
    local ok, app = xpcall(function()
        local a = P.app(name, measurer)
        a:frame(0)
        for _ = 1, 12 do a:frame(1 / 30) end
        return a
    end, traceback)
    if not ok then return reply({ok = false, error = app}) end
    local ev = {x = -1, y = -1, down = false, rdown = false, wheel = 0, inside = false}
    -- документ - одной строкой (переводы строк в JSON - только разметка)
    local function send()
        io.write((measurer:document(P.document(name, app, measurer)):gsub("\n", "")), "\n")
        io.flush()
    end
    send()
    for line in io.lines() do
        local parts = {}
        for part in line:gmatch("%S+") do parts[#parts + 1] = part end
        local cmd, dt, x, y, down, rdown, wheel = unpack(parts)
        if cmd == "quit" or not cmd then break end
        if cmd == "metrics" then
            local values = {lh = tonumber(parts[3])}
            for i = 4, #parts, 2 do values[tonumber(parts[i])] = tonumber(parts[i + 1]) end
            local font = parts[2]:gsub("%x%x", function(pair) return string.char(tonumber(pair, 16)) end)
            measurer:update(font, values)
            app.rt.need_layout = true
        elseif cmd == "frame" then
            ev.x, ev.y = tonumber(x) or -1, tonumber(y) or -1
            ev.inside = ev.x >= 0 and ev.y >= 0
            ev.down, ev.rdown = down == "1", rdown == "1"
            ev.wheel = tonumber(wheel) or 0
            ev.key = parts[8] ~= "-" and parts[8] or nil
            ev.shift = parts[9] == "1"
            ev.cancel = parts[10] == "1"
            local fok, ferr = pcall(app.frame, app, tonumber(dt) or 0, ev)
            if not fok then app.rt.error_text = tostring(ferr) end
            send()
        end
    end
end

---------------------------------------------------------------------------
-- Интроспекция: что экспортирует модуль, с документацией из комментариев
---------------------------------------------------------------------------

local file_cache = {}
local function file_lines(path)
    local lines = file_cache[path]
    if lines then return lines end
    lines = {}
    local f = io.open(real_to_tmp[path] or path, "rb")
    if f then
        for l in (f:read("*a") .. "\n"):gmatch("(.-)\r?\n") do lines[#lines + 1] = l end
        f:close()
    end
    file_cache[path] = lines
    return lines
end

-- Комментарии сразу над строкой line (без пустых строк между).
local function doc_above(path, line)
    local lines = file_lines(path)
    local out = {}
    local i = line - 1
    while i >= 1 do
        local c = lines[i]:match("^%s*%-%-%-?%s?(.*)$")
        if not c then break end
        table.insert(out, 1, c)
        i = i - 1
    end
    return array(out)
end

local function hex2(v)
    return string.format("%02X", math.floor(math.max(0, math.min(1, v)) * 255 + 0.5))
end

local function as_color(v)
    if type(v) ~= "table" then return nil end
    local n = #v
    if n < 3 or n > 4 then return nil end
    for i = 1, n do
        if type(v[i]) ~= "number" or v[i] < 0 or v[i] > 1 then return nil end
    end
    for k in pairs(v) do
        if type(k) ~= "number" then return nil end
    end
    return "#" .. hex2(v[1]) .. hex2(v[2]) .. hex2(v[3]) .. hex2(v[4] or 1)
end

local component_source = {}
pcall(function()
    component_source = require("kompot:kompot/core/runtime").component_source or {}
end)

local function describe_function(f)
    local real = component_source[f] or f
    local info = debug.getinfo(real, "Su") or {}
    local d = {kind = component_source[f] and "component" or "function"}
    local src = info.source or ""
    if src:sub(1, 1) == "@" and info.linedefined and info.linedefined > 0 then
        d.file = src:sub(2)
        d.line = info.linedefined
        d.doc = doc_above(d.file, info.linedefined)
    end
    local params = {}
    if info.nparams then
        for i = 1, info.nparams do
            local ok, name = pcall(debug.getlocal, real, i)
            params[i] = ok and name or ("arg" .. i)
        end
    end
    d.params = array(params)
    d.vararg = info.isvararg or false
    if params[1] == "self" then d.kind = "method" end
    return d
end

local function describe(v, depth)
    local t = type(v)
    if t == "function" then
        return describe_function(v)
    end
    if t == "table" then
        local c = as_color(v)
        if c then return {kind = "color", value = c} end
        local d = {kind = "table"}
        if depth > 0 then
            local members = {}
            for k, mv in pairs(v) do
                if type(k) == "string" and not k:match("^_") then
                    local md = describe(mv, depth - 1)
                    md.name = k
                    members[#members + 1] = md
                end
            end
            table.sort(members, function(a, b) return a.name < b.name end)
            d.members = array(members)
        end
        return d
    end
    return {kind = "value", value = (t == "string" or t == "number" or t == "boolean") and v or tostring(v)}
end

-- Тема модуля дизайн-системы: theme(), DEFAULT или BASE_THEME.
local function theme_of(mod)
    if type(mod) ~= "table" then return nil end
    local th
    if type(mod.theme) == "function" then
        local ok, res = pcall(mod.theme)
        if ok and type(res) == "table" and res.colors then th = res end
    end
    if not th and type(mod.DEFAULT) == "table" and mod.DEFAULT.colors then th = mod.DEFAULT end
    if not th and type(mod.BASE_THEME) == "table" then th = mod.BASE_THEME end
    if not th then return nil end
    local colors = {}
    for k, v in pairs(th.colors or {}) do
        colors[k] = as_color(v)
    end
    local styles = {}
    for k, st in pairs(th.type or {}) do
        if type(st) == "table" then
            styles[#styles + 1] = {name = k, font = st.font, bold = st.bold}
        end
    end
    table.sort(styles, function(a, b) return a.name < b.name end)
    local ui = {}
    if type(th.ui) == "table" then
        for k, v in pairs(th.ui) do
            if type(v) == "function" then
                local d = describe_function(v)
                d.name = k
                ui[#ui + 1] = d
            end
        end
        table.sort(ui, function(a, b) return a.name < b.name end)
    end
    return {name = th.name, colors = colors, styles = array(styles), icons = th.icons or "kompot_icons",
        ui = array(ui)}
end

local function run_introspect()
    local catalogs = {}
    for _, m in ipairs(module_list) do
        local ok, mod = xpcall(function() return require(m) end, traceback)
        if not ok then
            catalogs[#catalogs + 1] = {module = m, error = mod}
        else
            local members = {}
            local source = mod
            -- объект с методами в метатаблице (цепочка модификаторов)
            if type(mod) == "table" and next(mod) == nil then
                local mt = getmetatable(mod)
                if mt and type(mt.__index) == "table" then source = mt.__index end
            end
            if type(source) == "table" then
                for k, v in pairs(source) do
                    if type(k) == "string" and not k:match("^_") then
                        local d = describe(v, 1)
                        d.name = k
                        members[#members + 1] = d
                    end
                end
                table.sort(members, function(a, b) return a.name < b.name end)
            end
            local tok, theme = pcall(theme_of, mod)
            catalogs[#catalogs + 1] = {module = m, members = array(members), theme = tok and theme or nil}
        end
    end
    reply({ok = true, catalogs = array(catalogs)})
end

if mode == "render" then
    run_render()
elseif mode == "session" then
    run_session()
elseif mode == "introspect" then
    run_introspect()
else
    reply({ok = false, error = "unknown mode " .. tostring(mode)})
end
