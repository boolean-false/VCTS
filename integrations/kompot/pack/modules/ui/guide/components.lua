return function(G)
    G.add(
        "start",
        "welcome",
        "Первый интерфейс",
        "Нажмите кнопку. Состояние меняет только этот пример. Код ниже создаёт такой же интерфейс поверх игры.",
        { "K.mount", "K.state", "UI.Button", "K.Text" },
        [[local count = K.state(0)
K.Text("Привет, Kompot!", { style = "title" })
UI.Button({
    text = "Нажатий: " .. count.value,
    variant = "primary",
    modifier = M:tag("demo_counter"),
    on_click = function()
        count.value = count:peek() + 1
    end,
})]]
    )
    G.add(
        "controls",
        "buttons",
        "Кнопки",
        "Меняйте размер и доступность. Варианты переносятся на новую строку при недостатке места.",
        { "UI.Button", "UI.IconButton", "UI.ToolButton", "UI.Tooltip" },
        [[local size = K.state("md")
local enabled = K.state(true)
local count = K.state(0)
UI.Choice({
    options = { "sm", "md", "lg" },
    selected = size.value,
    on_select = function(v)
        size.value = v
    end,
})
UI.Checkbox({
    label = "Доступны",
    checked = enabled.value,
    on_change = function(v)
        enabled.value = v
    end,
})
K.FlowRow({ spacing = 8, run_spacing = 8 }, function()
    for _, variant in ipairs({ "default", "primary", "danger", "ghost", "toggle" }) do
        UI.Button({
            text = variant,
            variant = variant,
            size = size.value,
            enabled = enabled.value,
            selected = variant == "toggle" and count.value % 2 == 1,
            on_click = function()
                count.value = count:peek() + 1
            end,
        })
    end
    UI.IconButton({
        icon = "add",
        tooltip = "Добавить",
        enabled = enabled.value,
        on_click = function()
            count.value = count:peek() + 1
        end,
    })
    UI.ToolButton({ icon = "settings", selected = true, tooltip = "Настройки" })
end)
UI.Tooltip({ text = "Это обычная подсказка" }, function()
    UI.Key("Наведи указатель")
end)
K.Text("Нажатий: " .. count.value)]]
    )
    G.add(
        "controls",
        "choice",
        "Выбор и переключатели",
        "Checkbox и Switch связаны друг с другом. Выбор периода хранится отдельно.",
        { "UI.Checkbox", "UI.Switch", "UI.Choice", "UI.Segmented", "UI.Tabs" },
        [[local enabled = K.state(true)
local period = K.state(1)
local tab = K.state(1)
UI.Checkbox({
    label = "Включить звук",
    checked = enabled.value,
    on_change = function(v)
        enabled.value = v
    end,
})
UI.Switch({
    label = "То же состояние",
    checked = enabled.value,
    on_change = function(v)
        enabled.value = v
    end,
})
UI.Segmented({
    options = { "День", "Неделя", "Месяц" },
    selected = period.value,
    on_select = function(v)
        period.value = v
    end,
})
UI.Tabs({
    tabs = { "Общие", "Графика", "Звук" },
    selected = tab.value,
    on_select = function(v)
        tab.value = v
    end,
})
K.Text("Период: " .. period.value .. "; вкладка: " .. tab.value)]]
    )
    G.add(
        "controls",
        "numbers",
        "Слайдер и счётчик",
        "Ползунок меняет значение с шагом 5. Кнопки счётчика ограничивают количество диапазоном 0..10.",
        { "UI.Slider", "UI.Stepper", "UI.ProgressBar" },
        [[local volume = K.state(50)
local amount = K.state(3)
UI.Slider({
    label = "Громкость",
    value = volume.value,
    min = 0,
    max = 100,
    step = 5,
    on_change = function(v)
        volume.value = v
    end,
})
UI.ProgressBar({ progress = volume.value / 100 })
UI.Stepper({
    label = "Количество",
    value = amount.value,
    minus = "-",
    on_minus = function()
        amount.value = math.max(0, amount:peek() - 1)
    end,
    on_plus = function()
        amount.value = math.min(10, amount:peek() + 1)
    end,
})]]
    )
    G.add(
        "controls",
        "surfaces",
        "Панели и карточки",
        "Контейнеры с оформлением и область для изображения. Размер содержимого зависит от доступной ширины.",
        { "UI.Panel", "UI.Card", "UI.Preview", "UI.Section", "UI.Hint", "UI.Divider" },
        [[UI.Panel(
    { title = "Снаряжение", width = false, modifier = M:fill_max_width() },
    function()
        UI.Card({ modifier = M:fill_max_width() }, function()
            K.Column({ spacing = 8 }, function()
                UI.Section("Новый предмет")
                UI.Hint(
                    "Карточка может содержать произвольные компоненты."
                )
            end)
        end)
        UI.Divider()
        UI.Preview({
            src = "kompot_ui_icons:star",
            width = 160,
            height = 80,
            source_size = { 32, 32 },
            fit = "contain",
        })
    end
)]]
    )
    G.add(
        "controls",
        "split_pane",
        "Раздвижные панели",
        "Потяните разделитель между областями. Размер можно также менять стрелками, когда разделитель в фокусе.",
        { "UI.SplitPane", "M.draggable" },
        [[local width = K.state(180)
UI.SplitPane({
    modifier = M:fill_max_width():height(180),
    size = width.value,
    min_first = 100,
    min_second = 100,
    on_change = function(v)
        width.value = v
    end,
    first = function()
        K.Text("Навигация", { modifier = M:padding(12) })
    end,
    second = function()
        K.Text("Рабочая область", { modifier = M:padding(12) })
    end,
})
K.Text("Выбранная ширина: " .. math.floor(width.value))]],
        {
            note = 'orientation = "vertical" размещает области сверху и снизу. При нехватке места минимумы уменьшаются пропорционально; выбранный размер сохраняется.',
        }
    )
    G.add(
        "controls",
        "list_items",
        "Строки и слоты",
        "Выберите строку или предмет. Выделение принадлежит этому примеру.",
        { "UI.ListRow", "UI.ListItem", "UI.Slot", "UI.Badge" },
        [[local selected = K.state(1)
for i = 1, 3 do
    UI.ListRow({
        text = "Мир " .. i,
        selected = selected.value == i,
        on_click = function()
            selected.value = i
        end,
    })
end
UI.ListItem({
    headline = "Сохранённый мир",
    supporting = "Описание элемента",
    icon = "file",
    trailing = "12",
})
K.FlowRow({ spacing = 8, run_spacing = 8 }, function()
    for i, icon in ipairs({ "folder", "file", "settings", "star" }) do
        UI.Slot({
            icon = icon,
            badge = i,
            selected = selected.value == i,
            on_click = function()
                selected.value = i
            end,
        })
    end
    UI.Badge({ count = 12 })
end)]]
    )
    G.add(
        "controls",
        "dialogs",
        "Окна и диалоги",
        "Откройте окно или подтверждение. Результат действия появится в примере.",
        { "UI.Window", "UI.Dialog" },
        [[local window = K.state(false)
local dialog = K.state(false)
local result = K.state("Действие не выбрано")
K.FlowRow({ spacing = 8, run_spacing = 8 }, function()
    UI.Button({
        text = "Окно",
        on_click = function()
            window.value = true
        end,
    })
    UI.Button({
        text = "Подтверждение",
        modifier = M:tag("open_dialog"),
        on_click = function()
            dialog.value = true
        end,
    })
end)
K.Text(result.value)
UI.Window({
    visible = window.value,
    title = "Содержимое окна",
    modal = true,
    on_close = function()
        window.value = false
    end,
}, function()
    UI.Hint("Здесь можно разместить свой экран.")
end)
UI.Dialog({
    visible = dialog.value,
    title = "Применить настройки?",
    text = "Изменения вступят в силу сразу.",
    confirm = {
        text = "Применить",
        on_click = function()
            result.value = "Настройки применены"
            dialog.value = false
        end,
    },
    dismiss = { text = "Отмена" },
    on_dismiss = function()
        dialog.value = false
    end,
})]]
    )
    G.add(
        "controls",
        "floating_windows",
        "Перемещение и размер окон",
        "Откройте окно, потяните его за заголовок или измените размер за любой край и угол. Кнопки в заголовке работают отдельно.",
        { "UI.Window", "draggable", "resizable", "bounds", "on_bounds_change", "K.key" },
        [[local windows = K.state({})
local next_id = K.remember(function()
    return { value = 0 }
end)
UI.Button({
    text = "Открыть редактор",
    modifier = M:tag("open_floating_window"),
    on_click = function()
        next_id.value = next_id.value + 1
        local list = {}
        for _, id in ipairs(windows:peek()) do
            list[#list + 1] = id
        end
        list[#list + 1] = next_id.value
        windows.value = list
    end,
})
for _, id in ipairs(windows.value) do
    K.key(id, function()
        local bounds = K.state(nil)
        local text = K.state("Текст редактора " .. id)
        UI.Window({
            title = "Плавающий редактор " .. id,
            draggable = true,
            resizable = true,
            width = 520,
            height = 320,
            min_width = 300,
            min_height = 180,
            max_width = 900,
            max_height = 700,
            placement = function(_, w, h, W, H)
                local offset = ((id - 1) % 8) * 24
                return math.max(0, math.min((W - w) / 2 + offset, W - w)),
                    math.max(0, math.min((H - h) / 2 + offset, H - h))
            end,
            bounds = bounds.value,
            on_bounds_change = function(v)
                bounds.value = v
            end,
            modifier = M:tag("floating_window_" .. id),
            title_modifier = M:tag("floating_title_" .. id),
            on_close = function()
                local list = {}
                for _, other in ipairs(windows:peek()) do
                    if other ~= id then
                        list[#list + 1] = other
                    end
                end
                windows.value = list
            end,
            header = function()
                UI.Button({
                    text = "Очистить",
                    on_click = function()
                        text.value = ""
                    end,
                })
            end,
        }, function()
            K.Column({ modifier = M:fill_max_size(), spacing = 8 }, function()
                UI.Hint(
                    "Заголовок перемещает окно. Края и углы меняют размер."
                )
                K.BasicTextField({
                    state = text,
                    lines = 6,
                    wrap = true,
                    modifier = M:weight(1):fill_max_width():background(K.theme().colors.sunken),
                })
            end)
        end)
    end)
end]],
        {
            note = "Каждое нажатие создаёт независимый редактор. K.key сохраняет текст и геометрию остальных окон при закрытии одного из них.",
        }
    )
    G.add(
        "controls",
        "menus",
        "Меню",
        "Откройте контекстное меню или меню приложения. Недоступный пункт не выполняет действие.",
        { "UI.Menu", "UI.MenuItem", "UI.MenuDivider", "UI.MenuBar" },
        [[local open = K.state(false)
local active = K.state(nil)
local result = K.state("Выберите действие")
K.Box(function()
    UI.Button({
        text = "Действия",
        on_click = function()
            open.value = not open:peek()
        end,
    })
    UI.Menu({
        expanded = open.value,
        on_dismiss = function()
            open.value = false
        end,
    }, function()
        UI.MenuItem({
            text = "Открыть",
            icon = "folder",
            on_click = function()
                result.value = "Открыто"
                open.value = false
            end,
        })
        UI.MenuDivider()
        UI.MenuItem({ text = "Недоступно", enabled = false })
    end)
end)
UI.MenuBar({
    brand = "Пример",
    open = active.value,
    on_open = function(v)
        active.value = v
    end,
    menus = {
        {
            text = "Файл",
            items = {
                {
                    text = "Сохранить",
                    on_click = function()
                        result.value = "Сохранено"
                    end,
                },
            },
        },
    },
})
K.Text(result.value)]]
    )
    G.add(
        "controls",
        "feedback",
        "Индикаторы и уведомления",
        "Выберите тип уведомления. Его можно скрыть вручную. Неопределённый прогресс анимируется.",
        { "UI.Toast", "UI.ProgressBar", "UI.Bar", "UI.Key", "UI.key_chips" },
        [[local tone = K.state("info")
local message = K.state(nil)
K.FlowRow({ spacing = 6, run_spacing = 6 }, function()
    for _, name in ipairs({ "neutral", "info", "success", "warning", "error" }) do
        UI.Button({
            text = name,
            on_click = function()
                tone.value = name
                message.value = "Уведомление: " .. name
            end,
        })
    end
    UI.Button({
        text = "Скрыть",
        on_click = function()
            message.value = nil
        end,
    })
end)
UI.ProgressBar({})
UI.Bar({
    text = UI.key_chips({ { "Enter", "применить" }, { "ЛКМ", "выбрать" } }),
    right = "Готово",
})
UI.Toast({ text = message.value, tone = tone.value })]]
    )
    G.add(
        "fields",
        "text_fields",
        "Обычные поля",
        "Два поля используют один State. Проверьте ввод, внешнюю замену текста, многострочность и режим чтения.",
        { "UI.TextField", "UI.Field", "UI.LabeledField", "K.state" },
        [[local text = K.state("Привет")
local readonly = K.state(false)
UI.Checkbox({
    label = "Только чтение",
    checked = readonly.value,
    on_change = function(v)
        readonly.value = v
    end,
})
UI.TextField({
    state = text,
    label = "Название",
    editable = not readonly.value,
    supporting = "Изменения сразу видны в обоих полях",
})
UI.Field({ state = text, editable = not readonly.value })
UI.Button({
    text = "Заменить текст",
    on_click = function()
        text.value = "Новый текст"
    end,
})
local note = K.state("Первая строка\nВторая строка")
UI.TextField({ state = note, label = "Заметка", lines = 3 })]]
    )
    G.add(
        "fields",
        "validation",
        "Проверка и вектор",
        "Сообщение об ошибке зависит от введённого имени. VectorField возвращает номер оси и её текст.",
        { "UI.TextField", "UI.VectorField", "UI.LabeledField" },
        [[local name = K.state("")
local vector = K.state({ "1", "2", "3" })
UI.TextField({
    state = name,
    label = "Имя мира",
    error = name.value == "" and "Введите имя" or nil,
    supporting = "Имя не должно быть пустым",
})
UI.LabeledField({ label = "То же имя", state = name })
UI.VectorField({
    label = "Позиция",
    values = vector.value,
    on_change = function(axis, value)
        local next = { unpack(vector:peek()) }
        next[axis] = value
        vector.value = next
    end,
})]]
    )
    G.add(
        "fields",
        "basic_field",
        "Своё оформление поля",
        "BasicTextField связывает ввод с состоянием. Фон, рамку и размеры задаёт вызывающий код.",
        { "K.BasicTextField", "K.TextInput", "M.background", "M.border" },
        [[local text = K.state("Поле с собственной рамкой")
K.BasicTextField({
    state = text,
    pad = 10,
    modifier = M:fill_max_width():height(48):background("#172C35", 12):border(2, "#8AC6D3", 12),
})
K.Text("Состояние: " .. text.value)
K.TextInput({
    value = text.value,
    on_change = function(v)
        text.value = v
    end,
    modifier = M:fill_max_width():height(40),
})]]
    )
    G.add(
        "fields",
        "lua",
        "Lua и копирование",
        "UI.Lua показывает готовый код. Выделите текст мышью и скопируйте Ctrl+C. Нижнее поле позволяет редактировать Lua.",
        { "UI.Lua", "syntax", "line_numbers", "editable" },
        [[UI.Lua({ code = "local answer = 42\nreturn answer", line_numbers = true })
local source = K.state("local name = 'Kompot'\nreturn name")
UI.TextField({
    state = source,
    label = "Редактируемый код",
    lines = 4,
    syntax = "lua",
    line_numbers = true,
    wrap = false,
})]]
    )
    G.add(
        "fields",
        "editor_state",
        "Каретка и выделение",
        "Перемещайте каретку, выделяйте текст. Текст и направленное выделение синхронизируются одним снимком.",
        { "K.text_field_state", "K.new_text_field_state", "editor_state", "selection" },
        [[local editor = K.text_field_state("Привет, Kompot!")
UI.TextField({ editor_state = editor, lines = 3 })
K.Text("anchor: " .. editor.value.anchor .. "; caret: " .. editor.value.caret)
UI.Button({
    text = "Выделить первое слово",
    on_click = function()
        editor.value = { text = editor:peek().text, anchor = 6, caret = 0 }
    end,
})]],
        { requires = "text_presentation" }
    )
    G.add(
        "fields",
        "presentation",
        "Цветные диапазоны и каретка",
        "Наведите фокус на поле. Выберите форму каретки и измените текст. Первые пять символов имеют свой цвет.",
        { "presentation", "spans", "draw_caret", "selection_color" },
        [[local text = K.state("local answer = 42\nreturn answer")
local shape = K.state("bar")
UI.Choice({
    options = { "bar", "block", "underline" },
    selected = shape.value,
    on_select = function(v)
        shape.value = v
    end,
})
UI.TextField({
    state = text,
    lines = 4,
    font = K.style("mono").font,
    presentation = {
        spans = { { start = 0, finish = 5, color = "#E3AF67" } },
        selection_color = "#386F94AA",
        caret = { shape = shape.value, color = "#60D5FF90", blink = 0.5 },
        draw_caret = shape.value == "underline"
                and function(r)
                    return {
                        {
                            kind = "rect",
                            x = r[1],
                            y = r[2] + r[4] - 2,
                            w = r[3],
                            h = 2,
                            color = "#60D5FF",
                        },
                    }
                end
            or nil,
    },
})]],
        {
            requires = "text_presentation",
            note = "Диапазоны [start, finish) используют индексы символов нативного caret, начиная с нуля. Они меняют цвет, но не начертание. Нативная syntax-подсветка заменяется presentation.",
        }
    )
end
