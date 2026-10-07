return function(G)
    G.add(
        "recipes",
        "settings",
        "Настройки игры",
        "Законченная форма: звук, дальность прорисовки и применение настроек. Изменения локальны этому примеру.",
        { "UI.TextField", "UI.Switch", "UI.Slider", "UI.Button", "UI.Hint" },
        [[local name = K.state("Игрок")
local sound = K.state(true)
local distance = K.state(8)
local saved = K.state("Изменения не применены")
UI.TextField({ state = name, label = "Имя игрока" })
UI.Switch({
    label = "Звук",
    checked = sound.value,
    on_change = function(v)
        sound.value = v
    end,
})
UI.Slider({
    label = "Дальность",
    value = distance.value,
    min = 2,
    max = 24,
    step = 1,
    on_change = function(v)
        distance.value = v
    end,
})
UI.Button({
    text = "Применить",
    variant = "primary",
    on_click = function()
        saved.value = name:peek()
            .. ": дальность "
            .. distance:peek()
            .. ", звук "
            .. (sound:peek() and "вкл" or "выкл")
    end,
})
UI.Hint(saved.value)]]
    )
    G.add(
        "recipes",
        "inventory",
        "Инвентарь",
        "Сетка настоящих игровых предметов. Выберите ячейку или перетащите предмет в другую; пустые ячейки задаются через count.",
        { "UI.ItemSlot", "UI.InventoryGrid", "on_move", "accepts" },
        [[local items = K.state({
    { id = "base:stone", name = "Камень", src = "block-previews:base:stone", count = 64 },
    { id = "base:wood", name = "Древесина", src = "block-previews:base:wood", count = 24 },
})
local selected = K.state(1)
UI.InventoryGrid({
    items = items.value,
    count = 12,
    columns = 4,
    selected = selected.value,
    on_select = function(i)
        selected.value = i
    end,
    on_move = function(from, to)
        local next = {}
        for i, item in pairs(items:peek()) do
            next[i] = item
        end
        next[from], next[to] = next[to], next[from]
        items.value, selected.value = next, to
        return true
    end,
})
UI.Hint("Перенос меняет локальные данные примера.")]]
    )
    G.add(
        "recipes",
        "hud",
        "Игровой HUD",
        "Панель быстрых предметов, ресурсы и подсказка действия. Кнопка имитирует получение урона.",
        { "UI.HUD", "UI.Hotbar", "UI.ResourceBar", "UI.ActionHint" },
        [[local health = K.state(80)
local selected = K.state(1)
K.Box({ modifier = M:fill_max_width():height(240) }, function()
    UI.HUD({
        count = 5,
        items = {
            {
                id = "base:stone",
                name = "Камень",
                src = "block-previews:base:stone",
                count = 64,
            },
            {
                id = "base:wood",
                name = "Древесина",
                src = "block-previews:base:wood",
                count = 24,
            },
        },
        selected = selected.value,
        on_select = function(i)
            selected.value = i
        end,
        health = health.value,
        energy = 65,
        experience = 35,
        prompt = { binding = "E", text = "Открыть" },
    })
end)
UI.Button({
    text = "Получить урон",
    on_click = function()
        health.value = math.max(0, health:peek() - 10)
    end,
})]]
    )
    G.add(
        "integration",
        "popup",
        "Всплывающий слой",
        "Popup привязывается к месту вызова. Размещение можно менять, пока слой открыт.",
        { "K.Popup", "placement", "z" },
        [[local open = K.state(false)
local placement = K.state("below")
UI.Choice({
    options = { "below", "above", "right", "center" },
    selected = placement.value,
    on_select = function(v)
        placement.value = v
    end,
})
K.Box(function()
    UI.Button({
        text = open.value and "Закрыть слой" or "Открыть слой",
        on_click = function()
            open.value = not open:peek()
        end,
    })
    if open.value then
        K.Popup({ placement = placement.value, gap = 6, z = 10 }, function()
            UI.Panel({ title = "Всплывающий слой", width = 240 }, function()
                UI.Button({
                    text = "Закрыть",
                    on_click = function()
                        open.value = false
                    end,
                })
            end)
        end)
    end
end)]]
    )
    G.add(
        "integration",
        "mount",
        "Подключение и освобождение",
        "Самостоятельный пример для скрипта мода. Открывает интерфейс поверх игры и освобождает его по кнопке.",
        { "K.mount", "handle.dispose", "handle.set_content", "handle.set_theme", "handle.is_over" },
        [[local K = require "kompot:kompot"
local UI = require "kompot:ui"
local handle
local function Screen()
    UI.Panel({ title = "Мой интерфейс" }, function()
        UI.Button({
            text = "Закрыть",
            on_click = function()
                time.post_runnable(function()
                    if handle then
                        handle:dispose()
                        handle = nil
                    end
                end)
            end,
        })
    end)
end
handle = K.mount({ theme = UI.theme(), content = Screen, z_index = 5 })]],
        {
            standalone = true,
            note = "Для встраивания передайте target = document.panel в K.mount. handle:set_content заменяет экран, handle:set_theme меняет тему, handle:is_over(x, y) проверяет попадание в UI. В обработчике закрытия вашего HUD вызывайте handle:dispose().",
        }
    )
    G.add(
        "integration",
        "preview",
        "Превью в Kompot Lens",
        "Регистрация превью для плагина Kompot Lens. Этот фрагмент сохраняется в модуле с превью, а не выполняется внутри открытого интерфейса.",
        { "K.preview", "K.previews", "Kompot Lens", "превью" },
        [[local K = require "kompot:kompot"
local UI = require "kompot:ui"
K.preview("Моя кнопка", {
    width = 360,
    height = 180,
    group = "Мой мод",
    theme = UI.theme(),
}, function()
    local count = K.state(0)
    UI.Button({
        text = "Нажатий: " .. count.value,
        on_click = function()
            count.value = count:peek() + 1
        end,
    })
end)]],
        {
            standalone = true,
            note = "Сохраните модуль и выполните «Kompot: Открыть превью» в VS Code. Режим «Интерактивно» позволяет проверять кнопки, состояния и анимации. Нативный текстовый ввод и presentation проверяйте в игре.",
        }
    )
end
