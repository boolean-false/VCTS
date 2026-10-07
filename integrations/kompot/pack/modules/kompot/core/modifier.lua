-- Модификаторы: неизменяемая цепочка слоёв, как Modifier в Compose.
--
--   local M = kompot.Modifier
--   M:padding(8):background("#20242C", 12):clickable(on_click)
--
-- Порядок важен: слои применяются снаружи внутрь. padding перед background
-- даёт отступ снаружи фона, после - внутри.

local color = require "kompot:kompot/core/color"

local Corners = require "kompot:kompot/core/corners"

local Mod = {}
Mod.__index = Mod

local EMPTY = setmetatable({}, Mod)

local function chain(self, el)
    local n = #self
    local out = {}
    for i = 1, n do
        out[i] = self[i]
    end
    out[n + 1] = el
    return setmetatable(out, Mod)
end

function Mod.is(v)
    return getmetatable(v) == Mod
end

-- Поля слоя равны: то же значение или таблицы с теми же полями (цвета,
-- настройки). Функции сравниваются по ссылке: новый обработчик - другой слой.
local function field_equal(v, w)
    if v == w then
        return true
    end
    if type(v) ~= "table" or type(w) ~= "table" or getmetatable(v) ~= getmetatable(w) then
        return false
    end
    for k, x in pairs(v) do
        if w[k] ~= x then
            return false
        end
    end
    for k in pairs(w) do
        if v[k] == nil then
            return false
        end
    end
    return true
end

-- Цепочки с одинаковыми слоями. Модификатор - новая таблица при каждом
-- вызове; без сравнения по содержимому компонент с modifier в props
-- перезапускался бы при каждом перезапуске родителя.
function Mod.equals(a, b)
    if a == b then
        return true
    end
    local n = #a
    if n ~= #b then
        return false
    end
    for i = 1, n do
        local x, y = a[i], b[i]
        if x ~= y then
            for k, v in pairs(x) do
                if not field_equal(v, y[k]) then
                    return false
                end
            end
            for k in pairs(y) do
                if x[k] == nil then
                    return false
                end
            end
        end
    end
    return true
end

