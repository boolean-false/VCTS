-- Базовые элементы: Box, Row, Column, FlowRow, Text, Icon, Image, Spacer,
-- Canvas, Layout, TextInput, LazyColumn/LazyRow/LazyGrid, Popup.
--
-- Аргументы гибкие:
--   Box(function() ... end)
--   Box(M:padding(8), function() ... end)
--   Box({modifier = M:padding(8), align = "center"}, function() ... end)

local R = require "kompot:kompot/core/runtime"
local Mod = require "kompot:kompot/core/modifier"
local color = require "kompot:kompot/core/color"
local scroll = require "kompot:kompot/core/scroll"
local Th = require "kompot:kompot/theme"
local text = require "kompot:kompot/core/text"

local F = {}

local EMPTY = R.EMPTY

-- (a, b) -> props, content
local function args(a, b)
    if type(a) == "function" then
        return EMPTY, a
    end
    if a == nil then
        return EMPTY, b
    end
    if Mod.is(a) then
        return { modifier = a }, b
    end
    return a, b
end
F.args = args

local function mods(props)
    return props.modifier or props.mod or Mod
end

-- Контейнеры

-- props: modifier, align ("top_start" .. "bottom_end", "center"), propagate_min, key
function F.Box(a, b)
    local props, content = args(a, b)
    return R.emit(
        "box",
        mods(props),
        { align = props.align, propagate_min = props.propagate_min },
        content,
        props.key
    )
end

local function linear(kind, a, b)
    local props, content = args(a, b)
    local arrangement = props.arrangement
    local spacing = props.spacing
    if type(arrangement) == "number" then
        spacing, arrangement = arrangement, "start"
    end
    return R.emit(kind, mods(props), {
        arrangement = arrangement,
        spacing = spacing,
        align = props.align,
        fill_cross = props.fill_cross,
    }, content, props.key)
end

-- props: modifier, arrangement ("start"|"center"|"end"|"between"|"around"|"evenly"|число),
--        spacing, align (поперечная ось), fill_cross, key
function F.Row(a, b)
    return linear("row", a, b)
end
function F.Column(a, b)
    return linear("column", a, b)
end

-- Перенос по строкам. props: spacing, run_spacing, align
function F.FlowRow(a, b)
    local props, content = args(a, b)
    return R.emit(
        "flow",
        mods(props),
        { spacing = props.spacing, run_spacing = props.run_spacing, align = props.align },
        content,
        props.key
    )
end

-- Пустое место: Spacer(8) - квадрат, Spacer(M:weight(1)) - заполнитель.
function F.Spacer(a, b)
    if Mod.is(a) then
        return R.emit("spacer", a, EMPTY)
    end
    return R.emit("spacer", Mod:size(a or 0, b or a or 0), EMPTY)
end

-- Текст и изображения

local md_cache, md_cache_n = {}, 0

local function parse_md(s)
    local runs = md_cache[s]
    if not runs then
        runs = text.parse_md(s)
        md_cache_n = md_cache_n + 1
        if md_cache_n > 2000 then
            md_cache, md_cache_n = {}, 0
        end
        md_cache[s] = runs
    end
    return runs
end

local function build_runs(src, style, base_color)
    local runs = {}
    for i, r in ipairs(src) do
        local st = r.style and Th.style(r.style) or style
        local font = r.font or (r.bold and (st.bold or st.font)) or st.font
        runs[i] =
            { text = r.text or r[1] or "", font = font, color = color.of(r.color) or base_color }
    end
    return runs
end

