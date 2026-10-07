# Своя дизайн-система для Kompot

Kompot отвечает за состояние, раскладку и ввод. Цвета, шрифты, формы и готовые
компоненты задаёт **дизайн-система**. Вы можете написать свою и распространять
её отдельным паком. Kompot UI уже входит в `kompot`, но ядро не подключает её
само.

Для текстурных панелей и кнопок ядро предоставляет `K.nine_patch`,
`K.raster` и `M:background_image`: [механизм скинов](SKINS.md).

## Из чего состоит дизайн-система

```
my_ds/
  package.json          {"id": "my_ds", "dependencies": ["kompot"]}
  preload.json          свои шрифты и атласы (необязательно)
  fonts/, textures/     ассеты
  modules/my_ds.lua     публичный модуль: theme(), компоненты
  modules/my_ds/        tokens.lua, components.lua, ui.lua
```

### 1. Тема

Тема - таблица. Ядро читает из неё только это:

| Поле | Зачем ядру |
|---|---|
| `type[имя] = {font, bold?, size?}` | `Text{style = "имя"}`; `bold` - шрифт для `**жирного**` в разметке md |
| `default_style` | Стиль текста по умолчанию (иначе `"body"`) |
| `colors.on_surface` | Цвет текста и иконок по умолчанию |
| `colors.background` | Фон превью |
| `ui` | Компоненты системы: их возвращает `K.ui()` |
| `icons` | Атлас дизайн-системы для `Icon("имя")`; ядро не задаёт его |
| `fonts` | Дополнительные шрифты для прогрева измерителя (шрифты из `type` прогреваются сами) |

Остальное - ваше: роли цветов, формы, отступы, тени, движение, размеры.
Компоненты читают эти токены через `K.theme()`.

```lua
local K = require "kompot:kompot"

local T = {}

function T.theme(opts)
    local base = {
        name = "pixel",
        colors = {
            background = K.hex("#20161A"),
            surface = K.hex("#3B2A2F"),
            surface_raised = K.hex("#56403F"),
            on_surface = K.hex("#F4E9D8"),
            muted = K.hex("#BFA99A"),
            primary = K.hex("#F2B84B"),
            on_primary = K.hex("#20161A"),
            outline = K.hex("#7A5E54"),
            error = K.hex("#E5533D"),
            success = K.hex("#7DBF5A"),
            warning = K.hex("#F2B84B"),
            wood = K.hex("#8B5A34"),
            wood_dark = K.hex("#5C3A21"),
        },
        type = {
            body = {font = "pixel_16"},
            label = {font = "pixel_16"},
            title = {font = "pixel_24"},
            caption = {font = "pixel_12"},
            heading = {font = "pixel_32"},
            mono = {font = "pixel_16"},
        },
        frame = {texture = "pixel_ui:frame", border = 6},
        ui = T.ui,
    }
    return K.extend_theme(base, opts or {})
end
```

Здесь `pixel_*` обозначает ваши ресурсы шрифтов. Их нужно объявить в
`preload.json`; см. [руководство по шрифтам](FONTS.md).
Для обычного текста и кода можно взять поставляемое Kompot семейство:
`K.fonts.resolve("kompot:sans", 16)` и
`K.fonts.resolve("kompot:mono", 16)` соответственно.

`K.extend_theme(base, overrides)` делает тему на основе другой (глубокое
слияние, цвета заменяются целиком). Так можно распространять варианты
одной системы.

### 2. Общие имена (переносимость)

Экран, который обращается только к общим именам, работает в любой системе.

**Роли цветов:** `background`, `surface`, `surface_raised`, `on_surface`,
`muted`, `primary`, `on_primary`, `outline`, `error`, `success`, `warning`.

**Стили текста:** `caption`, `body`, `label`, `title`, `heading`, `display`, `mono`.

Незнакомое имя стиля не ломает экран: `Text` берёт стиль по умолчанию.

### 3. Компоненты: общий набор `K.ui()`

`theme.ui` - таблица компонентов. Экран получает её через `local UI = K.ui()`
и не знает, какая система включена. Набор и свойства:

| Компонент | Свойства |
|---|---|
| `Button(props, content?)` | `text`, `icon`, `on_click`, `variant` (`primary`, `secondary`, `ghost`, `danger`), `enabled`, `modifier` |
| `IconButton` | `icon`, `on_click`, `selected`, `enabled`, `tooltip` |
| `Checkbox` | `checked`, `on_change(bool)`, `label`, `enabled` |
| `Switch` | `checked`, `on_change(bool)`, `label?` |
| `Slider` | `value`, `min`, `max`, `steps`, `on_change(v)`, `format(v)` |
| `TextField` | `value`, `on_change`, `on_submit`, `label`, `hint`, `supporting`, `error` |
| `Tabs` | `tabs`, `selected` (индекс), `on_select(i)` |
| `Segmented` | `options`, `selected` (индекс), `on_select(i)` |
| `Panel(props, content)` | `title`, `accent?`, `modifier` |
| `ListItem` | `headline`, `supporting`, `icon`, `trailing` (строка или функция), `on_click`, `selected` |
| `Divider` | - |
| `Badge` | `count` |
| `ProgressBar` | `progress` (0..1, `nil` - бегущая) |
| `Tooltip(props, content)` | `text` |
| `Dialog(props, content?)` | `visible`, `on_dismiss`, `title`, `text`, `confirm = {text, on_click, variant}`, `dismiss = {text, on_click}` |
| `Menu(props, content)` | `expanded`, `on_dismiss`, `width` |
| `MenuItem` | `text`, `icon`, `shortcut`, `on_click`, `enabled` |
| `Scrollbar` | `state` (`scroll_state` / `lazy_state`) |