-- Склеивает две цепочки: self, затем other.
function Mod:then_(other)
    if not other or #other == 0 then
        return self
    end
    local out = {}
    for i = 1, #self do
        out[#out + 1] = self[i]
    end
    for i = 1, #other do
        out[#out + 1] = other[i]
    end
    return setmetatable(out, Mod)
end

-- Раскладка

-- padding(all) | padding(h, v) | padding(l, t, r, b) | padding{l=, t=, r=, b=, h=, v=}
function Mod:padding(a, b, c, d)
    local l, t, r, bt
    if type(a) == "table" then
        local h, v = a.h or a.horizontal or 0, a.v or a.vertical or 0
        l, t, r, bt =
            a.l or a.start or h, a.t or a.top or v, a.r or a["end"] or h, a.b or a.bottom or v
    elseif c ~= nil then
        l, t, r, bt = a, b, c, d
    elseif b ~= nil then
        l, t, r, bt = a, b, a, b
    else
        l, t, r, bt = a or 0, a or 0, a or 0, a or 0
    end
    return chain(self, { t = "padding", l = l, tp = t, r = r, b = bt })
end

-- Точный размер (в пределах ограничений родителя).
function Mod:size(w, h)
    h = h or w
    return chain(self, { t = "size", minw = w, maxw = w, minh = h, maxh = h })
end

function Mod:width(w)
    return chain(self, { t = "size", minw = w, maxw = w })
end

function Mod:height(h)
    return chain(self, { t = "size", minh = h, maxh = h })
end

function Mod:size_in(minw, maxw, minh, maxh)
    return chain(
        self,
        { t = "size", minw = minw, maxw = maxw, minh = minh, maxh = maxh, range = true }
    )
end

function Mod:width_in(min, max)
    return chain(self, { t = "size", minw = min, maxw = max, range = true })
end

function Mod:height_in(min, max)
    return chain(self, { t = "size", minh = min, maxh = max, range = true })
end

-- Размер без учёта ограничений родителя.
function Mod:required_size(w, h)
    h = h or w
    return chain(self, { t = "size", minw = w, maxw = w, minh = h, maxh = h, required = true })
end

function Mod:fill_max_width(f)
    return chain(self, { t = "fill", fw = f or 1 })
end

function Mod:fill_max_height(f)
    return chain(self, { t = "fill", fh = f or 1 })
end

function Mod:fill_max_size(f)
    return chain(self, { t = "fill", fw = f or 1, fh = f or 1 })
end

-- Снимает минимальные ограничения (содержимое по своему размеру).
function Mod:wrap_content()
    return chain(self, { t = "wrap" })
end

function Mod:aspect_ratio(ratio)
    return chain(self, { t = "aspect", ratio = ratio })
end

-- Сдвиг при размещении (размер не меняется).
function Mod:offset(x, y)
    return chain(self, { t = "offset", x = x or 0, y = y or 0 })
end

-- Доля свободного места в Row/Column.
function Mod:weight(w, fill)
    return chain(self, { t = "weight", w = w or 1, fill = fill ~= false })
end

-- Внутри Box: размер ровно как у Box, который меряется по остальным детям
-- (фон, рамка, подсветка поверх содержимого), как matchParentSize в Compose.
function Mod:match_parent_size()
    return chain(self, { t = "match" })
end

-- Выравнивание внутри Box (или по поперечной оси Row/Column).
function Mod:align(a)
    return chain(self, { t = "align", a = a })
end

function Mod:z_index(z)
    return chain(self, { t = "z", z = z })
end

-- Прокрутка содержимого. state - kompot.scroll_state().
function Mod:vertical_scroll(state)
    return chain(self, { t = "scroll", axis = 2, state = state })
end

function Mod:horizontal_scroll(state)
    return chain(self, { t = "scroll", axis = 1, state = state })
end

-- Отрисовка

-- Фон. shape: K.Shape, число (math.huge - капсула) или таблица
-- {top_left=0, top_right=0, bottom_right=0, bottom_left=0}.
function Mod:background(c, shape)
    return chain(self, { t = "bg", color = color.of(c), radius = Corners.of(shape) })
end

-- Фон из девяти частей не влияет на размеры элемента и обработку ввода.
function Mod:background_image(paint, tint)
    assert(
        type(paint) == "table" and paint.kind == "nine_patch",
        "background_image expects K.nine_patch(...)"
    )
    return chain(self, { t = "image_bg", paint = paint, color = color.of(tint) or color.WHITE })
end

-- Рамка внутри границ. shape - тот же формат, что у background
function Mod:border(width, c, shape)
    return chain(
        self,
        { t = "border", width = width or 1, color = color.of(c), radius = Corners.of(shape) }
    )
end

-- Мягкая тень под слоем. elevation - размытие в пикселях.
function Mod:shadow(elevation, shape, c, dy)
    return chain(self, {
        t = "shadow",
        blur = elevation or 8,
        radius = Corners.of(shape),
        color = color.of(c) or { 0, 0, 0, 0.35 },
        dy = dy or (elevation or 8) * 0.35,
    })
end

-- Точка опоры в долях размера; (0,0) - левый верх, (1,1) - правый низ
local function finite(n, name)
    assert(type(n) == "number" and n == n and math.abs(n) < math.huge, name .. " must be finite")
    return n
end
local function origin(pivot)
    pivot = pivot or {0.5, 0.5}
    return finite(pivot.x or pivot[1], "pivot x"), finite(pivot.y or pivot[2], "pivot y")
end
-- Вращение по часовой стрелке в градусах; размер раскладки сохраняется
function Mod:rotate(angle, pivot)
    local px, py = origin(pivot)
    return chain(self, {t="transform", angle=finite(angle,"angle"), sx=1, sy=1, px=px, py=py})
end
-- Масштаб рисунка и ввода; y по умолчанию равен x
function Mod:scale(x, y, pivot)
    local px, py = origin(pivot)
    return chain(self, {t="transform", angle=0, sx=finite(x,"scale x"), sy=finite(y or x,"scale y"), px=px, py=py})
end

-- Обрезка содержимого и ввода по форме; shape - K.Shape, число или таблица углов.
-- Без аргумента - прямоугольник. Фигурная маска не поддерживает native TextInput.
function Mod:clip(shape)
    return chain(self, { t = "clip", radius = Corners.of(shape) })
end

function Mod:alpha(a)
    return chain(self, { t = "alpha", a = a })
end

-- Ввод

-- opts: enabled, interaction (kompot.interaction()), cursor
-- opts: enabled, interaction, cursor, on_right_click (щелчок правой кнопкой)
function Mod:clickable(on_click, opts)
    opts = opts or {}
    return chain(self, {
        t = "click",
        on_click = on_click,
        enabled = opts.enabled ~= false,
        interaction = opts.interaction,
        cursor = opts.cursor or "pointer",
        on_long = opts.on_long_click,
        on_right = opts.on_right_click,
        focusable = opts.focusable ~= false and on_click ~= nil,
        focus_scope = opts.focus_scope == true,
        on_focus = opts.on_focus,
        on_defocus = opts.on_defocus,
        focus_color = color.of(opts.focus_color),
        focus_radius = Corners.of(opts.focus_shape or opts.focus_radius or 2),
    })
end

-- Клавиатурный фокус для элемента без on_click (например, слайдера).
-- on_key(key) получает enter, space, left, right, up, down.
function Mod:focusable(on_key, opts)
    opts = opts or {}
    return chain(self, {
        t = "focus",
        on_key = on_key,
        enabled = opts.enabled ~= false,
        interaction = opts.interaction,
        on_focus = opts.on_focus,
        on_defocus = opts.on_defocus,
        focus_color = color.of(opts.focus_color),
        focus_radius = Corners.of(opts.focus_shape or opts.focus_radius or 2),
    })
end

-- Область «под интерфейсом»: указатель над ней не проходит в мир
-- (handle:is_over) и не достаётся областям ниже. Для фона панелей.
function Mod:block_pointer()
    return chain(self, { t = "block" })
end

-- Отмечает наведение: interaction (hovered) или функция fn(bool).
function Mod:hoverable(target)
    return chain(self, { t = "hover", target = target })
end

-- opts: button ("right" или левая по умолчанию), axis (nil | 1 | 2), interaction.
-- on_event(event): start/move/end/cancel, локальные и родительские координаты, скорость.
-- Возвращённое в фазе start значение передаётся целям drop_target.
function Mod:draggable(opts)
    return chain(self, { t = "drag", opts = opts, cursor = opts.cursor or "pointer" })
end

-- Цель перетаскивания: on_enter(payload), on_leave(payload), on_drop(payload).
-- payload возвращает on_event в фазе start; on_drop может вернуть false для отказа.
function Mod:drop_target(opts)
    return chain(self, { t = "drop", opts = opts or {} })
end

-- Сырые события указателя: fn(event) где event.type = "down"|"up"|"move".
function Mod:pointer_input(fn)
    return chain(self, { t = "pointer", fn = fn })
end

-- Колесо: fn(delta) -> true, если событие поглощено.
function Mod:on_wheel(fn)
    return chain(self, { t = "wheel", fn = fn })
end

function Mod:cursor(name)
    return chain(self, { t = "cursor", cursor = name })
end

-- Прочее

-- fn(w, h) после раскладки, если размер изменился.
function Mod:on_size(fn)
    return chain(self, { t = "on_size", fn = fn })
end

-- fn(x, y, w, h) - абсолютная позиция после раскладки.
function Mod:on_placed(fn)
    return chain(self, { t = "on_placed", fn = fn })
end

-- Метка для тестов и превью.
function Mod:tag(name)
    return chain(self, { t = "tag", name = name })
end

return EMPTY
