# Игровые компоненты Kompot UI

```lua
local K = require "kompot:kompot"
local V = require "kompot:ui"
```

Компоненты принимают `props`, контейнеры - также `content()`.
`modifier` задаёт внешний модификатор Kompot. Цвета принимаются как hex
или массив RGBA 0..1. Все обработчики необязательны, если не указано иное.
Компоненты с состоянием изолированы через `K.component`.

## Игровые компоненты

| Компонент | Свойства |
|---|---|
| `ItemSlot` / `Slot` | `item`, `size`, `selected`, `enabled`, `locked`, `placeholder` (иконка), `keycap`, `tooltip`, `on_click`, `on_right_click`, `on_drag_event`, `drag_button`, `modifier` |
| `InventoryGrid` | `items`, `count`, `columns=8`, `gap=4`, `size`, `selected`, `on_select(index)`, `on_right_click(index)`, `on_move(from,to,item)`, `accepts(target,payload)`, `slot_props`, `tag_prefix`, `drag_group`, `modifier` |
| `Hotbar` | `items`, `selected=1`, `count=10`, `size`, `show_name=true`, `on_select(index)`, `modifier` |
| `ResourceBar` | `value=0`, `max=100`, `kind` (`health`, `energy`, `experience`), `color`, `label`, `text`, `segments=10`, `height=12`, `compact` (подпись над числом), `modifier` |
| `ActionHint` | `binding="E"`, `text`, `detail`, `modifier` |
| `ItemDetails` | `item`, `width=240`, `actions(item)` (содержимое), `modifier` |
| `MachinePanel` | `title`, `width=380`, `input`, `output`, `recipe`, `progress=0`, `running`, `energy`, `max_energy=100`, `status`, `on_input`, `on_output`, `on_start`, `accepts(payload)`, `on_drop(payload)`, `content()`, `modifier` |
| `HUD` | `items`, `selected`, `count=10`, `show_name`, `on_select`, `health`, `health_max`, `energy`, `energy_max`, `experience`, `experience_max`, `prompt` (props ActionHint), `modifier` |

### Формат предмета

```lua
{
    id = "my_pack:hammer",
    name = "Молот",
    src = "my_items:hammer",
    count = 1,                  -- число рисуется, если > 1
    durability = 0.75,          -- 0..1, необязательно
    rarity = "#EAC778",         -- цвет маркера, необязательно
    description = "Для обработки камня.",
}
```

Назначение `rarity` и игровых цветов определяет мод. Дизайн-система не приписывает
редкость предметам автоматически. `durability=0` рисует пустую шкалу.
`ResourceBar` ограничивает заполнение диапазоном 0..1 и рисует неполный
сегмент, если значение между границами.

### Простая сетка инвентаря

`InventoryGrid` показывает переданные предметы, но не меняет их сам.
В обработчике переноса создайте новый список и запишите его в состояние:

```lua
local Inventory = K.component(function()
    local items = K.state({
        [1] = {id = "my_pack:hammer", name = "Молот", src = "my_items:hammer"},
        [2] = {id = "my_pack:stone", name = "Камень", src = "my_items:stone", count = 8},
    })

    V.InventoryGrid({
        items = items.value,
        count = 8,
        columns = 4,
        on_move = function(from, to)
            local next_items = {}
            for index, item in pairs(items:peek()) do
                next_items[index] = item
            end
            next_items[from], next_items[to] = next_items[to], next_items[from]
            items.value = next_items
            return true
        end,
    })
end)
```

`count` нужен даже при пустых ячейках: оператор `#` не определяет нужную
длину списка с пропусками. Чтобы принять или отклонить перенос, `on_move`
возвращает `true` или `false`.

### Перетаскивание отдельного ItemSlot

Здесь `payload` означает данные переноса: сам предмет или таблицу с ним и
другими нужными модулю сведениями.