Набор - это минимум для переносимости. Своих компонентов в системе может
быть сколько угодно: `ToolButton` и `Stepper` в Kompot UI, `FAB` и
`NavigationRail`.

Обычно `ui.lua` системы - тонкий слой над её компонентами. Он переводит общие
свойства в свои, например `variant = "secondary"` в нужный стиль кнопки.

### 4. Публичный модуль

```lua
-- modules/my_ds.lua
local T = require "my_ds:my_ds/tokens"
local C = require "my_ds:my_ds/components"
local UI = require "my_ds:my_ds/ui"

local DS = {tokens = T, ui = UI}
T.ui = UI
function DS.theme(opts)
    return T.theme(opts)
end
for name, fn in pairs(C) do
    DS[name] = fn
end
return DS
```

Подключение в моде:

```lua
local K = require "kompot:kompot"
local DS = require "my_ds:my_ds"

local function MyScreen()
    K.Text("Привет", {style = "body"})
end

local handle
function on_open()
    handle = K.mount({target = document.root, theme = DS.theme(), content = MyScreen})
end

function on_close()
    if handle then
        handle:dispose()
        handle = nil
    end
end
```

Полный пример пака с окном и клавишей есть в [первом экране](QUICKSTART.md).

## Как писать компоненты

- **Компонент с хуками - `K.component(fn)`.** Тогда у него своя область:
  его можно вызывать условно, в цикле с `K.key`, и он перестраивается
  отдельно.
- **Модификатор пользователя применяется первым.** Так `modifier = M:padding(8)`
  у кнопки становится внешним отступом:
  `(props.modifier or M):height(26):background(...)`.
- **Токены - из текущей темы.** Если компонент может оказаться в теме другой
  системы, берите запасную тему. Так делают обе готовые системы:
  ```lua
  local function current()
      local t = K.theme()
      return t.my_ds and t or DEFAULT
  end
  ```
- **Состояния наведения и нажатия.** `local inter = K.interaction()`, затем
  `M:clickable(fn, {interaction = inter})` и
  `K.animate(inter.hovered.value and hover or base, tween)`.
  Фон, рамку и прозрачность можно добавлять условно, в том числе перед
  `clickable`: смена оформления сохраняет нажатие, наведение и фокус.
  Если отступы объединяют или разделяют области ввода, нажатие в изменившейся
  области отменяется. Другой обработчик этот клик не получит.
  Сохраняйте порядок модификаторов ввода (`clickable`, `focusable`, `hoverable`
  и других). Для временного отключения `clickable` используйте `enabled = false`.
- **Клавиатура.** Кликабельные элементы с обработчиком `on_click` входят в
  порядок фокуса. Tab и Shift+Tab перемещают фокус, Enter и пробел вызывают
  обработчик, Escape снимает фокус. `inter.focused.value` позволяет менять
  оформление; видимая рамка фокуса появляется автоматически. Параметры
  `focusable = false`, `focus_color` и `focus_radius` у `M:clickable` управляют
  участием в навигации и рамкой. Для элементов без щелчка есть
  `M:focusable(function(key) ... end, {interaction = inter})`; слайдеры Kompot UI
  меняют значение стрелками.
- **Правая кнопка:** `M:clickable(fn, {on_right_click = fn2})`.
- **Необязательные модификаторы перетаскивания:** `M:draggable` и
  `M:drop_target` описывают только события ввода и попадание указателя в цель.
  Логика предметов, окон и других объектов остаётся в приложении.
- **Перетаскивание правой кнопкой:** `M:draggable({button = "right",
  on_event = function(e) if e.type == "start" then return item end end})`.
  Фазы `start`, `move`, `end`, `cancel` и цели `M:drop_target` работают
  так же, как для левой кнопки.
  После перетаскивания `on_right_click` не вызывается.
- **Перетаскивание на цель:** значение, возвращённое из `on_event` в фазе
  `start`, передаётся в
  `M:drop_target({on_enter = function(item) ... end,
  on_leave = function(item) ... end, on_drop = function(item) ... end})`.
  Цель определяется под указателем, даже когда источник удерживает ввод.
  `on_drop` может вернуть `false`, чтобы отклонить перенос. Цель под
  `M:block_pointer()` недоступна. Для игровых экранов добавьте
  `{focusable = false}` к `M:clickable`, если Tab не должен выбирать элементы.
- **Панель поверх мира:** `M:block_pointer()` на фоне панели. Щелчки не
  проходят «сквозь» неё, а `handle:is_over(x, y)` говорит моду, что курсор
  над интерфейсом, а не над миром.
- **Всплывающие слои:** `K.Popup({placement, z}, content)`. Порядок слоёв
  задаёт `z`: в Kompot UI меню - 20, подсказки - 30, диалоги - 10,
  уведомления - −1.
- **Разметка движка** в подписях: `Text(s, {markup = "md"})` понимает
  `[#RRGGBB]` и `**жирный**`, как `label markup="md"`.
- **Подложка точно по содержимому:** `M:match_parent_size()` у ребёнка `Box`.
  Так делаются подчёркивания вкладок, рамки выделения и подсветки.
- **Опрос обычного кода:** `K.poll(getter)` - область перестраивается,
  только когда значение изменилось. Это мост к нереактивному коду мода, как
  `supplier` в XML.

## Шрифты и превью

Для своей темы можно использовать шрифты Kompot или подключить свои.
Объявите их в `preload.json` и зарегистрируйте семейство, как показано
в [руководстве по шрифтам](FONTS.md).

Для проверки компонентов в редакторе объявите `K.preview` с темой вашей
дизайн-системы. Пример - в [руководстве по превью](PREVIEW.md).
