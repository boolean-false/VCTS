app.config_packs({ "kompot" })
app.new_world("kompot_guide_test", "1", "core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Guide = require "kompot:ui/guide"
local recorder = require "kompot:kompot/backend/recorder"
local passed = 0
local function example(id, test)
    local b = recorder.new()
    local a = K.App.new({
        content = function()
            UI.Theme({}, Guide.by_id[id].render)
        end,
        backend = b,
        measurer = recorder.measurer(),
        width = 600,
        height = 700,
    })
    local function frame()
        for _ = 1, 5 do
            a:frame(0.1)
        end
        assert(#a.rt.errors == 0, id .. ": " .. tostring(a.rt.errors[1]))
        assert(#a.rt.warnings == 0, id .. ": unexpected warning")
    end
    local function find(text)
        for _, p in ipairs(b.dl) do
            if p.text == text then
                return p
            end
        end
    end
    local function click(text)
        local p = assert(find(text), "missing text: " .. text)
        local x, y = p.x + p.w / 2, p.y + p.h / 2
        for _, down in ipairs({ false, true, false }) do
            a:frame(0, { x = x, y = y, down = down })
        end
        frame()
    end
    frame()
    test(a, b, click, find, frame)
    a:dispose()
    passed = passed + 1
end
example("keys", function(a, b, click, find)
    click("Предмет 1: 0")
    click("Предмет 1: 1")
    click("Изменить порядок")
    assert(find("Предмет 1: 2"), "state lost after reorder")
    assert(find("Предмет 3: 0").y < find("Предмет 1: 2").y)
end)
example("effects", function(a, b, click, find)
    assert(find("Компонент появился"))
    click("Скрыть компонент")
    assert(find("Компонент освобождён"))
    click("Показать компонент")
    assert(find("Компонент появился"))
end)
example("poll", function(a, b, click, find)
    click("Получить урон")
    assert(find("Здоровье: 90"))
end)
example("text_fields", function(a, b, click, find, frame)
    local fields = {}
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            fields[#fields + 1] = p
        end
    end
    fields[1].on_change("Проверка")
    frame()
    local count = 0
    for _, p in ipairs(b.dl) do
        if p.kind == "field" and p.text == "Проверка" then
            count = count + 1
        end
    end
    assert(count == 2, "shared text state")
    click("Заменить текст")
    assert(find("Новый текст"))
end)
example("settings", function(a, b, click, find)
    click("Применить")
    assert(find("Игрок: дальность 8, звук вкл"))
end)
example("dialogs", function(a, b, click, find)
    click("Подтверждение")
    assert(find("Применить настройки?"))
    click("Применить")
    assert(find("Настройки применены"))
    assert(not find("Применить настройки?"), "dialog did not close")
end)
example("lazy", function(a, b, click, find)
    click("К 10000")
    assert(find("Элемент 10000"), "lazy jump failed")
end)
example("floating_windows", function(a, b, click, find, frame)
    for _ = 1, 3 do
        click("Открыть редактор")
    end
    for id = 1, 3 do
        assert(a:find_tag("floating_window_" .. id), "window missing")
    end
    local first
    for _, p in ipairs(b.dl) do
        if p.kind == "field" and p.text == "Текст редактора 1" then
            first = p
        end
    end
    assert(first)
    first.on_change("Сохранённый текст")
    frame()
    local close
    for _, p in ipairs(b.dl) do
        if p.text == "Закрыть" then
            close = p
        end
    end
    local x, y = close.x + close.w / 2, close.y + close.h / 2
    for _, down in ipairs({ false, true, false }) do
        a:frame(0, { x = x, y = y, down = down })
    end
    frame()
    assert(not a:find_tag("floating_window_3") and a:find_tag("floating_window_1"))
    assert(find("Сохранённый текст"), "closing sibling lost editor state")
    click("Открыть редактор")
    assert(a:find_tag("floating_window_4"), "new window did not open")
end)
example("motion_sequence", function(a, b, click, find, frame)
    for _ = 1, 7 do frame() end
    assert(find("Готово"), "sequence did not finish")
    assert(#a.rt.anims == 0, "finished sequence keeps ticking")
    click("Повторить последовательность")
    assert(find("1. Движение"), "replay did not reset the timeline")
    for _ = 1, 7 do frame() end
    assert(find("Готово") and #a.rt.anims == 0, "replayed sequence did not settle")
end)
for _, id in ipairs({"motion_pingpong", "motion_wave", "motion_orbit"}) do
    example(id, function(a, b, click, find, frame)
        assert(Guide.by_id[id].section == "core", "animation is outside the core gallery")
        assert(#a.rt.anims > 0, "loop has no active clock")
        local tags = {
            motion_pingpong = "motion_pingpong_dot",
            motion_wave = "motion_wave_bar_1",
            motion_orbit = "motion_orbit_satellite",
        }
        local p = assert(a:find_tag(tags[id]))
        local x, y, h = p.x, p.y, p.h
        frame()
        p = a:find_tag(tags[id])
        assert(math.abs(p.x - x) + math.abs(p.y - y) + math.abs(p.h - h) > 0.1, "clock does not update the rendered loop")
        local buttons = {
            motion_pingpong = "Остановить цикл",
            motion_wave = "Остановить волну",
            motion_orbit = "Остановить орбиты",
        }
        click(buttons[id])
        assert(#a.rt.anims == 0, "stopped loop keeps its clock")
    end)
end
example("motion_scene", function(a, b, click, find, frame)
    assert(find("Инвентарь"))
    click("Следующая сцена")
    assert(find("Инвентарь").color[4] == 0, "old scene did not fade out before swapping")
    frame()
    assert(find("Задания").color[4] > 0, "new scene did not start fading in")
    for _ = 1, 3 do frame() end
    assert(find("Задания") and not find("Инвентарь"), "scene transition did not complete")
    assert(#a.rt.anims == 0, "scene transition keeps ticking")
    click("Следующая сцена")
    for _ = 1, 3 do frame() end
    assert(find("Карта"), "second scene transition failed")
end)
example("motion_reorder", function(a, b, click, find, frame)
    assert(find("Карточка 1").y < find("Карточка 4").y)
    click("Изменить порядок карточек")
    for _ = 1, 4 do frame() end
    assert(find("Карточка 1").y > find("Карточка 4").y, "cards did not swap positions")
    assert(#a.rt.anims == 0, "reordered cards did not settle")
end)
example("motion_drag", function(a, b, click, find, frame)
    local p = assert(a:find_tag("motion_drag_box"))
    local home_x, home_y = p.x, p.y
    local x, y = p.x + p.w / 2, p.y + p.h / 2
    a:frame(0, {x = x, y = y, down = false})
    a:frame(0, {x = x, y = y, down = true})
    a:frame(0.01, {x = x + 60, y = y + 30, down = true})
    a:frame(0.01, {x = x + 60, y = y + 30, down = true})
    assert(find("Отпустите квадрат"), "drag did not start")
    assert(a:find_tag("motion_drag_box").x > home_x + 40, "dragged square did not follow pointer")
    a:frame(0.01, {x = x + 60, y = y + 30, down = false})
    for _ = 1, 5 do frame() end
    p = a:find_tag("motion_drag_box")
    assert(math.abs(p.x - home_x) < 0.1 and math.abs(p.y - home_y) < 0.1, "spring did not return home")
    assert(#a.rt.anims == 0, "return spring did not settle")
end)
example("motion_chain", function(a, b, click, find, frame)
    click("Запустить цепочку")
    for _ = 1, 10 do frame() end
    assert(find("Цепочка завершена"), "completion-driven chain did not finish")
    assert(#a.rt.anims == 0, "finished chain keeps ticking")
    click("Запустить цепочку")
    assert(find("Шаг 1 / 4"), "chain did not restart")
end)
example("motion_player", function(a, b, click, find, frame)
    local function time_text()
        for _, p in ipairs(b.dl) do
            if p.text and p.text:match("^Время ") then return p.text end
        end
        error("missing timeline time")
    end
    click("Вперёд")
    for _ = 1, 2 do frame() end
    assert(time_text() ~= "Время 0.00 / 4.00 с", "player did not advance")
    click("Пауза")
    local paused = time_text()
    for _ = 1, 2 do frame() end
    assert(time_text() == paused and #a.rt.anims == 0, "paused timeline keeps advancing")
    click("Назад")
    for _ = 1, 5 do frame() end
    assert(find("Время 0.00 / 4.00 с") and #a.rt.anims == 0, "reverse playback did not stop at start")
    click("Вперёд")
    for _ = 1, 9 do frame() end
    assert(find("Время 4.00 / 4.00 с") and #a.rt.anims == 0, "forward playback did not stop at end")
end)
print("passed: " .. passed .. ", failed: 0")
app.close_world(false)
app.delete_world("kompot_guide_test")
