-- Хост превью Kompot вне движка: обычный Lua 5.1-5.5 или LuaJIT.
-- Так превью запускает плагин редактора (см. docs/PREVIEW.md).
--
--   lua preview_host.lua <content> <модуль|файл.lua>[,...] [--list | --all | имя]
--
-- <content>  - каталог с паками (kompot и паки пользователя)
-- <модуль>   - "pack:path" (как в require) или путь к файлу
--              <content>/<pack>/modules/<path>.lua
-- --list     - JSON-массив превью: имя, группа, размер
-- --all      - JSON-массив документов всех превью
-- имя        - JSON-документ одного превью (по умолчанию - первое)

local content, target, mode = arg[1], arg[2], arg[3]
if not content or not target then
    io.stderr:write("usage: lua preview_host.lua <content> <module|file.lua> [--list|--all|name]\n")
    os.exit(2)
end
content = content:gsub("/$", "")

-- совместимость
unpack = unpack or table.unpack
table.unpack = table.unpack or unpack

-- require "pack:path" -> <content>/<pack>/modules/<path>.lua
local loaded = {}
local plain_require = require
function require(name)
    local pack, path = tostring(name):match("^([%w_%-]+):(.+)$")
    if not pack then
        return plain_require(name)
    end
    if loaded[name] ~= nil then
        return loaded[name]
    end
    local file = content .. "/" .. pack .. "/modules/" .. path .. ".lua"
    local chunk, err = loadfile(file)
    if not chunk then
        error("module " .. name .. " not found: " .. tostring(err), 2)
    end
    loaded[name] = true
    local res = chunk(name)
    if res == nil then
        res = true
    end
    loaded[name] = res
    return res
end

-- несколько модулей через запятую; путь к файлу -> имя модуля
for entry in target:gmatch("[^,]+") do
    local one = entry
    if one:match("%.lua$") then
        local pack, path = one:match("([%w_%-]+)/modules/(.+)%.lua$")
        if not pack then
            io.stderr:write("file is not a pack module: " .. one .. "\n")
            os.exit(2)
        end
        one = pack .. ":" .. path
    end
    local ok, err = xpcall(function()
        require(one)
    end, debug.traceback)
    if not ok then
        io.stderr:write("module error: " .. tostring(err) .. "\n")
        os.exit(1)
    end
end

local preview = require "kompot:kompot/preview"
local list = preview.list()

local function esc(s)
    return (
        tostring(s):gsub('[%c"\\]', function(c)
            if c == '"' then
                return '\\"'
            elseif c == "\\" then
                return "\\\\"
            elseif c == "\n" then
                return "\\n"
            end
            return string.format("\\u%04x", c:byte())
        end)
    )
end

if mode == "--list" then
    local out = {}
    for _, e in ipairs(list) do
        out[#out + 1] = string.format(
            '{"name":"%s","group":"%s","width":%d,"height":%d}',
            esc(e.name),
            esc(e.opts.group or ""),
            e.opts.width or 400,
            e.opts.height or 300
        )
    end
    io.write("[" .. table.concat(out, ",") .. "]\n")
elseif mode == "--all" then
    local out = {}
    for _, e in ipairs(list) do
        out[#out + 1] = (preview.export(e.name))
    end
    io.write("[" .. table.concat(out, ",\n") .. "]\n")
else
    local name = mode or (list[1] and list[1].name)
    if not name or not preview.get(name) then
        io.stderr:write("no preview: " .. tostring(name) .. "\n")
        os.exit(1)
    end
    io.write((preview.export(name)), "\n")
end