-- Text("строка", props?)
-- props: style (имя стиля темы или {font, bold}), color, align ("start"|"center"|"end"),
--        max_lines, wrap (false - без переноса), ellipsis, font, modifier, key,
--        markup = "md" - разметка движка: [#RRGGBB] цвет, **жирный** (шрифт bold стиля),
--        spans = {{text, color?, style?, font?, bold?}, ...} - отрезки разного вида
function F.Text(s, props)
    props = props or EMPTY
    local style = props.style
    if type(style) == "string" then
        style = Th.style(style)
    end
    style = style or Th.LocalTextStyle:get()
    local c = color.of(props.color) or style.color or Th.LocalContentColor:get()
    local runs = nil
    if props.spans then
        runs = build_runs(props.spans, style, c)
    elseif props.markup == "md" then
        local src = parse_md(tostring(s or ""))
        if props.font then
            style = { font = props.font, bold = props.bold_font or style.bold }
        end
        runs = build_runs(src, style, c)
    end
    return R.emit("text", mods(props), {
        text = s,
        font = props.font or style.font,
        color = c,
        align = props.align,
        max_lines = props.max_lines,
        wrap = props.wrap,
        ellipsis = props.ellipsis,
        runs = runs,
    }, nil, props.key)
end

-- Image("atlas:name" | "texture/path", props?) props: width, height, size,
--   source_size = {width, height}, fit ("fill"|"contain"|"cover"), color, region.
-- Размер источника нужен для сохранения пропорций и режимов contain/cover.
function F.Image(src, props)
    props = props or EMPTY
    local fit = props.fit or "fill"
    assert(
        fit == "fill" or fit == "contain" or fit == "cover",
        "Image fit must be fill, contain or cover"
    )
    local source = props.source_size
    local sw, sh = source and (source[1] or source.width), source and (source[2] or source.height)
    if source or fit ~= "fill" then
        assert(
            type(sw) == "number" and sw > 0 and type(sh) == "number" and sh > 0,
            "Image source_size must contain positive width and height; contain/cover require source_size"
        )
    end
    return R.emit("image", mods(props), {
        src = src,
        width = props.width or props.size,
        height = props.height or props.size,
        color = color.of(props.color),
        region = props.region,
        fit = fit,
        source_width = sw,
        source_height = sh,
    }, nil, props.key)
end

-- Icon("name", props?) - иконка из атласа темы (theme.icons) или
-- "атлас:имя". Ядро не содержит иконок; источник задаёт дизайн-система.
function F.Icon(name, props)
    props = props or EMPTY
    local size = props.size or 20
    local src = name
    if not name:find(":", 1, true) then
        local atlas = Th.theme().icons
        assert(
            type(atlas) == "string" and atlas ~= "",
            "Icon requires theme.icons or an explicit atlas:name"
        )
        src = atlas .. ":" .. name
    end
    return R.emit("image", mods(props), {
        src = src,
        width = size,
        height = size,
        color = color.of(props.color) or Th.LocalContentColor:get(),
    }, nil, props.key)
end

-- Растровый холст: props.draw(canvas, w, h) рисует пиксели (Canvas движка:
-- set, line, rect, clear; image(src, opts) добавляет угол, масштаб и прозрачность.
-- Перерисовывается при смене props.version.
function F.Canvas(props)
    return R.emit("canvas", mods(props), {
        draw = props.draw,
        version = props.version,
        width = props.width,
        height = props.height,
    }, nil, props.key)
end

-- Пользовательская раскладка.
-- props.measure(children, minW, maxW, minH, maxH, api) -> w, h
--   api.measure(child, minW, maxW, minH, maxH) -> w, h;  api.place(child, x, y)
function F.Layout(props, content)
    return R.emit("layout", mods(props), { measure = props.measure }, content, props.key)
end

-- Нативное поле ввода текста.
-- props: value, on_change(text), on_submit(text), hint, font (false - шрифт движка "normal"),
--        color, lines (> 1 - многострочное), pad, modifier,
--        on_focus(), on_defocus() - фокус ввода (например, чтобы отключить горячие клавиши),
--        syntax ("lua" - подсветка), line_numbers, editable (по умолчанию true), wrap
function F.TextInput(props)
    local style = Th.LocalTextStyle:get()
    local font = props.font
    if font == nil then
        if props.syntax == "lua" then
            local mono = (Th.theme().type or {}).mono or Th.BASE.type.mono
            font = mono.font
        else
            font = style.font
        end
    end
    -- false - явный выбор резервного растрового шрифта движка.
    if font == false then
        font = "normal"
    end
    local wrap = props.wrap
    if wrap == nil then
        wrap = not (props.syntax and props.syntax ~= "")
    end
    return R.emit("field", mods(props), {
        text = props.value or "",
        on_change = props.on_change,
        on_submit = props.on_submit,
        hint = props.hint,
        font = font,
        color = color.of(props.color) or Th.LocalContentColor:get(),
        lines = props.lines,
        pad = props.pad,
        width = props.width,
        focus = props.focus,
        on_focus = props.on_focus,
        on_defocus = props.on_defocus,
        syntax = props.syntax,
        line_numbers = props.line_numbers,
        editable = props.editable ~= false,
        wrap = wrap,
        presentation = props.presentation,
        editor_state = props.editor_state,
        editor_value = props.editor_value,
        on_selection_change = props.on_selection_change,
    }, nil, props.key)
end

function F.new_text_field_state(initial)
    if initial == nil then
        initial = ""
    end
    assert(type(initial) == "string", "text_field_state expects a string")
    return R.new_state({ text = initial, anchor = 0, caret = 0 })
end

function F.text_field_state(initial)
    return R._remember("text_field_state", function()
        return F.new_text_field_state(initial)
    end)
end

-- Текстовое поле без оформления. Размер по lines/pad или явно через modifier.
-- state = K.state(string): текст обновляется извне даже при фокусе.
-- Альтернатива: value/on_change с локальным черновиком до потери фокуса.
-- editor_state связывает текст и направленное выделение одним снимком.
-- Остальные параметры совпадают с TextInput. Ввод обрабатывает нативный бэкенд.
F.BasicTextField = R.component(function(props)
    local state = props.state
    local editor = props.editor_state
    assert(
        editor == nil or R.is_state(editor),
        "BasicTextField.editor_state must be a Kompot state"
    )
    assert(
        editor == nil or (state == nil and props.value == nil),
        "use editor_state, state or value"
    )
    local snapshot = editor and editor.value
    if editor then
        assert(
            type(snapshot) == "table" and type(snapshot.text) == "string",
            "editor_state requires text"
        )
        for _, key in ipairs({ "anchor", "caret" }) do
            local v = snapshot[key]
            assert(
                type(v) == "number" and v >= 0 and v < math.huge and v % 1 == 0,
                "editor_state requires nonnegative integer " .. key
            )
        end
    end
    assert(state == nil or R.is_state(state), "BasicTextField.state must be a Kompot state")
    assert(state == nil or props.value == nil, "BasicTextField: use state or value, not both")
    local value = props.value
    if state then
        value = state.value
    elseif value == nil then
        value = ""
    end
    assert(type(value) == "string", "BasicTextField text must be a string")
    assert(
        props.lines == nil
            or (
                type(props.lines) == "number"
                and props.lines >= 1
                and props.lines < math.huge
                and props.lines % 1 == 0
            ),
        "BasicTextField.lines must be a positive integer"
    )
    local focused = R.state(false)
    local draft = R.state(nil)
    local mode = R.remember(function()
        return {}
    end)
    if mode.state ~= state or mode.editor ~= editor or mode.editable ~= props.editable then
        draft.value = nil
        mode.state, mode.editor, mode.editable = state, editor, props.editable
    end
    local p = {}
    for k, v in pairs(props) do
        p[k] = v
    end
    if editor then
        p.value, p.editor_value = snapshot.text, snapshot
    elseif state then
        p.value = state.value
    elseif focused.value and draft.value ~= nil then
        p.value = draft.value
    end
    p.on_change = function(value, selection)
        if props.editable == false then
            return
        end
        if editor then
            editor.value = { text = value, anchor = selection[1], caret = selection[2] }
        elseif state then
            state.value = value
        else
            draft.value = value
        end
        if props.on_change then
            props.on_change(value)
        end
    end
    p.on_focus = function()
        focused.value = true
        if props.on_focus then
            props.on_focus()
        end
    end
    p.on_defocus = function()
        focused.value = false
        draft.value = nil
        if props.on_defocus then
            props.on_defocus()
        end
    end
    return F.TextInput(p)
end)

-- Прокрутка

function F.scroll_state(initial)
    return R._remember("scroll_state", function()
        return scroll.new_scroll(initial)
    end)
end

function F.lazy_state()
    return R._remember("lazy_state", scroll.new_lazy)
end

-- Ленивый список.
-- props: count, item(i) (содержимое элемента), key_of(i) (ключ элемента), state, spacing,
--        pad (отступ в начале и конце), modifier, fill_cross (по умолчанию true)
local function lazy(axis, props)
    local state = props.state or F.lazy_state()
    local pad = props.pad or 0
    return R.emit(
        "lazy",
        mods(props):then_(Mod:clip()):then_(Mod:on_wheel(function(delta)
            return state:scroll_by(-delta * state.step) ~= 0
        end)),
        {
            axis = axis,
            count = props.count,
            item = props.item,
            key = props.key_of,
            state = state,
            spacing = props.spacing,
            owner = R.current_scope(),
            list_id = tostring(state):gsub("[^%w]", ""),
            pad_start = props.pad_start or pad,
            pad_end = props.pad_end or pad,
            fill_cross = props.fill_cross ~= false,
        },
        nil,
        props.key
    )
end

-- Ленивые списки - компоненты: своя область-владелец для элементов.
F.LazyColumn = R.component(function(props)
    return lazy(2, props)
end)
F.LazyRow = R.component(function(props)
    return lazy(1, props)
end)

-- Ленивая сетка с фиксированным числом колонок.
-- props: count, columns, item(i), spacing, state, modifier
local function lazy_grid(props)
    local cols = props.columns or 3
    local rows = math.ceil((props.count or 0) / cols)
    local spacing = props.spacing or 0
    local item = props.item
    return lazy(2, {
        count = rows,
        state = props.state,
        spacing = spacing,
        modifier = props.modifier,
        pad = props.pad,
        item = function(r)
            F.Row({ spacing = spacing, modifier = Mod:fill_max_width() }, function()
                for c = 1, cols do
                    local i = (r - 1) * cols + c
                    F.Box(Mod:weight(1), function()
                        if i <= props.count then
                            item(i)
                        end
                    end)
                end
            end)
        end,
    })
end

-- Всплывающие слои

local PLACEMENTS = {}

-- под якорем, с выравниванием по левому краю, в пределах экрана
function PLACEMENTS.below(anchor, w, h, W, H, gap)
    if not anchor then
        return (W - w) / 2, (H - h) / 2
    end
    local x = math.max(4, math.min(anchor.x, W - w - 4))
    local y = anchor.y + anchor.h + gap
    if y + h > H - 4 then
        y = anchor.y - h - gap
    end
    return x, math.max(4, y)
end

function PLACEMENTS.above(anchor, w, h, W, H, gap)
    if not anchor then
        return (W - w) / 2, (H - h) / 2
    end
    local x = math.max(4, math.min(anchor.x + (anchor.w - w) / 2, W - w - 4))
    local y = anchor.y - h - gap
    if y < 4 then
        y = anchor.y + anchor.h + gap
    end
    return x, y
end

function PLACEMENTS.right(anchor, w, h, W, H, gap)
    if not anchor then
        return (W - w) / 2, (H - h) / 2
    end
    return math.min(anchor.x + anchor.w + gap, W - w - 4),
        math.max(4, math.min(anchor.y, H - h - 4))
end

function PLACEMENTS.center(anchor, w, h, W, H)
    return (W - w) / 2, (H - h) / 2
end

function PLACEMENTS.fill()
    return 0, 0
end

-- Всплывающий слой поверх всего интерфейса, привязанный к месту вызова.
-- props: placement ("below"|"above"|"right"|"center"|"fill" | функция), gap, key,
--        z (порядок среди всплывающих слоёв: больше - выше; по умолчанию 0)
local function popup(props, content)
    local id = R.remember(function()
        return {}
    end)
    local anchor_id = tostring(id)
    -- якорь нулевого размера: привязка идёт к области родителя
    R.emit("anchor", Mod, { id = anchor_id })
    local rt = R.runtime()
    local holder = { kind = "box", mods = EMPTY, params = EMPTY, children = {} }
    local prev = R.current_parent()
    -- содержимое строится вне дерева
    R._set_current(rt, R.current_scope(), holder)
    local ok, err = pcall(content)
    R._set_current(rt, R.current_scope(), prev)
    if not ok then
        error(err, 0)
    end
    local placement = props.placement or "below"
    local place_fn = type(placement) == "function" and placement
        or PLACEMENTS[placement]
        or PLACEMENTS.below
    local gap = props.gap or 4
    R.add_overlay({
        node = holder,
        anchor = anchor_id,
        key = props.key or anchor_id,
        z = props.z,
        place = function(anchor, w, h, W, H)
            return place_fn(anchor, w, h, W, H, gap)
        end,
    })
end

F.LazyGrid = R.component(lazy_grid)
-- Всплывающий слой - компонент: он запоминает свой якорь, и условный
-- вызов не должен сдвигать хуки вызывающего.
F.Popup = R.component(popup)

return F
