-- Анимации ядра: каждый пример содержит полный самостоятельный фрагмент.
return function(G)
    G.add("motion", "motion_easing", "Кривые движения", "Сравните линейное движение, разгон, торможение, отскок и эластичный переход на одной дистанции.",
        { "K.animate", "K.tween", "K.EASING" }, [[local forward = K.state(false)
UI.Button({text = "Сменить направление", on_click = function()
    forward.value = not forward:peek()
end})
for _, easing in ipairs({"linear", "in_quad", "out_cubic", "in_out_cubic", "out_back", "out_elastic"}) do
    K.key(easing, function()
        local x = K.animate(forward.value and 220 or 0, K.tween(1.4, easing))
        K.Text(easing)
        K.Box({modifier = M:width(300):height(24):background("#252B31"):clip()}, function()
            K.Box({modifier = M:offset(x + 20, 0):size(40, 24):background("#81C9BC", 4)})
        end)
    end)
end]], {note = "out_back и out_elastic могут выходить за целевое значение. Оставляйте место для отскока; для прозрачности такие кривые обычно не подходят."})

    G.add("motion", "motion_springs", "Настройка пружины", "Меняйте жёсткость и затухание, затем задавайте новую цель. Сравните мягкую пружину с быстрой и без отскока.",
        { "K.spring", "K.animate", "K.state" }, [[local right = K.state(false)
local stiffness = K.state(200)
local damping = K.state(0.45)
UI.Slider({label = "Жёсткость", min = 80, max = 800, value = stiffness.value,
    on_change = function(v) stiffness.value = v end})
UI.Slider({label = "Затухание", min = 0.2, max = 1, value = damping.value,
    on_change = function(v) damping.value = v end})
UI.Button({text = "Новая цель", on_click = function() right.value = not right:peek() end})
local target = right.value and 220 or 20
for i, spec in ipairs({K.spring(stiffness.value, damping.value), K.spring(600, 0.7), K.spring(200, 1)}) do
    K.key(i, function()
        local x = K.animate(target, spec)
        K.Text(({"Своя пружина", "Быстрая", "Без отскока"})[i])
        K.Box({modifier = M:width(300):height(28):background("#252B31"):clip()}, function()
            K.Box({modifier = M:offset(x, 0):size(40, 28):background("#EAC778", 4)})
        end)
    end)
end]], {note = "Новая спецификация применяется при смене цели. Переключите направление после настройки ползунков. Пружина сохраняет скорость при смене цели."})

    G.add("motion", "motion_parallel", "Параллельные переходы", "Положение, размер, цвет и прозрачность меняются одновременно, но с разной длительностью.",
        { "K.animate", "K.tween", "K.spring", "M.alpha", "M.offset" }, [[local expanded = K.state(false)
UI.Button({text = "Развернуть / свернуть", on_click = function()
    expanded.value = not expanded:peek()
end})
local on = expanded.value
local x = K.animate(on and 140 or 12, K.spring(260, 0.65))
local width = K.animate(on and 150 or 72, K.tween(0.65, "in_out_cubic"))
local height = K.animate(on and 100 or 48, K.tween(0.9))
local alpha = K.animate(on and 1 or 0.4, K.tween(0.3, "linear"))
local color = K.animate(K.hex(on and "#81C9BC" or "#6487BE"), K.tween(0.8))
K.Box({modifier = M:width(320):height(140):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(x, 20):size(width, height):alpha(alpha):background(color, 8)}, function()
        K.Text("Kompot", {modifier = M:padding(10)})
    end)
end)]])

    G.add("motion", "motion_sequence", "Последовательность из четырёх шагов", "Сначала движение, затем расширение, смена цвета и возврат. Повтор можно запустить в любой момент.",
        { "K.after", "K.key", "K.animate", "K.tween" }, [[local replay = K.state(0)
UI.Button({text = "Повторить последовательность", on_click = function()
    replay.value = replay:peek() + 1
end})
K.key(replay.value, function()
    local move = K.after(0.15)
    local grow = K.after(0.95)
    local tint = K.after(1.65)
    local back = K.after(2.45)
    local done = K.after(3.25)
    local x = K.animate(move and not back and 190 or 12, K.tween(0.7, "in_out_cubic"))
    local width = K.animate(grow and not back and 108 or 48, K.tween(0.55))
    local color = K.animate(K.hex(tint and not back and "#EAC778" or "#81C9BC"), K.tween(0.6))
    K.Text(done and "Готово" or back and "4. Возврат" or tint and "3. Цвет" or grow and "2. Размер" or "1. Движение")
    K.Box({modifier = M:width(320):height(76):background("#252B31"):clip()}, function()
        K.Box({modifier = M:offset(x, 14):size(width, 48):background(color, 6)})
    end)
end)]], {note = "Это расписание по времени, а не ожидание завершения пружины. Интервалы рассчитаны по длительностям tween; K.after перестаёт тикать после своего срока."})

    G.add("motion", "motion_stagger", "Каскадное появление", "Шесть карточек появляются с задержкой друг за другом. Каждый элемент имеет своё время и свою анимацию.",
        { "K.key", "K.after", "K.animate", "M.alpha" }, [[local replay = K.state(0)
UI.Button({text = "Повторить каскад", on_click = function() replay.value = replay:peek() + 1 end})
K.key(replay.value, function()
    K.Column({spacing = 6}, function()
        for i = 1, 6 do
            K.key(i, function()
                local visible = K.after(0.15 + (i - 1) * 0.14)
                local x = K.animate(visible and 0 or 50, K.spring(260, 0.75))
                local alpha = K.animate(visible and 1 or 0, K.tween(0.35, "linear"))
                K.Box({modifier = M:offset(x, 0):width(280):height(32):alpha(alpha):background("#386F94", 4):padding(6)}, function()
                    K.Text("Карточка " .. i)
                end)
            end)
        end
    end)
end)]], {note = "Ключи связывают состояние с элементом. Пустое место резервируется заранее, поэтому соседние карточки не прыгают при появлении."})

    G.add("motion", "motion_keyframes", "Ключевые кадры и перемотка", "Один ползунок управляет всей сценой: движение вправо, вниз, влево и вверх с изменением размера и цвета.",
        { "K.EASING", "K.state", "M.offset", "M.size" }, [[local position = K.state(0)
UI.Slider({label = "Позиция на шкале", min = 0, max = 4, value = position.value,
    on_change = function(v) position.value = v end})
local frames = {
    {x = 12, y = 12, size = 36, color = K.hex("#81C9BC")},
    {x = 230, y = 12, size = 52, color = K.hex("#EAC778")},
    {x = 230, y = 100, size = 36, color = K.hex("#CF8BAD")},
    {x = 12, y = 100, size = 52, color = K.hex("#6487BE")},
    {x = 12, y = 12, size = 36, color = K.hex("#81C9BC")},
}
local p = position.value
local index = math.min(4, math.floor(p) + 1)
local t = K.EASING.in_out_cubic(p - (index - 1))
local a, b = frames[index], frames[index + 1]
local function mix(from, to) return from + (to - from) * t end
local color = {}
for i = 1, 4 do color[i] = mix(a.color[i], b.color[i]) end
K.Text(string.format("Кадр %d → %d: %.0f%%", index, index + 1, t * 100))
K.Box({modifier = M:width(300):height(170):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(mix(a.x, b.x), mix(a.y, b.y)):size(mix(a.size, b.size)):background(color, 6)})
end)]], {note = "Интерполяция не зависит от времени: её можно использовать для редактора, перемотки повтора или перехода, управляемого жестом."})

    G.add("motion", "motion_pingpong", "Цикл туда и обратно", "Треугольная волна задаёт направление, а кривая плавности смягчает разворот. Остановка удаляет часы из композиции.",
        { "K.clock", "K.key", "K.EASING" }, [[local running = K.state(true)
UI.Button({text = running.value and "Остановить цикл" or "Запустить цикл", on_click = function()
    running.value = not running:peek()
end})
local function draw(t)
    local phase = (t / 1.2) % 2
    local progress = phase <= 1 and phase or 2 - phase
    local x = K.EASING.in_out_cubic(progress) * 250
    K.Box({modifier = M:width(300):height(64):background("#252B31"):clip()}, function()
        K.Box({modifier = M:offset(x, 12):size(40):background("#81C9BC", 6):tag("motion_pingpong_dot")})
    end)
end
if running.value then
    K.key("loop", function() draw(K.clock()) end)
else
    draw(0)
end]], {note = "После остановки объект возвращается в начало. При запуске K.clock создаётся заново; скрытые часы не продолжают обновлять страницу. Отрисовка находится в той же области композиции, что и часы."})

    G.add("motion", "motion_wave", "Волна и фазовые сдвиги", "Двенадцать столбиков используют одни часы. Сдвиг фазы превращает одинаковые колебания в бегущую волну.",
        { "K.clock", "math.sin", "M.offset", "M.height" }, [[local running = K.state(true)
local speed = K.state(2)
UI.Button({text = running.value and "Остановить волну" or "Запустить волну", on_click = function()
    running.value = not running:peek()
end})
UI.Slider({label = "Скорость", min = 0.5, max = 5, value = speed.value,
    on_change = function(v) speed.value = v end})
local function draw(t)
    K.Box({modifier = M:width(300):height(130):background("#252B31"):clip()}, function()
        for i = 1, 12 do
            local wave = (math.sin(t * speed.value * 2 + i * 0.55) + 1) / 2
            local h = 20 + wave * 80
            K.Box({modifier = M:offset(10 + (i - 1) * 24, 115 - h):size(16, h):background({0.35, 0.65 + wave * 0.2, 0.7, 1}, 4):tag("motion_wave_bar_" .. i)})
        end
    end)
end
if running.value then K.key("wave", function() draw(K.clock()) end) else draw(0) end]])

    G.add("motion", "motion_orbit", "Орбиты и вложенное движение", "Большая точка движется по эллипсу, малая вращается вокруг неё. Обе траектории рассчитываются из общего времени.",
        { "K.clock", "math.sin", "math.cos", "M.offset" }, [[local running = K.state(true)
UI.Button({text = running.value and "Остановить орбиты" or "Запустить орбиты", on_click = function()
    running.value = not running:peek()
end})
local function draw(t)
    local x, y = 160 + math.cos(t * 1.4) * 95, 100 + math.sin(t * 1.4) * 50
    K.Box({modifier = M:width(320):height(200):background("#252B31"):clip()}, function()
        K.Box({modifier = M:offset(152, 92):size(16):background("#EAC778", 8)})
        K.Box({modifier = M:offset(x - 12, y - 12):size(24):background("#81C9BC", 12)})
        K.Box({modifier = M:offset(x + math.cos(t * 4) * 30 - 5, y + math.sin(t * 4) * 30 - 5):size(10):background("#CF8BAD", 5):tag("motion_orbit_satellite")})
    end)
end
if running.value then K.key("orbit", function() draw(K.clock()) end) else draw(0) end]], {note = "M.offset смещает отрисовку, сохраняя место элемента в раскладке. Абсолютные траектории удобно рисовать слоями внутри Box."})

    G.add("motion", "motion_interrupt", "Прерывание и разворот перехода", "Нажимайте кнопку до конца перехода. Панель меняет направление из текущего положения, подпись и фон тоже плавно перестраиваются.",
        { "K.animate", "K.spring", "K.tween", "M.alpha" }, [[local open = K.state(false)
UI.Button({text = "Открыть / закрыть панель", on_click = function() open.value = not open:peek() end})
local width = K.animate(open.value and 300 or 90, K.spring(220, 0.8))
local content = K.animate(open.value and 1 or 0, K.tween(0.35, "linear"))
local color = K.animate(K.hex(open.value and "#386F94" or "#3D444D"), K.tween(0.5))
K.Box({modifier = M:width(330):height(140):clip()}, function()
    K.Column({modifier = M:width(width):height(120):background(color, 6):clip():padding(12), spacing = 10}, function()
        K.Text("Панель")
        K.Text("Новая цель не сбрасывает движение", {modifier = M:alpha(content)})
    end)
end)]], {note = "Не удаляйте компонент, пока анимация закрытия должна быть видна. Сначала измените цель, затем уберите содержимое после перехода."})

    G.add("motion", "motion_loading", "Многоэтапная загрузка", "Загрузка, проверка, готовность: таймеры меняют этапы, а индикаторы догоняют их плавно. Перезапуск отменяет прежний сценарий.",
        { "K.after", "K.key", "K.animate", "K.tween" }, [[local run = K.state(0)
UI.Button({text = "Перезапустить загрузку", on_click = function() run.value = run:peek() + 1 end})
K.key(run.value, function()
    local begin = K.after(0.1)
    local verify = K.after(1.6)
    local complete = K.after(2.7)
    local settled = K.after(3.3)
    local progress = K.animate(complete and 1 or verify and 0.75 or begin and 0.55 or 0, K.tween(0.55))
    local color = K.animate(K.hex(complete and "#81C9BC" or "#EAC778"), K.tween(0.45))
    K.Text(settled and "Готово - можно продолжать" or complete and "Завершение" or verify and "Проверка данных" or "Загрузка данных")
    K.Box({modifier = M:width(300):height(20):background("#252B31"):clip()}, function()
        K.Box({modifier = M:width(progress * 300):height(20):background(color)})
    end)
    K.Text(string.format("%.0f%%", progress * 100))
end)]], {note = "Таймеры здесь заменяют ответы сервера. В игре используйте реальные состояния задачи; тот же K.animate сгладит скачки прогресса."})

    G.add("motion", "motion_reorder", "Перестановка с сохранением движения", "Карточки меняются местами, сохраняя собственные пружины благодаря стабильным ключам.",
        { "K.key", "K.animate", "K.spring", "M.offset" }, [[local reversed = K.state(false)
UI.Button({text = "Изменить порядок карточек", on_click = function() reversed.value = not reversed:peek() end})
local colors = {"#81C9BC", "#EAC778", "#CF8BAD", "#6487BE"}
K.Box({modifier = M:width(300):height(184):background("#252B31"):clip()}, function()
    for id = 1, 4 do
        K.key(id, function()
            local position = reversed.value and 5 - id or id
            local y = K.animate(8 + (position - 1) * 42, K.spring(220, 0.85))
            K.Box({modifier = M:offset(8, y):size(284, 34):background(colors[id], 4):padding(6)}, function()
                K.Text("Карточка " .. id)
            end)
        end)
    end
end)]], {note = "Ключом служит идентификатор карточки, а не её позиция. Место задаётся явно через offset; порядок обхода списка определяет порядок отрисовки перекрытий."})

    G.add("motion", "motion_drag", "Перетаскивание с пружинным возвратом", "Перетащите квадрат и отпустите: он возвращается к центру. Во время жеста цель следует мыши без запаздывания.",
        { "M.draggable", "K.animate", "K.snap", "K.spring", "K.state" }, [[local position = K.state({0, 0})
local dragging = K.state(false)
local xy = K.animate(position.value, dragging.value and K.snap or K.spring(180, 0.55))
K.Text(dragging.value and "Отпустите квадрат" or "Потяните квадрат в любую сторону")
K.Box({modifier = M:width(320):height(200):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(134 + xy[1], 74 + xy[2]):size(52):background("#81C9BC", 6):tag("motion_drag_box")
        :draggable({
            on_event = function(e)
                if e.type == "start" then
                    dragging.value = true
                elseif e.type == "move" then
                    local p = position:peek()
                    position.value = {p[1] + e.parent_dx, p[2] + e.parent_dy}
                elseif e.type == "end" or e.type == "cancel" then
                    dragging.value = false
                    position.value = {0, 0}
                end
            end,
        })})
end)]], {note = "K.snap - готовая спецификация без скобок. Вектор {x, y} анимируется одним хуком. Контейнер обрезает отрисовку, но начатый жест продолжается за его пределами."})

    G.add("motion", "motion_scene", "Смена сцены в несколько фаз", "Старая карточка уходит, содержимое меняется в скрытом состоянии, новая появляется. Кнопка запуска снова доступна после завершения.",
        { "K.after", "K.effect", "K.state", "K.animate", "M.alpha" }, [[local scene = K.state(1)
local busy = K.state(false)
local run = K.state(0)
UI.Button({text = "Следующая сцена", enabled = not busy.value, on_click = function()
    busy.value = true
    run.value = run:peek() + 1
end})
local swap = K.after(0.55, run.value)
local reveal = K.after(0.7, run.value)
local done = K.after(1.25, run.value)
K.effect(function()
    if swap and busy:peek() then scene.value = scene:peek() % 3 + 1 end
end, swap)
K.effect(function()
    if done then busy.value = false end
end, done)
local leaving = busy.value and not reveal
local alpha = K.animate(leaving and 0 or 1, K.tween(0.4, "linear"))
local y = K.animate(leaving and 30 or 0, K.tween(0.4))
local names = {"Инвентарь", "Задания", "Карта"}
local colors = {"#386F94", "#536B48", "#73556B"}
K.Box({modifier = M:width(300):height(130):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(12, 12 + y):size(276, 100):alpha(alpha):background(colors[scene.value], 6):padding(16)}, function()
        K.Text(names[scene.value])
    end)
end)]], {note = "Изменения состояния выполняются через effect после кадра. Ключ run перезапускает только таймеры; хуки анимации сохраняют текущие значения между запусками."})

    G.add("motion", "motion_chain", "Цепочка по завершению переходов", "Каждый следующий участок начинается, когда предыдущий tween дошёл до цели. Длительность шага можно менять прямо во время сценария.",
        { "K.animate", "K.tween", "K.effect", "K.state" }, [[local stage = K.state(0)
local duration = K.state(0.7)
local phase = stage.value
local target = phase % 2
local value = K.animate(target, K.tween(duration.value, "in_out_cubic"))
local arrived = value == target
K.effect(function()
    if arrived and phase > 0 and phase < 4 then stage.value = phase + 1 end
end, phase, arrived)
UI.Slider({label = "Длительность следующего шага", min = 0.2, max = 1.5, value = duration.value,
    on_change = function(v) duration.value = v end})
UI.Button({text = "Запустить цепочку", enabled = phase == 0 or (phase == 4 and arrived),
    on_click = function() stage.value = 1 end})
local points = {{12, 12}, {240, 12}, {240, 108}, {12, 108}, {12, 12}}
local index = math.max(1, phase)
local p = phase == 0 and 0 or phase % 2 == 1 and value or 1 - value
local from, to = points[index], points[index + 1]
local x = from[1] + (to[1] - from[1]) * p
local y = from[2] + (to[2] - from[2]) * p
K.Text(phase == 0 and "Ожидание запуска" or phase == 4 and arrived and "Цепочка завершена" or "Шаг " .. phase .. " / 4")
K.Box({modifier = M:width(300):height(168):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(x, y):size(40):background("#EAC778", 6)})
end)]], {note = "Tween точно фиксирует конечное значение, поэтому сравнение с целью здесь допустимо. Пружина может пересекать цель до остановки: для неё одного сравнения позиции недостаточно."})

    G.add("motion", "motion_player", "Временная шкала: пауза и обратный ход", "Управляйте четырёхсекундной сценой: воспроизведение, пауза, обратный ход и перемотка. Все свойства вычисляются из одной позиции.",
        { "K.clock", "K.key", "K.effect", "K.EASING", "K.state" }, [[local start = K.state(0)
local direction = K.state(0)
local run = K.state(0)
K.key(run.value, function()
    local position = start.value
    if direction.value ~= 0 then
        position = math.max(0, math.min(1, start.value + K.clock() / 4 * direction.value))
    end
local finished = direction.value == 1 and position == 1 or direction.value == -1 and position == 0
K.effect(function()
    if finished then
        start.value = position
        direction.value = 0
        run.value = run:peek() + 1
    end
end, finished)
local function play(next_direction)
    start.value = position
    direction.value = next_direction
    run.value = run:peek() + 1
end
K.Row({spacing = 6}, function()
    UI.Button({text = "Вперёд", compact = true, on_click = function() play(1) end})
    UI.Button({text = "Пауза", compact = true, on_click = function() play(0) end})
    UI.Button({text = "Назад", compact = true, on_click = function() play(-1) end})
end)
UI.Slider({label = "Перемотка", min = 0, max = 1, value = position, on_change = function(v)
    start.value = v
    direction.value = 0
    run.value = run:peek() + 1
end})
local function interval(a, b)
    return K.EASING.in_out_cubic(math.max(0, math.min(1, (position - a) / (b - a))))
end
local enter = interval(0, 0.25)
local grow = interval(0.25, 0.65)
local exit = interval(0.8, 1)
K.Text(string.format("Время %.2f / 4.00 с", position * 4))
K.Box({modifier = M:width(320):height(150):background("#252B31"):clip()}, function()
    K.Box({modifier = M:offset(12 + enter * 100, 24 - exit * 20):size(64 + grow * 120, 80)
        :alpha(enter * (1 - exit)):background({0.35 + grow * 0.3, 0.65, 0.75 - grow * 0.3, 1}, 6)})
end)
end)]], {note = "При паузе сохраняется текущая позиция, а K.clock удаляется из композиции. Новый ключ запуска начинает отсчёт с сохранённой позиции. Вся сцена синхронизирована одной шкалой."})
end
