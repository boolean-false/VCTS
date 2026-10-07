local K = require "kompot:kompot"
local V = require "kompot:ui"
local M = K.M
local E = {}
function E.items()
    return {
        {
            id = "base:stone",
            name = "Камень",
            src = "block-previews:base:stone",
            count = 64,
            description = "Прочный строительный материал.",
        },
        {
            id = "base:wood",
            name = "Древесина",
            src = "block-previews:base:wood",
            count = 24,
            description = "Заготовка для строительства и обработки.",
        },
        {
            id = "base:planks",
            name = "Доски",
            src = "block-previews:base:planks",
            count = 12,
            description = "Обработанная древесина.",
        },
        {
            id = "base:grass_block",
            name = "Дёрн",
            src = "block-previews:base:grass_block",
            count = 32,
        },
        { id = "base:sand", name = "Песок", src = "block-previews:base:sand", count = 48 },
        { id = "base:glass", name = "Стекло", src = "block-previews:base:glass", count = 8 },
    }
end
-- Сундук и рюкзак используют один список предметов.
E.Inventory = K.component(function()
    local items = K.state(function()
        local out = E.items()
        out[25] = {
            id = "base:torch",
            name = "Факел",
            src = "block-previews:base:torch",
            count = 16,
        }
        out[26] = {
            id = "base:brick",
            name = "Кирпич",
            src = "block-previews:base:brick",
            count = 20,
        }
        return out
    end)
    local selected = K.state(nil)
    local identity = K.remember(function()
        return {}
    end)
    local narrow = K.runtime().width < 600
    local columns, size = narrow and 5 or 8, narrow and 40 or 52
    local function move(from, to)
        if from == to then
            return false
        end
        local next = {}
        for i, v in pairs(items:peek()) do
            next[i] = v
        end
        next[from], next[to] = next[to], next[from]
        items.value, selected.value = next, to
        return true
    end
    local function transfer(index)
        if not items:peek()[index] then
            return
        end
        local first, last = index <= 24 and 25 or 1, index <= 24 and 40 or 24
        for i = first, last do
            if not items:peek()[i] then
                move(index, i)
                return
            end
        end
    end
    local function grid(first, count)
        K.Column({ spacing = 4 }, function()
            for row = 0, math.ceil(count / columns) - 1 do
                K.Row({ spacing = 4 }, function()
                    for col = 1, columns do
                        local index = first + row * columns + col - 1
                        if index < first + count then
                            K.key(index, function()
                                V.ItemSlot({
                                    item = items.value[index],
                                    size = size,
                                    selected = selected.value == index,
                                    modifier = M:tag("slot_" .. index),
                                    on_click = function()
                                        selected.value = index
                                    end,
                                    on_right_click = function()
                                        transfer(index)
                                    end,
                                    on_drag_event = function(e, item)
                                        if e.type == "start" then
                                            return { index = index, item = item, group = identity }
                                        end
                                    end,
                                    accepts = function(payload)
                                        return type(payload) == "table"
                                            and payload.group == identity
                                            and type(payload.index) == "number"
                                            and payload.index >= 1
                                            and payload.index <= 40
                                    end,
                                    on_drop = function(payload)
                                        return move(payload.index, index)
                                    end,
                                })
                            end)
                        end
                    end
                end)
            end
        end)
    end
    V.Panel({ title = "Сундук", width = columns * (size + 4) + 28 }, function()
        grid(1, 24)
        K.Spacer(6)
        K.Text("Рюкзак", { color = V.current().colors.muted })
        grid(25, 16)
        K.Text(
            "ЛКМ: переместить    ПКМ: переложить",
            { style = "caption", color = V.current().colors.dim }
        )
    end)
end)
E.Machine = K.component(function()
    local running, progress, energy, completed = K.state(false), K.state(0), K.state(80), K.state(0)
    local tick = K.clock()
    local last = K.remember(function()
        return { time = tick }
    end)
    K.effect(function()
        local dt = math.max(0, math.min(0.1, tick - last.time))
        last.time = tick
        if running:peek() and energy:peek() > 0 then
            local next = progress:peek() + dt / 5
            energy.value = math.max(0, energy:peek() - dt * 2)
            if next >= 1 then
                completed.value = completed:peek() + 4
                progress.value, running.value = 0, false
            else
                progress.value = next
            end
        elseif energy:peek() <= 0 then
            running.value = false
        end
    end, tick)
    local items = E.items()
    local output = completed.value > 0
            and { name = "Доски", src = items[3].src, count = completed.value }
        or nil
    V.MachinePanel({
        title = "Верстак",
        width = math.min(340, K.runtime().width - 48),
        input = items[2],
        output = output,
        recipe = "Древесина > доски",
        progress = progress.value,
        running = running.value,
        status = running.value and "Обработка древесины"
            or "На выходе: 4 доски",
        on_start = function()
            running.value = not running:peek()
        end,
        on_output = function()
            completed.value = 0
        end,
        content = function()
            K.Spacer(4)
            K.Text("Рюкзак", { color = V.current().colors.muted })
            V.InventoryGrid({ items = items, count = 6, columns = 6, size = 40 })
        end,
    })
end)
E.Hud = K.component(function()
    local health, slot = K.state(80), K.state(1)
    local items = E.items()
    K.Box({ modifier = M:fill_max_width():height(480) }, function()
        V.HUD({
            items = items,
            selected = slot.value,
            health = health.value,
            energy = 65,
            experience = 35,
            prompt = { binding = "E", text = "Открыть мастерскую" },
            on_select = function(i)
                slot.value = i
            end,
        })
        K.Row({ spacing = 8 }, function()
            V.Button({
                text = "Получить урон",
                variant = "danger",
                on_click = function()
                    health.value = math.max(0, health:peek() - 10)
                end,
            })
            V.Button({
                text = "Восстановить",
                on_click = function()
                    health.value = 100
                end,
            })
        end)
    end)
end)
E.Controls = K.component(function()
    local checked, value, text, selected =
        K.state(true), K.state(8), K.state("Путешественник"), K.state(1)
    local dialog, menu = K.state(false), K.state(false)
    V.Panel(
        { title = "Настройки", width = math.min(520, K.runtime().width - 48) },
        function()
            V.TextField({
                state = text,
                label = "Имя игрока",
                hint = "Введите имя",
            })
            V.Checkbox({
                label = "Подсказки взаимодействия",
                checked = checked.value,
                on_change = function(v)
                    checked.value = v
                end,
            })
            V.Switch({
                label = "Звук",
                checked = checked.value,
                on_change = function(v)
                    checked.value = v
                end,
            })
            V.Slider({
                label = "Дальность",
                min = 2,
                max = 24,
                steps = 22,
                value = value.value,
                on_change = function(v)
                    value.value = v
                end,
            })
            V.Segmented({
                options = { "Мир", "Предметы", "Устройства" },
                selected = selected.value,
                on_select = function(i)
                    selected.value = i
                end,
            })
            K.FlowRow({ spacing = 8, run_spacing = 8 }, function()
                V.Button({
                    text = "Применить",
                    modifier = M:tag("apply"),
                    variant = "primary",
                    on_click = function()
                        dialog.value = true
                    end,
                })
                V.Button({ text = "Обычная", variant = "secondary" })
                V.Button({ text = "Удалить", variant = "danger" })
                V.Button({ text = "Недоступна", enabled = false })
            end)
            K.Box(function()
                V.Button({
                    text = "Действия",
                    modifier = M:tag("menu"),
                    on_click = function()
                        menu.value = not menu:peek()
                    end,
                })
                V.Menu({
                    expanded = menu.value,
                    on_dismiss = function()
                        menu.value = false
                    end,
                }, function()
                    V.MenuItem({
                        text = "Сбросить дальность",
                        on_click = function()
                            value.value = 8
                            menu.value = false
                        end,
                    })
                    V.MenuItem({
                        text = "Отмена",
                        on_click = function()
                            menu.value = false
                        end,
                    })
                end)
            end)
            V.Dialog({
                visible = dialog.value,
                title = "Настройки сохранены",
                text = "Это локальный пример; настройки игры не изменяются.",
                on_dismiss = function()
                    dialog.value = false
                end,
                confirm = {
                    text = "Готово",
                    on_click = function()
                        dialog.value = false
                    end,
                },
            })
        end
    )
end)
E.States = K.component(function()
    local items = E.items()
    local tool = {
        src = items[1].src,
        name = "Образец износа",
        durability = 0.2,
        count = 3,
        rarity = "#EAC778",
    }
    V.Panel(
        { title = "Предметы", width = math.min(560, K.runtime().width - 48) },
        function()
            K.FlowRow({ spacing = 8, run_spacing = 8 }, function()
                V.ItemSlot({ item = items[1] })
                V.ItemSlot({ item = items[2], selected = true })
                V.ItemSlot({ item = tool })
                V.ItemSlot({ item = items[3], enabled = false })
                V.ItemSlot({ locked = true })
                V.ItemSlot({ placeholder = "arrow_down" })
            end)
            K.Text(
                "Предмет · выбор · износ · недоступно · закрыто · вход",
                { color = V.current().colors.muted }
            )
            V.ResourceBar({ label = "Неполный сегмент", value = 35 })
            V.ProgressBar({})
        end
    )
end)
E.Pause = K.component(function(p)
    p = p or {}
    local view, sound, distance = K.state("menu"), K.state(true), K.state(12)
    local c = V.current().colors
    local width = math.min(280, K.runtime().width - 48)
    K.Column({ modifier = M:width(width), spacing = 6 }, function()
        K.Text(
            view.value == "settings" and "Настройки" or "Пауза",
            { style = "title", modifier = M:padding(0, 0, 0, 12) }
        )
        if view.value == "menu" then
            V.Button({
                text = "Продолжить",
                modifier = M:fill_max_width():tag("pause_resume"),
                on_click = function()
                    if p.on_close then
                        p.on_close()
                    else
                        view.value = "resumed"
                    end
                end,
            })
            V.Button({
                text = "Настройки",
                modifier = M:fill_max_width():tag("pause_settings"),
                on_click = function()
                    view.value = "settings"
                end,
            })
            V.Button({
                text = "Закрыть",
                variant = "ghost",
                modifier = M:fill_max_width(),
                on_click = function()
                    if p.on_close then
                        p.on_close()
                    else
                        view.value = "resumed"
                    end
                end,
            })
        elseif view.value == "settings" then
            V.Panel({ width = width }, function()
                V.Checkbox({
                    label = "Звук",
                    checked = sound.value,
                    on_change = function(v)
                        sound.value = v
                    end,
                })
                V.Slider({
                    label = "Дальность",
                    value = distance.value,
                    min = 2,
                    max = 24,
                    step = 1,
                    on_change = function(v)
                        distance.value = v
                    end,
                })
            end)
            V.Button({
                text = "Назад",
                modifier = M:fill_max_width():tag("pause_back"),
                on_click = function()
                    view.value = "menu"
                end,
            })
        else
            V.Button({
                text = "Открыть меню",
                modifier = M:fill_max_width(),
                on_click = function()
                    view.value = "menu"
                end,
            })
        end
    end)
end)
E.pages = {
    { "Сундук", E.Inventory },
    { "Верстак", E.Machine },
    { "HUD", E.Hud },
    { "Контролы", E.Controls },
    { "Состояния", E.States },
    { "Пауза", E.Pause },
}
return E
