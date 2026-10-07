local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Guide = require "kompot:ui/guide"
local Scroll = require "kompot:kompot/core/scroll"
local M = K.M
local G = { catalog = Guide }
G.pages = Guide.entries

function G.new_session()
    return {
        section = K.new_state("game"),
        page = K.new_state("chest"),
        nav_width = K.new_state(248),
        query = K.new_state(""),
        navigation = K.new_state(false),
        show_code = K.new_state(false),
        generations = {},
        scrolls = {},
        history = { game = "chest", core = "welcome", ui = "buttons" },
        searches = { game = "", core = "", ui = "" },
        nav_scrolls = {
            game = Scroll.new_scroll(),
            core = Scroll.new_scroll(),
            ui = Scroll.new_scroll(),
        },
    }
end

function G.select(s, id)
    local entry = assert(Guide.by_id[id], "unknown guide page: " .. tostring(id))
    if entry.section ~= s.section:peek() then
        s.searches[s.section:peek()] = s.query:peek()
        s.section.value = entry.section
        s.query.value = s.searches[entry.section] or ""
    end
    s.page.value, s.history[entry.section] = id, id
    s.navigation.value = false
end

function G.switch_section(s, section)
    G.select(s, s.history[section])
end

function G.reset(s, id)
    if not s.generations[id] then
        s.generations[id] = K.new_state(0)
    end
    s.generations[id].value = s.generations[id]:peek() + 1
end

local function supports(entry)
    if not entry.requires then
        return true
    end
    local backend = K.runtime().backend
    return backend and backend.supports_text_presentation and backend:supports_text_presentation()
        or false
end
local NavigationItem = K.component(function(props)
    UI.Button({
        text = props.entry.title,
        selected = props.selected,
        variant = "ghost",
        tooltip = props.entry.title,
        size = "sm",
        align = "start",
        on_click = props.on_click,
        modifier = M:fill_max_width():tag("nav_" .. props.entry.id),
    })
end)
local function navigation(s)
    local results = Guide.search(s.query.value, s.section.value)
    local nav_scroll = s.nav_scrolls[s.section.value]
    K.Column({ modifier = M:fill_max_size(), spacing = 10 }, function()
        UI.TextField({
            state = s.query,
            hint = "Поиск по названию или API",
            modifier = M:tag("guide_search"),
        })
        K.Text(
            #results .. " примеров",
            { style = "caption", color = K.theme().colors.muted }
        )
        K.Box({ modifier = M:weight(1):fill_max_width() }, function()
            K.Column({
                modifier = M:fill_max_size():vertical_scroll(nav_scroll):padding(0, 0, 12, 0),
                spacing = 4,
            }, function()
                local previous
                for _, entry in ipairs(results) do
                    if entry.group ~= previous then
                        for _, group in ipairs(Guide.groups) do
                            if group.id == entry.group then
                                K.Text(
                                    group.title,
                                    { style = "strong", modifier = M:padding(4, 12, 0, 4) }
                                )
                            end
                        end
                        previous = entry.group
                    end
                    K.key("nav:" .. entry.id, function()
                        NavigationItem({
                            entry = entry,
                            selected = s.page.value == entry.id,
                            on_click = function()
                                G.select(s, entry.id)
                            end,
                        })
                    end)
                end
                if #results == 0 then
                    UI.Hint(
                        "Ничего не найдено. Попробуйте название компонента, например TextField, или очистите поиск."
                    )
                    UI.Button({
                        text = "Очистить поиск",
                        on_click = function()
                            s.query.value = ""
                        end,
                    })
                end
            end)
            UI.Scrollbar({ state = nav_scroll })
        end)
    end)
end
local function page(s)
    local entry = assert(Guide.by_id[s.page.value])
    if not s.scrolls[entry.id] then
        s.scrolls[entry.id] = Scroll.new_scroll()
    end
    if not s.generations[entry.id] then
        s.generations[entry.id] = K.new_state(0)
    end
    local scroll, generation = s.scrolls[entry.id], s.generations[entry.id].value
    K.Box({ modifier = M:fill_max_size() }, function()
        K.Column({
            modifier = M:fill_max_size():vertical_scroll(scroll):padding(0, 0, 18, 16),
            spacing = 16,
        }, function()
            K.Text(
                (entry.section == "core" and "Kompot / " or "Kompot UI / ") .. entry.title,
                { style = "caption", color = K.theme().colors.muted }
            )
            K.Text(entry.title, { style = "heading" })
            K.Text(entry.description)
            K.FlowRow({ spacing = 6, run_spacing = 6 }, function()
                for _, api in ipairs(entry.apis) do
                    UI.Key(api)
                end
            end)
            if not entry.standalone then
                K.Row({ modifier = M:fill_max_width(), align = "center", spacing = 8 }, function()
                    K.Text("Живой пример", { style = "strong", modifier = M:weight(1)})
                    UI.Button({
                        text = "Сбросить",
                        size = "sm",
                        modifier = M:tag("reset_example"),
                        on_click = function()
                            G.reset(s, entry.id)
                        end,
                    })
                end)
                UI.Panel(
                    { width = false, modifier = M:fill_max_width(), padding = 16, spacing = 12 },
                    function()
                        if supports(entry) then
                            K.key(entry.id .. ":" .. generation, function()
                                entry.render()
                            end)
                        else
                            K.Text(
                                "Нужна сборка VoxelCore с API текстовой раскладки",
                                { style = "strong" }
                            )
                            UI.Hint(
                                "Этот пример использует selection, textLayout и externalRendering. Код доступен ниже; остальные примеры работают на обычной сборке."
                            )
                        end
                    end
                )
            end
            if entry.note then
                UI.Hint(entry.note)
            end
            K.FlowRow({ spacing = 8, run_spacing = 8, align='center'}, function()
                UI.Button({
                    text = s.show_code.value and "Скрыть код" or "Показать код",
                    size = "sm",
                    modifier = M:tag("toggle_code"),
                    on_click = function()
                        s.show_code.value = not s.show_code:peek()
                    end,
                })
                K.Text("Готовый Lua-фрагмент", { style = "caption" })
            end)
            if s.show_code.value then
                UI.Lua({ code = Guide.code(entry), line_numbers = true, lines = 20 })
                UI.Hint(
                    "Код можно выделить и скопировать Ctrl+C. Прокрутка внутри поля открывает остальные строки."
                )
            end
        end)
        UI.Scrollbar({ state = scroll })
    end)
