-- Общий каталог живого справочника и превью.
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local G = { entries = {}, by_id = {} }
G.groups = {
    { id = "game", title = "Игровые окна" },
    { id = "start", title = "Начало работы" },
    { id = "controls", title = "Компоненты" },
    { id = "layout", title = "Раскладка" },
    { id = "media", title = "Текст и графика" },
    { id = "fields", title = "Текстовый ввод" },
    { id = "input", title = "Взаимодействие" },
    { id = "state", title = "Состояние и эффекты" },
    { id = "motion", title = "Анимация" },
    { id = "scroll", title = "Прокрутка" },
    { id = "theme", title = "Темизация" },
    { id = "recipes", title = "Игровые примеры" },
    { id = "integration", title = "Интеграция" },
}
G.prelude = 'local K = require "kompot:kompot"\nlocal UI = require "kompot:ui"\nlocal M = K.M\n'

function G.add(group, id, title, description, apis, source, opts)
    assert(not G.by_id[id], "duplicate guide entry: " .. id)
    opts = opts or {}
    local section = opts.section
        or (
            (
                    group == "controls"
                    or group == "theme"
                    or group == "recipes"
                    or id == "typography"
                    or id == "text_fields"
                    or id == "validation"
                    or id == "lua"
                )
                and "ui"
            or "core"
        )
    local entry = {
        section = section,
        group = group,
        id = id,
        title = title,
        description = description,
        apis = apis,
        source = source,
        requires = opts.requires,
        note = opts.note,
        standalone = opts.standalone,
        height = opts.height,
        scene = opts.scene,
    }
    if not entry.standalone then
        local factory = assert(
            (loadstring or load)("return function(K, UI, M)\n" .. source .. "\nend", "guide:" .. id)
        )
        local draw = factory()
        entry.render = K.component(function()
            if opts.scene then
                draw(K, UI, K.M)
            else
                K.Column({ modifier = K.M:fill_max_width(), spacing = 12 }, function()
                    draw(K, UI, K.M)
                end)
            end
        end)
    end
    G.entries[#G.entries + 1], G.by_id[id] = entry, entry
end

-- Только поставляемые с паком примеры; редактор пользовательского кода живёт в Studio.
require("kompot:ui/guide/components")(G)
require("kompot:ui/guide/foundation")(G)
require("kompot:ui/guide/animations")(G)
require("kompot:ui/guide/transforms")(G)
require("kompot:ui/guide/recipes")(G)
require("kompot:ui/guide/game")(G)

local function lower(s)
    s = s:lower()
    local upper, small =
        "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ",
        "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
    local i = 1
    for ch in upper:gmatch("[\194-\244][\128-\191]+") do
        local to = small:sub(i, i + #ch - 1)
        s = s:gsub(ch, to)
        i = i + #ch
    end
    return s
end
function G.search(query, section)
    local result, words = {}, {}
    for word in lower(query or ""):gmatch("%S+") do
        words[#words + 1] = word
    end
    for _, group in ipairs(G.groups) do
        for _, entry in ipairs(G.entries) do
            if entry.group == group.id and (not section or entry.section == section) then
                local text = lower(
                    group.title
                        .. " "
                        .. entry.title
                        .. " "
                        .. entry.description
                        .. " "
                        .. table.concat(entry.apis, " ")
                )
                local match = true
                for _, word in ipairs(words) do
                    if not text:find(word, 1, true) then
                        match = false
                        break
                    end
                end
                if match then
                    result[#result + 1] = entry
                end
            end
        end
    end
    return result
end
function G.code(entry)
    if entry.standalone then
        return entry.source
    end
    return G.prelude
        .. "\nlocal function Example()\n"
        .. "    K.Column({modifier = M:fill_max_width(), spacing = 12}, function()\n"
        .. entry.source:gsub("([^\n]+)", "        %1")
        .. "\n    end)\nend\n\nK.mount({theme = UI.theme(), content = Example})"
end
return G
