-- Примеры преобразований, кадрового цикла и ввода
return function(G)
    G.add("motion", "rotate_image", "Вращение одного изображения", "Один ресурс, плавный угол и масштаб. Преобразования сохраняют размер элемента в раскладке.",
        {"rotate", "scale", "animate", "Image"}, [=[
local turned = K.state(false)
UI.Button({text = "Повернуть", on_click = function() turned.value = not turned:peek() end})
local angle = K.animate(turned.value and 180 or 0, K.tween(0.8, "in_out_cubic"))
local scale = K.animate(turned.value and 1.5 or 1, K.spring(180, 0.7))
K.Box({modifier = M:size(220, 150):background("#252B31"):clip()}, function()
    K.Image("kompot_ui_icons:settings", {modifier = M:offset(78, 43):size(64):rotate(angle):scale(scale)})
end)
]=], {height=250})
    G.add("motion", "transform_pivot", "Разные точки опоры", "Точка опоры задаётся в долях размера: левый верх, центр или правый низ. Содержимое поворачивается вместе с фоном.",
        {"rotate", "pivot", "on_frame"}, [=[
local time = K.state(0)
K.on_frame(function(dt) time.value = time:peek() + dt end)
local angle = math.sin(time.value) * 35
K.Box({modifier = M:size(320, 150):background("#252B31"):clip()}, function()
    for i, pivot in ipairs({{0, 0}, {0.5, 0.5}, {1, 1}}) do
        K.Box({modifier = M:offset(20 + (i - 1) * 100, 50):size(70, 38):rotate(angle, pivot):background("#386F94", 4):padding(8)}, function()
            K.Text(tostring(i))
        end)
    end
end)
]=], {height=210})
    G.add("input", "transformed_input", "Нажатия после поворота", "Кликабельная область следует за карточкой. Соседние пустые углы прямоугольника не принимают нажатия.",
        {"rotate", "scale", "clickable", "clip"}, [=[
local clicks = K.state(0)
K.Text("Нажатий: " .. clicks.value)
K.Box({modifier = M:size(280, 180):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(70, 65):size(140, 48):rotate(-25):scale(1.1):background("#81C9BC", 6):clickable(function()
        clicks.value = clicks:peek() + 1
    end):padding(12)}, function()
        K.Text("Нажми сюда", {color = "#17252A"})
    end)
end)
]=], {height=240})
    G.add("state", "frame_lifecycle", "Кадровая подписка и удаление", "Скрытый компонент перестаёт получать кадры. При повторном появлении создаётся новое состояние.",
        {"on_frame", "on_dispose", "key", "state"}, [=[
local visible = K.state(true)
local removed = K.state(0)
UI.Button({text = "Показать / удалить", on_click = function() visible.value = not visible:peek() end})
K.Text("Удалений: " .. removed.value)
if visible.value then
    K.key("timer", function()
        local elapsed = K.state(0)
        K.on_frame(function(dt) elapsed.value = elapsed:peek() + dt end)
        K.on_dispose(function() removed.value = removed:peek() + 1 end)
        K.Text(string.format("Время компонента: %.1f с", elapsed.value))
    end)
end
]=], {height=180})
    G.add("input", "drag_parent", "Перетаскивание в координатах родителя", "Карточка находится в увеличенном контейнере. Используйте parent_dx и parent_dy, чтобы движение не зависело от масштаба.",
        {"draggable", "on_event", "scale", "parent_dx"}, [=[
local position = K.state({x = 20, y = 20})
local status = K.state("Перетащи карточку; Escape отменяет захват")
K.Text(status.value)
K.Box({modifier = M:size(320, 180):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(20, 15):size(220, 110):scale(1.2, 1.2, {0, 0})}, function()
        local p = position.value
        K.Box({modifier = M:offset(p.x, p.y):size(100, 40):rotate(-10):background("#386F94", 5):draggable({
            on_event = function(e)
                if e.type == "move" then
                    local old = position:peek()
                    position.value = {x = old.x + e.parent_dx, y = old.y + e.parent_dy}
                elseif e.type == "cancel" then
                    status.value = "Отмена: " .. e.reason
                elseif e.type == "end" then
                    status.value = string.format("Скорость: %.0f, %.0f px/с", e.velocity_x, e.velocity_y)
                end
            end
        }):padding(10)}, function() K.Text("Карточка") end)
    end)
end)
]=], {height=250})
    G.add("motion", "fixed_step_throw", "Бросок и фиксированный шаг физики", "Физика работает в on_frame с шагом 1/120 с. Перетаскивание передаёт скорость отпускания в координатах родителя.",
        {"on_frame", "draggable", "velocity_x", "velocity_y"}, [=[
local body = K.remember(function() return {x = 90, y = 30, vx = 0, vy = 0, rest = 0, held = false} end)
local position = K.state({x = body.x, y = body.y})
K.on_frame(function(dt)
    body.rest = body.rest + math.min(dt, 0.1)
    local step = 1 / 120
    while body.rest >= step do
        body.rest = body.rest - step
        if not body.held then
            body.vy = body.vy + 500 * step
            body.x, body.y = body.x + body.vx * step, body.y + body.vy * step
            if body.x < 0 then body.x, body.vx = 0, math.abs(body.vx) * 0.8 end
            if body.x > 284 then body.x, body.vx = 284, -math.abs(body.vx) * 0.8 end
            if body.y < 0 then body.y, body.vy = 0, math.abs(body.vy) * 0.8 end
            if body.y > 164 then body.y, body.vy = 164, -math.abs(body.vy) * 0.75 end
        end
    end
    position.value = {x = body.x, y = body.y}
end)
local p = position.value
K.Box({modifier = M:size(320, 200):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(p.x, p.y):size(36):background("#81C9BC", 18):draggable({
        on_event = function(e)
            if e.type == "start" then body.held = true
            elseif e.type == "move" then
                body.x = math.max(0, math.min(284, body.x + e.parent_dx))
                body.y = math.max(0, math.min(164, body.y + e.parent_dy))
            elseif e.type == "end" then
                body.held, body.vx, body.vy = false, e.velocity_x, e.velocity_y
            elseif e.type == "cancel" then body.held, body.vx, body.vy = false, 0, 0 end
        end
    })})
end)
]=], {height=250})
    G.add("media", "canvas_segments", "Сегменты на Canvas", "Один небольшой растровый ресурс многократно рисуется с разными углами, масштабом и прозрачностью.",
        {"Canvas", "image", "raster", "on_frame"}, [=[
local segment = K.remember(function()
    return K.raster({width = 12, height = 8, draw = function(cv)
        cv:clear(129, 201, 188, 255)
        cv:rect(0, 0, 11, 1, 185, 232, 215, 255)
        cv:rect(0, 6, 11, 1, 55, 105, 95, 255)
    end})
end)
local time = K.state(0)
K.on_frame(function(dt) time.value = time:peek() + dt end)
local t = time.value
K.Canvas({width = 320, height = 130, version = t, draw = function(cv)
    cv:clear(37, 43, 49, 255)
    for i = 1, 14 do
        local phase = t * 2 - i * 0.3
        cv:image(segment, {x = 12 + i * 19, y = 50 + math.sin(phase) * 25,
            angle = math.cos(phase) * 20, scale = {1.8, 1.8}, alpha = 0.4 + i / 24})
    end
end})
]=], {height=180})
    G.add("layout", "radial_layout", "Раскладка по окружности", "Layout измеряет детей, затем размещает их вокруг центра. Вращение картинок независимо от размещения.",
        {"Layout", "measure", "place", "rotate"}, [=[
K.Layout({modifier = M:size(240, 180), measure = function(children, minW, maxW, minH, maxH, api)
    local w, h = math.min(240, maxW), math.min(180, maxH)
    for i, child in ipairs(children) do
        local cw, ch = api.measure(child, 24, 24, 24, 24)
        local angle = (i - 1) * math.pi * 2 / #children
        api.place(child, w / 2 + math.cos(angle) * 65 - cw / 2, h / 2 + math.sin(angle) * 65 - ch / 2)
    end
    return w, h
end}, function()
    for i = 1, 8 do
        K.Image("kompot_ui_icons:add", {modifier = M:size(24):rotate(i * 45)})
    end
end)
]=], {height=230})
end
