# Шрифты

## Что входит в Kompot

Для обычного текста используются шрифты IBM Plex:

| Шрифт | Имя для `K.Text` |
|---|---|
| Sans - обычный текст | `kompot_<размер>` |
| Sans SemiBold - выделенный текст | `kompot_sb_<размер>` |
| Mono - моноширинные надписи | `kompot_mono_<размер>` |

Доступные размеры: **11, 12, 13, 14, 16, 20, 24, 32, 44**.

```lua
K.Text("Обычный текст", {font = "kompot_16"})
K.Text("Заголовок", {font = "kompot_sb_24"})
K.Text("123 / 456", {font = "kompot_mono_14"})
```

Компоненты выбирают шрифт из темы, поэтому указывать `font` для каждой
надписи необязательно. Для изменения размера выберите ресурс нужного размера,
например `kompot_24`.

`UI.Lua` и поля с `syntax = "lua"` по умолчанию используют стиль `mono`
текущей темы: IBM Plex Mono, 16 px во встроенной теме Kompot UI
(`kompot_mono_16`), 13 px в базовой теме ядра (`kompot_mono_13`).
Переопределение `theme.type.mono` применяется и к Lua-коду. Явный `font`
имеет приоритет; `font = false` оставлен для выбора резервного растрового
шрифта движка `normal`. В актуальном VoxelCore исправлена работа каретки
и выделения с векторным Mono, поэтому обходной выбор `normal` больше не нужен.

## Как подключить свой шрифт

### 1. Добавьте файлы в пак

Например, в паке `my_ui`:

```text
my_ui/
  fonts/
    My-Regular.ttf
    My-Semibold.ttf
  modules/
    fonts.lua
  preload.json
```

Подходят TTF и OTF. Проверьте, что лицензия позволяет распространять шрифт
вместе с вашим паком и что он содержит нужные символы.

### 2. Объявите размеры в `preload.json`

Добавьте записи в массив `fonts`, сохранив остальные настройки файла:

```json
{
  "fonts": [
    {"name": "my_sans_14", "path": "fonts/My-Regular.ttf", "size": 14},
    {"name": "my_sans_sb_14", "path": "fonts/My-Semibold.ttf", "size": 14}
  ]
}
```

`path` задаётся относительно вашего пака. Для каждого используемого размера
нужна отдельная запись.

### 3. Зарегистрируйте семейство

В `my_ui/modules/fonts.lua`:

```lua
local K = require "kompot:kompot"

K.fonts.register_family("my_ui:sans", {
    {name = "my_sans_14", file = "my_ui/fonts/My-Regular.ttf", size = 14},
    {name = "my_sans_sb_14", file = "my_ui/fonts/My-Semibold.ttf", size = 14, weight = "semibold"},
})
```

Здесь `name` и `size` должны совпадать с `preload.json`, а `file` включает
имя пака. Добавьте записи для остальных размеров, которые объявили.

### 4. Используйте шрифт

Загрузите модуль регистрации перед созданием интерфейса:

```lua
local K = require "kompot:kompot"
require "my_ui:fonts"

-- Внутри содержимого экрана или превью:
K.Text("Текст", {font = K.fonts.resolve("my_ui:sans", 14)})
K.Text("Выделенный текст", {font = K.fonts.resolve("my_ui:sans", 14, "semibold")})
```

Те же имена шрифтов можно указать в стилях своей [темы](DESIGN_SYSTEM.md).
Регистрация позволяет использовать шрифт и в игре, и в [превью](PREVIEW.md).

## Шрифт из PNG

Для растрового шрифта подготовьте страницы `pixel_0.png`, `pixel_1.png`
и далее, по 16×16 ячеек на страницу. Например, при размере ячейки 16 пикселей
размер страницы составляет 256×256.

В `preload.json` укажите общий префикс без номера страницы и расширения:

```json
{"fonts": [{"name": "my_pixel", "path": "fonts/pixel"}]}
```

Зарегистрируйте шрифт, указав размер ячейки и `kind = "bitmap"`:

```lua
K.fonts.register_family("my_ui:pixel", {
    {name = "my_pixel", file = "my_ui/fonts/pixel", size = 16, kind = "bitmap"},
})
```

После загрузки этого модуля используйте `K.Text("Текст", {font = "my_pixel"})`.
