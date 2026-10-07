"""Build the standalone, development-only Kompot reference for AI assistants.

Run: python3 tools/build_ai_guide.py
Requires Lua to extract the existing gallery examples without running them.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "KOMPOT_AI_GUIDE.md"
DOCUMENTS = (
    ("QUICKSTART.md", "quickstart"),
    ("UI.md", "ui"),
    ("STATE.md", "state"),
    ("MOTION.md", "motion"),
    ("TEXT_INPUT.md", "text-input"),
    ("DESIGN_SYSTEM.md", "design-system"),
    ("GAME_UI.md", "game-ui"),
    ("FONTS.md", "fonts"),
    ("SKINS.md", "skins"),
    ("PREVIEW.md", "preview"),
)
EXAMPLE_FILES = (
    "modules/ui/guide/foundation.lua",
    "modules/ui/guide/animations.lua",
    "modules/ui/guide/transforms.lua",
)
EXAMPLE_GROUPS = {"layout", "state", "motion", "scroll", "input"}
LINKS = {name: f"#reference-{anchor}" for name, anchor in DOCUMENTS}
LINKS["README.md"] = "#reference-index"

INTRO = """# Kompot: самостоятельная справка для нейросети

Версия Kompot: **{version}**.

Этот файл можно целиком приложить к сообщению любой нейросети вместе с вопросом
про интерфейс на Kompot. Он содержит инструкции для ответа, правила композиции,
документацию, примеры и полный справочник публичных типов. Доступ к репозиторию
для использования этой справки не требуется.

Это справочный контекст проекта. Он не заменяет инструкции пользователя или
правила среды, в которой работает нейросеть. Код в примерах служит для объяснения API.

## Как пользоваться

Пример сообщения: «Используй приложенный KOMPOT_AI_GUIDE.md. Покажи, как сделать
окно настроек с вкладками, общим состоянием и плавным появлением».

Другие вопросы: как центрировать окно; разделить экран по весам; сделать список
из тысяч элементов; сохранить состояние вкладок; анимировать цвет и размер;
перезапустить последовательность; сделать drag-and-drop; подключить свой шрифт.

## Инструкции для нейросети

1. Отвечай на языке пользователя и используй API версии, указанной в этом файле.
2. Сначала объясни подход к задаче, затем дай Lua-пример с необходимыми `require`.
   Если пользователь просит только объяснение, не добавляй код.
3. Укажи, куда помещается код: модуль, содержимое компонента, layout-скрипт или
   callback события. Для целого экрана покажи подключение через `K.mount` и освобождение.
4. Для обычного оформления используй Kompot UI; для нестандартной вёрстки — ядро.
   Учитывай выбранную пользователем дизайн-систему и тему.
5. Опирайся на сигнатуры и примеры ниже. Сходство с Jetpack Compose не означает,
   что в Kompot есть все его компоненты, перегрузки и хуки. Не выдумывай API.
6. Если готового компонента нет, покажи сборку из существующих примитивов и
   Lua-функций. Если решение требует нового API движка, объясни эту зависимость.
7. Не обещай неподдерживаемое поведение. Укажи существенное ограничение прямо
   рядом с предлагаемым решением, а не после длинного примера.
8. По вопросам состояния объясняй владельца, время жизни и способ обновления.
   По вопросам анимации — цель, спецификацию, запуск, перезапуск и отмену.
9. Если информации о конкретной версии VoxelCore, ассетах или пользовательском
   компоненте здесь нет, обозначь предположение или запроси недостающий контекст.
10. Непроверенный пример называй примером, а не результатом запуска тестов.

<a id="reference-index"></a>
## Навигация