- `on_drag_event(e, item)` получает предмет и событие перетаскивания.
  В фазе `start` верните payload; в `move` доступны координаты и смещения;
  в `end` поле `e.accepted` сообщает результат переноса;
  в `cancel` поле `e.reason` объясняет отмену.
- `drag_button="right"` включает перенос правой кнопкой; по умолчанию левая.
- `accepts(payload)` возвращает `false`, если размещение запрещено.
- `on_drop(payload)` принимает перенос; `false` отклоняет его.

```lua
UI.ItemSlot({item = item, on_drag_event = function(e, source_item)
    if e.type == "start" then return source_item end
end})
```

Поля события описаны в [перетаскивании](MOTION.md#перетаскивание).

Источник показывает полупрозрачный предмет, а изображение переноса следует
за указателем. Цель получает зелёную или красную рамку. Заблокированные и
недоступные слоты не принимают действия. После завершения переноса
`on_click` не вызывается.

`InventoryGrid` передаёт payload `{index, item, group}`. По умолчанию `group`
уникален для сетки. Для связи сеток можно передать одинаковый `drag_group`,
но обработка источника, индексов и общего хранилища тогда принадлежит моду.
Для инвентарей с разными правилами удобнее отдельные `ItemSlot` и свой payload.

## Общий контракт K.ui()

Вызовы напрямую через V и через `K.ui()` оформляются в Voxel-стиле.
Прямой `V.Panel` дополнительно поддерживает полный API панели ниже.

| Компонент | Свойства |
|---|---|
| `Button` | `text`, `icon`, `trailing`, `variant=secondary` (`primary`, `secondary`, `ghost`, `danger`, `toggle`), `selected`, `enabled`, `size` (`sm`, `md`, `lg`), `compact`, `min_width`, `align`, `tooltip`, `on_click`, `on_right_click`, `modifier`; собственный `content()` |
| `IconButton` | `icon`, `size`, `selected`, `enabled`, `variant`, `tooltip`, `on_click`, `on_right_click` |
| `Checkbox`, `Switch` | `checked`, `label`, `enabled`, `on_change(bool)` |
| `Slider` | `value`, `min=0`, `max=1`, `steps` (число интервалов) или `step`, `label`, `format(value)`, `enabled`, `on_change(value)`, `on_change_end()` |
| `TextField` | `state` либо `value`/`on_change`, `on_submit`, `label`, `hint`, `supporting`, `error`, `editable`, `lines`, `height`, `font`, `syntax`, `line_numbers`, `wrap`, `on_focus`, `on_defocus` |
| `Tabs` | `tabs`, `selected` (индекс), `on_select(index)` |
| `Segmented` | `options`, `selected` (индекс), `on_select(index)` |
| `Panel` | `title`, `accent`, `variant`, `padding`, `modifier`, `content()` |
| `ListItem` | `headline`, `supporting`, `icon`, `trailing` (текст или функция), `selected`, `on_click` |
| `Divider` | `thickness`, `vertical`, `inset` |
| `Badge` | `count`, `color` |
| `ProgressBar` | `progress` 0..1, `nil` для неопределённого прогресса, `color`, `height` |
| `Tooltip` | `text`, `delay=0.45`, `placement`, `max_width`, `content()` |
| `Dialog` | `visible`, `title`, `text`, `on_dismiss`, `confirm={text,on_click,variant}`, `dismiss={text,on_click}`, `content()` |
| `Menu` | `expanded`, `on_dismiss`, `width=240`, `placement`, `gap`, `content()` |
| `MenuItem` | `text`, `icon`, `shortcut`, `enabled`, `on_click` |
| `Scrollbar` | `state` (Kompot scroll_state / lazy_state), `modifier` |

## Дополнительные контролы

| Компонент | Назначение и основные свойства |
|---|---|
| `Panel` | `width` (false - по ограничению родителя), `header()`, `icon`, `spacing`, `background`, `fill_height`, `content_modifier`, `title_modifier`. Вариант `flat` без поверхности; `accent` с дополнительным маркером |
| `Window` | `visible`, `title`, `width`, `height`, `on_close`, `modal`, `on_dismiss`, `placement`, `z`, `draggable`, `resizable`, `bounds={x,y,width,height}`, `on_bounds_change`, `min_width`, `min_height`, `max_width`, `max_height`, `content()` |
| `ToolButton` | Кнопка инструмента: `icon`, `selected`, `on_click`, `on_right_click`, `tooltip`, `tint` |
| `Choice` | Выбор значения: `options={{value,text,icon}}`, `selected`, `on_select(value)`, `columns`, `size` |
| `Stepper` | `label`, `value`, `on_minus`, `on_plus`, `minus`, `plus` |
| `Field` | Нативное поле без внешних подписей; свойства ввода как у TextField |
| `LabeledField` | Field с подписью слева; `label`, `label_width` |
| `VectorField` | Три поля; `values`, `labels`, `on_change(axis,text)`, `on_submit(axis,text)` |
| `Card` | `selected`, `on_click`, `padding`, `tooltip`, `content()` |
| `Preview` | `src`, `width`, `height`, `fit`, `source_size`, `region`, `placeholder`, `tooltip` |
| `Section` | Заголовок: `Section(text, props?)`, `modifier` |
| `Hint` | Строка пояснения: `Hint(text, props?)` |
| `Key` | Подпись клавиши: `Key("E")` |
| `Bar` | `text`, `right`, `height`, `color` |
| `Toast` | `text` (nil скрывает), `tone` (`neutral`, `info`, `success`, `warning`, `error`), `icon`, `width`, `top` |
| `MenuBar` | `brand`, `menus`, `actions()` |
| `MenuDivider` | Разделитель меню |
| `ListRow` | `text`, `selected`, `on_click`, `on_delete`, `trailing`, `icon` |
| `SplitPane` | Две области и регулируемый разделитель; [параметры и пример](UI.md#раздвижные-панели) |
| `Lua` | `code`, `title`, `lines`, `height`, `line_numbers`, `font`; выделение/копирование исходника |
| `key_chips` | `{{"ЛКМ", "выбрать"}, {"Esc", "закрыть"}}` → текст разметки для Bar/Text |

## Темизация

`V.theme(opts)`, `V.Theme(opts,content)`, `V.current()`, `V.DEFAULT`,
`V.PALETTE`, `V.TYPE`, `V.METRICS`, `V.tokens`, `V.ui`.

Параметры: `name`, `accent`, `density`, `panel_alpha`, `colors`, `type`,
`metrics`, `shapes`, `motion`, `components`, `ui`. Готовых цветовых
пресетов нет; мод задаёт свои цвета через `colors` или `accent`.
`components` задаёт значения по умолчанию по имени компонента;
явные свойства имеют приоритет. Игровые составные компоненты принимают
настройки через собственные props; ItemSlot также читает `components.ItemSlot`.

Особые роли цветов: `edge`, `shadow`, `health`, `energy`, `experience`.
Общие роли: `background`, `surface`, `surface_raised`, `on_surface`, `primary`,
`on_primary`, `outline`, `muted`, `error`, `warning`, `success`.

## Жизненный цикл

Галерея создаёт mount в `on_open` и освобождает в `on_close`.
Свой экран должен делать то же самое. Закрытие HUD из обработчика клика
откладывайте через `time.post_runnable`, чтобы не удалять дерево во время
обхода движком. Данные игры передавайте через `K.state`, `K.new_state` или
`K.poll`. Библиотека не записывает предметы или настройки в мир самостоятельно.

## Оформление поверхностей

Окна и контролы используют PNG-скин `textures/kompot_ui_skin/`: грань и зерно
привязаны к пикселям, углы прямые. `radius` не меняет геометрию этого скина.
Цвета и текстовые роли задаются через `V.theme()`. По умолчанию во всех
ролях используется семейство IBM Plex: Sans для обычного текста,
Mono для моноширинных надписей.