end
function G.App(s, on_close)
    UI.Theme({}, function()
        local narrow = K.runtime().width < 900
        local c = K.theme().colors
        K.Column({
            modifier = M:fill_max_size():background(c.scrim):block_pointer():padding(16),
            spacing = 12,
        }, function()
            K.Row({ modifier = M:fill_max_width(), spacing = 8, align = "center" }, function()
                K.Text("Kompot", { style = "title", modifier = M:weight(1) })
                if on_close then
                    UI.IconButton({
                        icon = "close",
                        tooltip = "Закрыть галерею",
                        modifier = M:tag("close_gallery"),
                        on_click = on_close,
                    })
                end
            end)
            K.Row({ modifier = M:fill_max_width(), spacing = 8 }, function()
                for _, section in ipairs({
                    { "game", "Игровые окна" },
                    { "ui", "Компоненты" },
                    { "core", "Ядро" },
                }) do
                    UI.Button({
                        text = section[2],
                        variant = "ghost",
                        selected = s.section.value == section[1],
                        modifier = M:tag("section_" .. section[1]),
                        on_click = function()
                            G.switch_section(s, section[1])
                        end,
                    })
                end
                if narrow and s.section.value ~= "game" then
                    UI.Button({
                        text = s.navigation.value and "К примеру"
                            or "Разделы и поиск",
                        size = "sm",
                        on_click = function()
                            s.navigation.value = not s.navigation:peek()
                        end,
                    })
                end
            end)
            local function content()
                K.key(s.page.value, function()
                    page(s)
                end)
            end
            if s.section.value == "game" then
                K.FlowRow({ spacing = 4, run_spacing = 4 }, function()
                    for _, entry in ipairs(Guide.search("", "game")) do
                        UI.Button({
                            text = entry.title,
                            selected = s.page.value == entry.id,
                            variant = "ghost",
                            size = "sm",
                            modifier = M:tag("nav_" .. entry.id),
                            on_click = function()
                                G.select(s, entry.id)
                            end,
                        })
                    end
                    UI.Button({
                        text = s.show_code.value and "Окно" or "Код",
                        size = "sm",
                        modifier = M:tag("toggle_game_code"),
                        on_click = function()
                            s.show_code.value = not s.show_code:peek()
                        end,
                    })
                end)
                K.Box({ modifier = M:weight(1):fill_max_width() }, function()
                    if s.show_code.value then
                        UI.Panel(
                            { width = false, fill_height = true, modifier = M:fill_max_size() },
                            content
                        )
                    else
                        local entry = Guide.by_id[s.page.value]
                        if not s.scrolls[entry.id] then
                            s.scrolls[entry.id] = Scroll.new_scroll()
                        end
                        K.Column(
                            { modifier = M:fill_max_size():vertical_scroll(s.scrolls[entry.id]) },
                            function()
                                K.Box({
                                    modifier = M:fill_max_width():height_in(
                                        math.max(400, K.runtime().height - 180),
                                        10000
                                    ),
                                    align = "center",
                                }, function()
                                    K.key(entry.id, entry.render)
                                end)
                            end
                        )
                    end
                end)
            elseif narrow then
                UI.Panel({
                    width = false,
                    fill_height = true,
                    modifier = M:weight(1):fill_max_width(),
                }, function()
                    if s.navigation.value then
                        navigation(s)
                    else
                        content()
                    end
                end)
            else
                UI.SplitPane({
                    modifier = M:weight(1):fill_max_width(),
                    size = s.nav_width.value,
                    min_first = 200,
                    max_first = 480,
                    min_second = 420,
                    divider_size = 24,
                    divider_modifier = M:tag("guide_divider"),
                    on_change = function(v)
                        s.nav_width.value = v
                    end,
                    first = function()
                        UI.Panel({
                            width = false,
                            fill_height = true,
                            padding = 12,
                            modifier = M:fill_max_size(),
                        }, function()
                            navigation(s)
                        end)
                    end,
                    second = function()
                        UI.Panel({
                            width = false,
                            fill_height = true,
                            padding = 12,
                            modifier = M:fill_max_size(),
                        }, content)
                    end,
                })
            end
        end)
    end)
end

return G