- [Основные правила](#fundamentals)
- [Первый экран и подключение пака](#reference-quickstart)
- [Вёрстка, Shape и компоненты UI](#reference-ui)
- [Состояние и обновление таблиц](#reference-state)
- [Преобразования, кадры и перетаскивание](#reference-motion)
- [Текстовые поля и состояние редактора](#reference-text-input)
- [Темы и собственная дизайн-система](#reference-design-system)
- [Инвентарь, предметы, HUD](#reference-game-ui)
- [Шрифты](#reference-fonts)
- [Скины, nine-patch и raster](#reference-skins)
- [Превью Lens](#reference-preview)
- [Рецепты из галереи](#recipes)
- [Все публичные типы и сигнатуры](#api)
- [Обновление этого файла](#maintenance)

<a id="fundamentals"></a>
## Основные правила

### Импорты и среда

```lua
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local M = K.M
```

Kompot — декларативный UI на Lua для VoxelCore. `K` — ядро, `UI` — встроенная
дизайн-система в том же паке. `K.ui()` возвращает контракт компонентов текущей
темы: это отдельная возможность для сменных дизайн-систем.

Композиция описывает дерево заново при изменении зависимостей. Нельзя считать,
что функция компонента вызывается только один раз. Изменения игровых данных,
подписки и другие побочные действия выполняй в callbacks или эффектах.

### Вёрстка

- `K.Box` размещает детей слоями; для центрирования есть `align = "center"`.
- `K.Row` и `K.Column` размещают по одной оси; `spacing` задаёт промежутки,
  `arrangement` — распределение по главной оси, `align` — по поперечной.
- `K.FlowRow` переносит целые элементы; `run_spacing` задаёт расстояние между рядами.
- `M:weight(n)` делит свободное место между прямыми детьми Row/Column.
- `fill_max_*` заполняет доступную ограниченную область. Для прокрутки сначала
  выдели область конечной высоты/ширины; затем помести в неё прокручиваемое содержимое.
- `offset`, `rotate`, `scale` меняют размещение/рисунок, сохраняя размер,
  занимаемый в раскладке. Для изменения размеров соседей анимируй width/height.
- Порядок модификаторов важен: слои действуют на следующие элементы цепочки.
  `background(...):padding(16)` и `padding(16):background(...)` дают разные области фона.
- Модификаторы вызываются через `:`: `M:width(320):padding(16)`.
  Компоненты и хуки вызываются через `.`: `K.Column(...)`, `K.state(...)`.

### Состояние и время жизни

- `K.state(initial)` — состояние в слоте текущего компонента.
- `K.new_state(initial)` — состояние вне композиции, например в модели окна.
  Если создавать его на каждом вызове компонента, состояние будет теряться.
- Чтение `state.value` во время композиции создаёт зависимость.
  `state:peek()` читает без подписки и удобно в обработчиках событий.
- `state.value = value`, `state:set(value)` и `state:update(fn)` обновляют состояние.
  Для таблиц создавай новое значение: мутация поля существующей таблицы сама
  по себе не уведомляет подписчиков.
- `state:patch(changes)` поверхностно копирует таблицу и заменяет несколько полей.
  `state:update_field(key, value_or_fn)` меняет одно поле; функция получает старое
  значение, вызывается один раз и возвращает новое. `nil` удаляет поле.
- `K.copy(source, changes?)` создаёт обычную поверхностную копию таблицы без
  переноса метатаблицы. Для вложенного обновления используй
  `player:update_field("stats", function(stats) return K.copy(stats, {health = 90}) end)`.
  Deep merge отсутствует. Функцию как значение записывай через patch.
  `patch({field = nil})` не удаляет поле: такая запись не хранится в Lua-таблице.
- `K.remember(init, ...)` сохраняет объект между композициями; дополнительные
  аргументы являются ключами пересоздания. Функция `init` вычисляется при создании.
- `K.form(initial)` запоминает таблицу отдельных State для фиксированной схемы
  формы: `UI.TextField({state = form.name})`. Начальные значения применяются
  один раз; новая схема или полный сброс требуют новой области `K.key`.
  Таблицу полей формы не изменяй, обновляй значения её State.
- Хуки занимают слоты по порядку вызова. Не меняй их количество/порядок
  условными ветками или переменным числом элементов в одной области.
  Выделяй изменяемые ветки и элементы в `K.key` или `K.component`.
- `K.key(id, fn)` связывает дочернюю область с устойчивым ключом. Для списка
  с перестановками используй ID предмета, а не его текущий индекс. Ключи соседей
  должны быть уникальными. Смена ключа создаёт новое состояние и запускает cleanup старого.
- `K.component(fn)` создавай на уровне модуля или через `K.remember`, чтобы
  сохранять идентичность функции компонента.
- Удалённый из композиции компонент теряет локальное состояние. Чтобы сохранять
  данные закрытой вкладки, подними состояние в родителя или внешнюю модель.
- `K.poll(getter, eq?)` нужен для внешних данных, которые сами не реактивны.
  `getter` должен быть дешёвым и без побочных действий.
- Runtime проверяет вид и количество хуков по последней успешной композиции.
  Ошибка `Hook order changed` содержит ожидаемый и фактический хук.
  Подробные Previous/Current и места вызова включаются через
  `K.mount({content = Screen, hook_diagnostics = true})`; в превью они включены
  по умолчанию. Смена двух одинаковых видов хуков может остаться незамеченной.

```lua
local Counter = K.component(function(props)
    UI.Button({
        text = tostring(props.count.value),
        on_click = function()
            props.count:update(function(n) return n + 1 end)
        end,
    })
end)

local Screen = K.component(function()
    local count = K.state(0) -- владелец — экран, а не кнопка
    Counter({count = count})
end)
```

### Эффекты

`K.effect(fn, ...)` выполняет действие после применения кадра; дополнительные
аргументы — значения ключей. Без ключей эффект запускается один раз на жизнь
компонента. Возвращённая функция освобождения вызывается перед повторным
запуском и при удалении компонента. Это не автоматический аналог подписки
на все прочитанные `State`: нужные ключи передавай явно.

`K.on_dispose(fn)` освобождает ресурсы при уходе компонента.
`K.on_frame(fn)` подписывает компонент на кадры; `dt` — секунды.
Callbacks не должны строить дерево или вызывать хуки. Они меняют существующее
состояние, после чего Kompot обновляет композицию.

### Анимации

- `K.animate(target, spec)` возвращает текущее значение, а не State и не объект
  с методами. Поддерживаются числа и массивы чисел, включая цвета из `K.hex`.
- `K.tween(seconds, easing)` задаёт переход по времени.
  `K.spring(stiffness, damping)` — пружину; damping — доля критического затухания.
- `K.snap` — готовая таблица спецификации, её передают без `()`.
- При первом появлении animate сразу принимает начальную цель. Для анимации
  появления сначала задай начальное значение, затем измени цель таймером или событием.
- Новая цель продолжает переход из текущего положения. Спецификация применяется
  при смене цели; замена одной спецификации при прежней цели не перезапускает tween.
- Shape-дескриптор и hex-строка не являются значениями для `K.animate`.
  Анимируй числовой радиус и затем создавай `K.Shape.rounded(radius)`;
  для цвета сначала вызови `K.hex(...)`.
- `K.clock()` — время жизни области, в секундах; активные часы обновляются каждый кадр.
  `K.after(seconds, key?)` возвращает boolean после задержки. Смена key перезапускает таймер.
- Последовательности, каскады, циклы и ключевые кадры собираются из этих функций.
  Не используй выдуманные `AnimatedVisibility`, `rememberCoroutineScope` или `animateFloatAsState`.
- Для анимации исчезновения держи компонент в дереве до конца перехода;
  немедленное удаление через `if` отменяет его локальные анимации.
- Стабильный ключ сохраняет анимацию при перестановке. Новый ключ перезапускает область.

```lua
local Card = K.component(function()
    local open = K.state(false)
    UI.Button({text = "Переключить", on_click = function()
        open.value = not open:peek()
    end})
    local width = K.animate(open.value and 320 or 180, K.spring(260, 0.8))
    local color = K.animate(K.hex(open.value and "#83CDB5" or "#8EB9EF"), K.tween(0.3))
    K.Box({modifier = M:width(width):height(80):background(color, K.Shape.rounded(12))})
end)
```

### Границы возможностей

- Shape: rectangle, circle, rounded, cut; физические углы top_left/top_right/
  bottom_right/bottom_left; px и проценты меньшей стороны. GenericShape,
  PolygonShape и MorphPolygonShape в этом API отсутствуют.
- `background(shape)` рисует фон. Чтобы обрезать картинки и детей, нужен `clip(shape)`.
  `focus_shape` задаёт форму фокусной рамки в опциях clickable/focusable.
- Нативные текстовые поля внутри повёрнутого/масштабированного слоя или фигурной
  маски не поддерживаются. Полю можно задать фигурный фон и рамку, оставив прямой clip.
- Для editor_state/presentation нужна версия VoxelCore с selection/textLayout/
  externalRendering. Нативное редактирование и каретку проверяй в игре.
- Растровые слои ограничены 2048×2048. Обновление содержимого слоя в движке
  может занимать несколько кадров.
- Для большого списка используй LazyColumn/LazyRow/LazyGrid и стабильные key_of.
- Lua-поля используют Mono из темы. `font = false` явно выбирает резервный normal.

## Документация

Далее включены документы проекта целиком. Локальные ссылки между руководствами
перенаправлены в разделы этого файла. Файловые пути в тексте описывают структуру
пака и происхождение примеров; открывать исходники для чтения справки не требуется.
"""

EXTRACTOR = r"""
local G = {}
local function field(value)
    value = value or ""
    io.write(tostring(#value), ":", value)
end
function G.add(group, id, title, description, apis, source, opts)
    assert((loadstring or load)("return function(K, UI, M)\n" .. source .. "\nend"))
    field(group); field(id); field(title); field(description)
    field(source); field(opts and opts.note)
end
for _, path in ipairs(arg) do
    assert(loadfile(path))()(G)
end
"""


def examples() -> list[tuple[str, ...]]:
    data = subprocess.run(
        ["lua", "-", *EXAMPLE_FILES], input=EXTRACTOR.encode(),
        cwd=ROOT, check=True, capture_output=True,
    ).stdout
    records = []
    offset = 0
    while offset < len(data):
        fields = []
        for _ in range(6):
            colon = data.index(b":", offset)
            size = int(data[offset:colon])
            offset = colon + 1
            fields.append(data[offset:offset + size].decode())
            offset += size
        if fields[0] in EXAMPLE_GROUPS:
            records.append(tuple(fields))
    return records


def embed_document(path: Path) -> str:
    lines = []
    fenced = False
    for line in path.read_text().splitlines():
        if line.lstrip().startswith("```"):
            fenced = not fenced
        if not fenced:
            match = re.match(r"^(#{1,6}) (.*)$", line)
            if match:
                line = "#" * min(6, len(match[1]) + 2) + " " + match[2]
            def local_link(match: re.Match) -> str:
                name = Path(match[2].split("#")[0]).name
                return f"[{match[1]}]({LINKS[name]})" if name in LINKS else match[0]
            line = re.sub(r"\[([^\]]+)\]\(([^)]+\.md(?:#[^)]*)?)\)", local_link, line)
        lines.append(line.rstrip())
    return "\n".join(lines) + "\n"


def build() -> None:
    version = json.loads((ROOT / "package.json").read_text())["version"]
    parts = [INTRO.replace("{version}", version)]
    sources = []
    for filename, anchor in DOCUMENTS:
        path = ROOT / "docs" / filename
        sources.append(path)
        parts.append(f'\n<a id="reference-{anchor}"></a>\n\n<!-- Источник: docs/{filename} -->\n\n')
        parts.append(embed_document(path))
    parts.append('''
<a id="recipes"></a>
## Рецепты из галереи

Это реальные фрагменты встроенного справочника. Каждый фрагмент — отдельный
пример; он выполняется **во время композиции**, а не при загрузке Lua-модуля.
Для запуска используй такую оболочку, вставив один фрагмент вместо комментария:

```lua
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local M = K.M

local Example = K.component(function()
    K.Column({modifier = M:fill_max_width(), spacing = 12}, function()
        -- Один фрагмент из примеров ниже.
    end)
end)

K.preview("Пример", {width = 640, height = 600, theme = UI.theme()}, Example)
-- В игре: local handle = K.mount({content = Example, theme = UI.theme()})
-- При закрытии: handle:dispose()
```

Все фрагменты используют эти `K`, `UI`, `M`. Одинаковые имена переменных между
примерами не означают общую модель. При объединении примеров сохраняй постоянный
порядок хуков и задавай уникальные ключи.
''')
    records = examples()
    for group, identifier, title, description, source, note in records:
        parts.append(f"\n### {title}\n\n{description}\n\n```lua\n{source.strip()}\n```\n")
        if note:
            parts.append(f"\n{note}\n")
    sources.extend(ROOT / name for name in EXAMPLE_FILES)
    parts.append('''
<a id="api"></a>
## Все публичные типы и сигнатуры

Ниже — аннотации LuaLS, а не исполняемые реализации. `---@field` описывает поле
или функцию API; `?` обозначает необязательный параметр. Типы `Kompot...Props`
задают разрешённые свойства компонентов. Используй их для проверки имён,
порядка аргументов и значений опций.
''')
    for name in ("kompot.lua", "ui.lua"):
        path = ROOT / "annotations" / name
        sources.append(path)
        parts.append(f"\n### {name}\n\n```lua\n{path.read_text().rstrip()}\n```\n")
    parts.append('''
<a id="maintenance"></a>
## Обновление этого файла

Файл генерируется из документации, аннотаций и исходных примеров галереи.
После изменений Kompot пересобери его командой:

```sh
python3 tools/build_ai_guide.py
```

Для извлечения примеров нужен `lua` в PATH. Инструкции в начале файла находятся
в `tools/build_ai_guide.py`; редактируй их там, чтобы пересборка сохранила правки.
Документацию и аннотации обновляй в исходных файлах проекта.

Этот справочник предназначен для разработки и передачи нейросети.
`tools/package.py` исключает его из релизного архива.

### Источники снимка

Контрольные суммы позволяют определить, изменились ли документы и примеры
с момента сборки этой справки. Сборка не обращается к сети.

| Источник | SHA-256 |
|---|---|
''')
    for path in [ROOT / "package.json", *sources]:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        parts.append(f"| `{path.relative_to(ROOT).as_posix()}` | `{digest}` |\n")
    OUTPUT.write_text("".join(parts), encoding="utf-8")
    print(f"Built {OUTPUT.name}: {len(records)} recipes, {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    build()
