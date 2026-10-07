return function(G)
    G.add(
        "media", "shapes", "Общая форма Shape",
        "Одна форма для фона, рамки, тени и обрезки. Размеры углов можно смешивать: пиксели и проценты меньшей стороны.",
        { "K.Shape", "K.Shape.cut", "K.Shape.rounded", "K.Shape.percent", "M.clip" },
        [[local S = K.Shape
local shape = S.cut({
    top_left = S.percent(50), top_right = 8,
    bottom_right = 0, bottom_left = S.px(16),
})
K.Box({modifier = M:size(240, 120)
    :shadow(8, shape):background("#386F94", shape)
    :border(2, "#FFFFFF", shape):clip(shape):padding(24)
}, function()
    K.Text("Пиксели и проценты", {color = "#FFFFFF"})
end)
K.Row({spacing = 12}, function()
    K.Box({modifier = M:size(80, 48):background("#50C0A0", S.circle())})
    K.Box({modifier = M:size(80, 48):background("#F0C050", S.rounded(S.percent(25)))})
end)]]
    )
    G.add(
        "media",
        "rounded_corners",
        "Радиус каждого угла",
        "Общая форма для фона, рамки, тени и обрезки. Прямой нижний угол и три разных скругления; содержимое и клики обрезаются по маске.",
        { "K.rounded_corners", "M.background", "M.border", "M.shadow", "M.clip" },
        [[local corners = K.rounded_corners({
    top_left = 32, top_right = 8,
    bottom_right = 0, bottom_left = 16,
})
K.Box({modifier = M:size(240, 120)
    :shadow(8, corners)
    :background("#386F94", corners)
    :border(2, "#FFFFFF", corners)
    :clip(corners)
    :padding(16)
}, function()
    K.Text("Четыре разных угла", {color = "#FFFFFF"})
    K.Box({modifier = M:offset(100, 50):size(180, 60):background("#50C0A0")})
end)]]
    )
    G.add(
        "media",
        "nine_patch",
        "Текстурные фоны",
        "Меняйте ширину панели: края сохраняют толщину, середина повторяется на GPU. Маленькая текстура общая для всех размеров.",
        { "K.nine_patch", "K.raster", "M.background_image" },
        [[local width = K.state(260)
local material = K.remember(function()
    local source = K.raster({
        key = "kompot:guide/material",
        width = 16,
        height = 16,
        draw = function(cv)
            cv:clear(50, 65, 50, 255)
            cv:rect(0, 0, 16, 2, 100, 120, 85, 255)
            cv:rect(0, 2, 2, 12, 100, 120, 85, 255)
            cv:rect(0, 14, 16, 2, 20, 30, 20, 255)
            cv:rect(14, 2, 2, 12, 20, 30, 20, 255)
            cv:rect(4, 4, 2, 2, 65, 80, 60, 255)
        end,
    })
    return K.nine_patch(source, { border = 2, center = "tile", scale = 2 })
end)
UI.Slider({
    label = "Ширина",
    min = 120,
    max = 360,
    value = width.value,
    on_change = function(v)
        width.value = v
    end,
})
K.Box(
    { modifier = M:width(width.value):height(120):background_image(material):padding(12) },
    function()
        K.Text("Один материал для всех размеров")
    end
)]],
        {
            note = "Для PNG или спрайта атласа передайте имя текстуры и source_size. Полный API: docs/SKINS.md.",
        }
    )
    G.add(
        "layout",
        "linear",
        "Row, Column и Spacer",
        "Одинаковые элементы в строке и колонке. Spacer с weight занимает свободное пространство строки.",
        { "K.Row", "K.Column", "K.Spacer", "M.weight" },
        [[local gap = K.state(8)
UI.Slider({
    label = "Расстояние",
    value = gap.value,
    min = 0,
    max = 32,
    step = 4,
    on_change = function(v)
        gap.value = v
    end,
})
K.Row({ modifier = M:fill_max_width(), spacing = gap.value }, function()
    UI.Key("Слева")
    K.Spacer(M:weight(1))
    UI.Key("Справа")
end)
K.Column({ spacing = gap.value }, function()
    UI.Key("Сверху")
    UI.Key("Снизу")
end)]]
    )
    G.add(
        "layout",
        "flow",
        "FlowRow и переносы",
        "Изменяйте ширину области. Элементы переносятся целиком, сохраняя расстояние между строками.",
        { "K.FlowRow", "M.width", "M.width_in" },
        [[local width = K.state(280)
UI.Slider({
    label = "Ширина области",
    value = width.value,
    min = 140,
    max = 360,
    step = 10,
    on_change = function(v)
        width.value = v
    end,
})
K.FlowRow({
    modifier = M:width(width.value):background(K.theme().colors.surface_raised):padding(8),
    spacing = 6,
    run_spacing = 6,
}, function()
    for _, name in ipairs({
        "Камень",
        "Дерево",
        "Железо",
        "Золото",
        "Стекло",
        "Земля",
    }) do
        UI.Key(name)
    end
end)]]
    )
    G.add(
        "layout",
        "modifier_order",
        "Порядок модификаторов",
        "Сравните фон до padding и после него. Порядок цепочки определяет, какую область занимает оформление.",
        { "M.padding", "M.background", "M.border", "M.size", "M.required_size" },
        [[K.Text("background -> padding")
K.Box({ modifier = M:background("#386F94"):padding(20) }, function()
    K.Text("Внутренний отступ")
end)
K.Text("padding -> background")
K.Box({ modifier = M:padding(20):background("#386F94") }, function()
    K.Text("Внешний отступ")
end)]]
    )
    G.add(
        "layout",
        "alignment",
        "Выравнивание и слои",
        "Меняйте положение элемента внутри Box. Второй слой расположен поверх фона.",
        { "K.Box", "M.align", "M.z_index", "M.offset", "M.match_parent_size" },
        [[local align = K.state("center")
UI.Choice({
    options = { "top_start", "center", "bottom_end" },
    selected = align.value,
    on_select = function(v)
        align.value = v
    end,
})
K.Box(
    {
        modifier = M:fill_max_width():height(140):background(K.theme().colors.surface_raised),
        align = align.value,
    },
    function()
        K.Box({ modifier = M:match_parent_size():border(1, K.theme().colors.outline) })
        UI.Key("Положение: " .. align.value)
        K.Text("Слой 2", { modifier = M:align("top_end"):padding(6):z_index(2) })
    end
)]]
    )
    G.add(
        "layout",
        "constraints",
        "Размеры и обрезка",
        "Прозрачность меняет всю группу. Текст обрезается по ширине; квадрат сохраняет соотношение сторон.",
        {
            "M.size_in",
            "M.height_in",
            "M.fill_max_size",
            "M.fill_max_width",
            "M.fill_max_height",
            "M.wrap_content",
            "M.aspect_ratio",
            "M.clip",
            "M.alpha",
            "M.shadow",
        },
        [[local alpha = K.state(1)
UI.Slider({
    label = "Прозрачность",
    value = alpha.value,
    min = 0.2,
    max = 1,
    on_change = function(v)
        alpha.value = v
    end,
})
K.Box({
    modifier = M:width(160)
        :aspect_ratio(1)
        :alpha(alpha.value)
        :shadow(4, 10)
        :background(K.theme().colors.primary, 10)
        :clip()
        :padding(12),
}, function()
    K.Text(
        "Длинный текст внутри ограниченной области",
        { color = "#181818" }
    )
end)]]
    )
    G.add(
        "layout",
        "custom_layout",
        "Своя раскладка",
        "Layout измеряет детей и размещает их по диагонали. Подпись показывает итоговый размер после раскладки.",
        { "K.Layout", "M.on_size", "M.on_placed" },
        [[local size = K.state("Ожидание раскладки")
K.Layout({
    modifier = M:on_size(function(w, h)
        size.value = string.format("Размер: %.0f x %.0f", w, h)
    end),
    measure = function(children, minW, maxW, minH, maxH, api)
        local width, height = 0, 0
        for i, child in ipairs(children) do
            local x, y = (i - 1) * 28, (i - 1) * 32
            local w, h = api.measure(child, 0, math.max(0, maxW - x), 0, maxH)
            api.place(child, x, y)
            width, height = math.max(width, x + w), math.max(height, y + h)
        end
        return width, height
    end,
}, function()
    UI.Key("Первый")
    UI.Key("Второй")
    UI.Key("Третий")
end)
K.Text(size.value)]]
    )
    G.add(
        "media",
        "typography",
        "Типографика",
        "Стили текста из текущей темы. Выравнивание и высота строк видны на одной и той же фразе.",
        { "K.Text", "K.TextStyle", "K.style", "K.fonts" },
        [[for _, name in ipairs({
    "caption",
    "body",
    "label",
    "strong",
    "title",
    "heading",
    "display",
    "mono",
}) do
    K.Text(name .. " - Kompot / Абв 0123", { style = name })
end]],
        {
            note = "Шрифты регистрируются через K.fonts; настройка семейств и метрик описана в docs/FONTS.md.",
        }
    )
    G.add(
        "media",
        "rich_text",
        "Цвет и форматирование",
        "Обычный Text поддерживает составные фрагменты. Ограничение строк добавляет многоточие.",
        { "K.Text", "spans", "markup", "max_lines", "ellipsis", "K.ContentColor", "K.rgb", "K.hex" },
        [[K.Text("[#E3AF67]Цвет[#E8E6DF] и **жирный**", { markup = "md" })
K.Text("", {
    spans = {
        { text = "Первый ", color = K.theme().colors.primary },
        { text = "второй ", style = "strong" },
        { text = "третий", color = K.theme().colors.success },
    },
})
K.Text(string.rep("Длинное описание предмета. ", 8), {
    modifier = M:width(240),
    max_lines = 2,
    ellipsis = true,
})]],
        {
            note = "Это форматирование обычного Text. Диапазоны presentation у редактируемого поля пока поддерживают только цвет.",
        }
    )
    G.add(
        "media",
        "images",
        "Изображения и атласы",
        "Одинаковая иконка в режимах fill, contain и cover. Последний пример показывает половину исходника через region.",
        { "K.Image", "K.Icon", "region", "source_size", "fit" },
        [[K.FlowRow({ spacing = 12, run_spacing = 12 }, function()
    for _, fit in ipairs({ "fill", "contain", "cover" }) do
        K.Column({ spacing = 6 }, function()
            K.Text(fit)
            K.Image("kompot_ui_icons:star", {
                width = 100,
                height = 56,
                source_size = { 32, 32 },
                fit = fit,
                modifier = M:background(K.theme().colors.surface_raised),
            })
        end)
    end
    K.Column({ spacing = 6 }, function()
        K.Text("region")
        K.Image(
            "kompot_ui_icons:star",
            {
                width = 100,
                height = 56,
                source_size = { 32, 32 },
                fit = "contain",
                region = { 0, 0, 0.5, 1 },
            }
        )
    end)
end)
K.Icon("settings", { size = 32, color = K.theme().colors.primary })]],
        {
            note = "region = {u1, v1, u2, v2} в координатах 0..1. source_size задаёт размер всей исходной картинки.",
        }
    )
    G.add(
        "media",
        "canvas",
        "Canvas",
        "Кнопка изменяет version и перерисовывает холст. Так можно создавать графики и процедурные изображения.",
        { "K.Canvas", "version" },
        [[local value = K.state(1)
UI.Button({
    text = "Следующий кадр",
    on_click = function()
        value.value = value:peek() + 1
    end,
})
K.Canvas({
    width = 240,
    height = 96,
    version = value.value,
    draw = function(canvas, w, h)
        canvas:rect(0, 0, w, h, 24, 28, 35, 255)
        for i = 0, 7 do
            local bar = 12 + ((i + value.value) * 17) % 70
            canvas:rect(8 + i * 28, h - bar, 20, bar, 227, 175, 103, 255)
        end
    end,
})]]
    )
    G.add(
        "input",
        "hover",
        "Наведение и подсказки",
        "Наведите указатель на область. Состояние наведения меняет цвет и подпись.",
        { "K.interaction", "M.hoverable", "M.cursor", "UI.Tooltip" },
        [[local inter = K.interaction()
K.Box({
    modifier = M:fill_max_width()
        :height(80)
        :background(inter.hovered.value and "#386F94" or "#303036", 8)
        :hoverable(inter)
        :cursor("pointer"),
    align = "center",
}, function()
    K.Text(
        inter.hovered.value and "Указатель внутри"
            or "Наведите указатель"
    )
end)]]
    )
    G.add(
        "input",
        "drag",
        "Перетаскивание",
        "Потяните плашку по горизонтали. Смещение ограничено шириной дорожки.",
        { "M.draggable", "M.offset", "M.block_pointer" },
        [[local x = K.state(0)
K.Box({ modifier = M:width(300):height(80):background("#25252B"):block_pointer() }, function()
    K.Box({
        modifier = M:offset(x.value, 16):size(80, 48):background("#386F94", 8):draggable({
            axis = 1,
            on_event = function(e)
                if e.type == "move" then
                    x.value = math.max(0, math.min(220, x:peek() + e.parent_dx))
                end
            end,
        }),
        align = "center",
    }, function()
        K.Text("Тяни")
    end)
end)
K.Text(string.format("Смещение: %.0f", x.value))]]
    )
    G.add(
        "input",
        "drop",
        "Цель перетаскивания",
        "Перетащите предмет в ячейку. Цель получает события входа и отпускания.",
        { "M.draggable", "M.drop_target", "M.block_pointer" },
        [[local status = K.state("Перетащите предмет")
K.Row({ spacing = 16 }, function()
    K.Box({
        modifier = M:size(100, 64):background("#386F94", 8):draggable({
            on_event = function(e)
                if e.type == "start" then
                    return "Предмет"
                elseif e.type == "cancel" then
                    status.value = "Перенос отменён"
                elseif e.type == "end" and not e.accepted then
                    status.value = "Цель не приняла предмет"
                end
            end,
        }),
        align = "center",
    }, function()
        K.Text("Предмет")
    end)
    K.Box({
        modifier = M:size(140, 64)
            :background("#303036", 8)
            :drop_target({
                on_enter = function()
                    status.value = "Над ячейкой"
                end,
                on_leave = function()
                    status.value = "Вне ячейки"
                end,
                on_drop = function(item)
                    status.value = item .. " перенесён"
                end,
            })
            :block_pointer(),
        align = "center",
    }, function()
        K.Text("Ячейка")
    end)
end)
K.Text(status.value)]]
    )
    G.add(
        "input",
        "pointer",
        "Указатель и колесо",
        "Нажмите в области или прокрутите колесо. Обработанное колесо не прокручивает страницу справочника.",
        { "M.pointer_input", "M.on_wheel", "M.block_pointer", "M.tag" },
        [[local last = K.state("Нет событий")
local zoom = K.state(1)
K.Box({
    modifier = M:fill_max_width()
        :height(100)
        :background("#25252B")
        :block_pointer()
        :pointer_input(function(ev)
            if ev.type ~= "move" then
                last.value = ev.type
            end
        end)
        :on_wheel(function(delta)
            zoom.value = math.max(0.1, math.min(4, zoom:peek() + delta * 0.1))
            return true
        end),
    align = "center",
}, function()
    K.Text(string.format("Событие: %s; масштаб: %.1f", last.value, zoom.value))
end)]]
    )
    G.add(
        "input",
        "keyboard",
        "Клавиатура и фокус",
        "Кликните область, затем нажимайте стрелки. Tab перемещает фокус между доступными контролами.",
        { "M.focusable", "M.clickable", "K.interaction" },
        [[local value = K.state(0)
local inter = K.interaction()
K.Box({
    modifier = M:fill_max_width():height(56):background("#25252B"):focusable(function(key)
        if key == "right" then
            value.value = value:peek() + 1
        end
        if key == "left" then
            value.value = value:peek() - 1
        end
    end, { interaction = inter }),
    align = "center",
}, function()
    K.Text((inter.focused.value and "В фокусе: " or "Без фокуса: ") .. value.value)
end)
UI.Button({
    text = "Сбросить значение",
    on_click = function()
        value.value = 0
    end,
})]],
        {
            note = "В HUD Escape может закрывать весь оверлей. Горячие клавиши мира следует согласовывать с фокусом интерфейса.",
        }
    )
    G.add(
        "state",
        "state",
        "Реактивное состояние",
        "Два независимых счётчика. .value подписывает компонент, :peek() читает значение без подписки.",
        { "K.state", "K.new_state", "K.component", "K.remember", "K.untracked", "K.is_state" },
        [[local Counter = K.remember(function()
    return K.component(function(props)
        local count = K.state(0)
        UI.Button({
            text = props.name .. ": " .. count.value,
            on_click = function()
                count.value = count:peek() + 1
            end,
        })
    end)
end)
Counter({ name = "Первый" })
Counter({ name = "Второй" })]],
        {
            note = "K.new_state создаёт состояние вне композиции. K.untracked(fn) выполняет чтения без подписки; K.is_state проверяет тип состояния.",
        }
    )
    G.add(
        "state", "table_state", "Обновление полей State",
        "patch меняет несколько полей, update_field вычисляет одно поле; вложенность обновляется явно через K.copy.",
        { "State.patch", "State.update_field", "K.copy", "K.state" },
        [[local player = K.state({
    name = "Петя", health = 100, coins = 0,
    stats = { armor = 50, level = 1 },
})
local p = player.value
K.Text(p.name .. ": " .. p.health .. " HP; " .. p.coins .. " монет")
K.Text("Уровень: " .. p.stats.level .. "; броня: " .. p.stats.armor)
UI.Button({text = "Урон и монеты", on_click = function()
    player:patch({health = 90, coins = 100})
end})
UI.Button({text = "+100 монет", on_click = function()
    player:update_field("coins", function(coins) return coins + 100 end)
end})
UI.Button({text = "+1 уровень", on_click = function()
    player:update_field("stats", function(stats)
        return K.copy(stats, {level = stats.level + 1})
    end)
end})]],
        { note = "Копирование поверхностное. Старое значение не изменяется; nil в update_field удаляет поле." }
    )
    G.add(
        "state", "form_state", "Форма с независимыми полями",
        "K.form сохраняет введённые значения. Новая область с ключом сбрасывает форму; каждое поле остаётся обычным State.",
        { "K.form", "K.key", "UI.TextField", "UI.Switch", "UI.Slider" },
        [[local generation = K.state(0)
UI.Button({text = "Сбросить форму", on_click = function()
    generation.value = generation:peek() + 1
end})
K.key(generation.value, function()
    local form = K.form({ name = "Петя", enabled = true, size = 10 })
    UI.TextField({state = form.name, label = "Имя"})
    UI.Switch({text = "Включено", checked = form.enabled.value,
        on_change = function(value) form.enabled.value = value end})
    UI.Slider({label = "Размер", min = 1, max = 20, value = form.size.value,
        on_change = function(value) form.size.value = value end})
    K.Text(form.name.value .. "; размер: " .. form.size.value)
end)]],
        { note = "Схема фиксирована. Повторная композиция не сбрасывает ввод; глубоких прокси и автоматической валидации нет." }
    )
    G.add(
        "state", "hook_order", "Порядок хуков и условные области",
        "Включайте и выключайте дочерний счётчик. K.key отделяет его хуки от родительских; удаление области освобождает её состояние.",
        { "K.key", "K.state", "K.component", "hook_diagnostics" },
        [[local visible = K.state(false)
UI.Button({text = visible.value and "Скрыть счётчик" or "Показать счётчик",
    on_click = function() visible.value = not visible:peek() end})
if visible.value then
    K.key("counter", function()
        local count = K.state(0)
        UI.Button({text = "Нажатий: " .. count.value,
            on_click = function() count.value = count:peek() + 1 end})
    end)
end
K.Text("Хуки родителя остаются на своих местах.")]],
        { note = "При изменении вида или количества хуков в одной области runtime сообщает Hook order changed. Подробные места вызова включаются через hook_diagnostics; в Lens они включены по умолчанию." }
    )
    G.add(
        "state",
        "keys",
        "Ключи и перестановка",
        "Увеличьте счётчики, затем поменяйте порядок. Значения останутся у своих элементов благодаря K.key.",
        { "K.key", "K.component", "K.state" },
        [[local reversed = K.state(false)
UI.Button({
    text = "Изменить порядок",
    on_click = function()
        reversed.value = not reversed:peek()
    end,
})
local ids = reversed.value and { 3, 2, 1 } or { 1, 2, 3 }
for _, id in ipairs(ids) do
    K.key(id, function()
        local count = K.state(0)
        UI.Button({
            text = "Предмет " .. id .. ": " .. count.value,
            on_click = function()
                count.value = count:peek() + 1
            end,
        })
    end)
end]]
    )
    G.add(
        "state",
        "effects",
        "Эффекты и освобождение",
        "Скрытие дочернего компонента вызывает on_dispose. При повторном появлении effect выполняется снова.",
        { "K.effect", "K.on_dispose", "K.component" },
        [[local visible = K.state(true)
local status = K.state("Ожидание")
UI.Button({
    text = visible.value and "Скрыть компонент"
        or "Показать компонент",
    on_click = function()
        visible.value = not visible:peek()
    end,
})
if visible.value then
    K.key("child", function()
        K.effect(function()
            status.value = "Компонент появился"
        end)
        K.on_dispose(function()
            status.value = "Компонент освобождён"
        end)
        UI.Key("Дочерний компонент")
    end)
end
K.Text(status.value)]]
    )
    G.add(
        "state",
        "locals",
        "Локальные значения",
        "Вложенный provide меняет значение только для своих потомков.",
        { "K.local_of", "K.provide" },
        [[local LocalName = K.remember(function()
    return K.local_of("Гость")
end)
K.Text("Снаружи: " .. LocalName:get())
K.provide(LocalName, "Игрок", function()
    K.Text("Внутри: " .. LocalName:get())
end)
K.Text("Снова снаружи: " .. LocalName:get())]]
    )
    G.add(
        "state",
        "poll",
        "Внешние данные",
        "Обычная Lua-таблица не реактивна. poll опрашивает её и обновляет UI при изменении значения.",
        { "K.poll", "K.remember" },
        [[local model = K.remember(function()
    return { health = 100 }
end)
local health = K.poll(function()
    return model.health
end)
UI.Button({
    text = "Получить урон",
    on_click = function()
        model.health = math.max(0, model.health - 10)
    end,
})
K.Text("Здоровье: " .. health)
UI.ProgressBar({ progress = health / 100 })]]
    )
    G.add(
        "motion",
        "animation",
        "Tween и spring",
        "Одна цель, два разных перехода. Нажимайте кнопку повторно до завершения движения.",
        { "K.animate", "K.tween", "K.spring", "K.snap", "K.EASING" },
        [[local open = K.state(false)
UI.Button({
    text = "Переключить цель",
    on_click = function()
        open.value = not open:peek()
    end,
})
local target = open.value and 200 or 0
local tween = K.animate(target, K.tween(0.6))
local spring = K.animate(target, K.spring())
for _, item in ipairs({ { "tween", tween }, { "spring", spring } }) do
    K.Text(item[1])
    K.Box({ modifier = M:width(260):height(32):background("#25252B"):clip() }, function()
        K.Box({ modifier = M:offset(item[2], 0):size(60, 32):background("#386F94", 6) })
    end)
end]],
        {
            note = "K.snap переключает значение без анимации. Доступные функции плавности перечислены в K.EASING.",
        }
    )
    G.add(
        "motion",
        "time",
        "Время и задержка",
        "Таймер отсчитывает время жизни примера. Кнопка перезапускает отдельную задержку.",
        { "K.clock", "K.after" },
        [[local restart = K.state(0)
local elapsed = K.clock()
local ready = K.after(2, restart.value)
K.Text(string.format("Прошло %.1f с", elapsed))
UI.Button({
    text = "Перезапустить 2 секунды",
    on_click = function()
        restart.value = restart:peek() + 1
    end,
})
K.Text(ready and "Готово" or "Ожидание...")]]
    )
    G.add(
        "scroll",
        "scroll",
        "Обычная прокрутка",
        "Внутренняя область имеет свою полосу прокрутки. Кнопка переводит её в конец.",
        { "K.scroll_state", "M.vertical_scroll", "M.horizontal_scroll", "UI.Scrollbar" },
        [[local scroll = K.scroll_state()
UI.Button({
    text = "В конец",
    on_click = function()
        scroll:scroll_to(scroll.max)
    end,
})
K.Box({ modifier = M:fill_max_width():height(180) }, function()
    K.Column(
        { modifier = M:fill_max_size():vertical_scroll(scroll):padding(0, 0, 16, 0), spacing = 8 },
        function()
            for i = 1, 30 do
                K.Text("Строка " .. i)
            end
        end
    )
    UI.Scrollbar({ state = scroll })
end)]]
    )
    G.add(
        "scroll",
        "lazy",
        "Ленивый список",
        "Список из 10 000 элементов создаёт содержимое видимой области. Кнопки выполняют переход к элементу.",
        { "K.LazyColumn", "K.lazy_state", "scroll_to_item", "key_of" },
        [[local list = K.lazy_state()
K.FlowRow({ spacing = 8, run_spacing = 8 }, function()
    for _, index in ipairs({ 1, 500, 10000 }) do
        UI.Button({
            text = "К " .. index,
            on_click = function()
                list:scroll_to_item(index)
            end,
        })
    end
end)
K.LazyColumn({
    count = 10000,
    state = list,
    modifier = M:fill_max_width():height(200),
    spacing = 4,
    key_of = function(i)
        return "item_" .. i
    end,
    item = function(i)
        K.Text("Элемент " .. i, { modifier = M:height(24) })
    end,
})]]
    )
    G.add(
        "scroll",
        "grid",
        "Ленивая сетка и строка",
        "Сетка размещает предметы по колонкам. Ниже находится независимая горизонтальная лента.",
        { "K.LazyGrid", "K.LazyRow" },
        [[K.LazyGrid({
    count = 120,
    columns = 4,
    spacing = 8,
    modifier = M:fill_max_width():height(180),
    item = function(i)
        UI.Slot({ icon = "star", badge = i, size = 44 })
    end,
})
K.LazyRow({
    count = 100,
    spacing = 8,
    modifier = M:fill_max_width():height(56),
    item = function(i)
        UI.Slot({ icon = "folder", badge = i, size = 44 })
    end,
})]]
    )
    G.add(
        "theme",
        "palette",
        "Палитра и плотность",
        "Цветовые роли текущей темы. Мод может переопределить их через UI.theme.",
        { "UI.theme", "K.theme", "density", "colors" },
        [[K.FlowRow({ spacing = 12, run_spacing = 12 }, function()
    for _, role in ipairs({
        "primary",
        "surface",
        "on_surface",
        "outline",
        "error",
        "success",
        "warning",
    }) do
        K.Column({ spacing = 6 }, function()
            K.Box({ modifier = M:size(100, 44):background(K.theme().colors[role], 6) })
            K.Text(role, { style = "caption" })
        end)
    end
end)]]
    )
    G.add(
        "theme",
        "nested_theme",
        "Вложенная тема",
        "Изменение акцента, формы и размера действует только внутри UI.Theme.",
        {
            "UI.Theme",
            "K.Theme",
            "K.extend_theme",
            "K.LocalTheme",
            "components",
            "metrics",
            "shapes",
        },
        [[UI.Button({ text = "Текущая тема", variant = "primary" })
UI.Theme({
    colors = { primary = "#A8B493" },
    shapes = { control = 12 },
    density = "compact",
    components = { Button = { size = "lg" } },
}, function()
    UI.Button({ text = "Вложенная тема", variant = "primary" })
    UI.TextField({ value = "Локальное оформление", editable = false })
end)
UI.Button({ text = "Снова текущая тема", variant = "primary" })]]
    )
    G.add(
        "theme",
        "contract",
        "Контракт дизайн-системы",
        "K.ui() выбирает компоненты из текущей темы. Так один экран может использовать разные дизайн-системы.",
        {
            "K.ui",
            "UI.ui",
            "K.LocalContentColor",
            "K.LocalTextStyle",
            "K.ContentColor",
            "K.TextStyle",
        },
        [[local Controls = K.ui()
local checked = K.state(true)
Controls.Button({ text = "Кнопка из темы", variant = "primary" })
Controls.Checkbox({
    label = "Компонент из темы",
    checked = checked.value,
    on_change = function(v)
        checked.value = v
    end,
})]],
        {
            note = "Состав контракта и правила наследования описаны в docs/DESIGN_SYSTEM.md. Цвет и стиль текста также передаются через K.ContentColor и K.TextStyle.",
        }
    )
end
