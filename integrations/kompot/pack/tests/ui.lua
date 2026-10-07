-- Тесты дизайн-системы Kompot Kompot UI (без графики: приближённый измеритель текста и
-- бэкенд-регистратор). Движок нужен только как интерпретатор Lua.
app.config_packs({ "kompot" })
-- паки подключаются при создании мира
app.new_world("kompot_ui_test", "1", "core:default")

local K = require("kompot:kompot")
local UI = require("kompot:ui")
local recorder = require("kompot:kompot/backend/recorder")
local M = K.Modifier

local passed, failed = 0, 0
local function test(name, fn)
    local ok, err = xpcall(fn, debug.traceback)
    if ok then
        passed = passed + 1
    else
        failed = failed + 1
        print("FAIL " .. name .. ": " .. tostring(err))
    end
end

local function eq(a, b, what)
    if a ~= b then
        error((what or "value") .. ": expected " .. tostring(b) .. ", got " .. tostring(a), 2)
    end
end

local function new_app(content, w, h)
    local b = recorder.new()
    local a = K.App.new({
        content = content,
        backend = b,
        measurer = recorder.measurer(),
        width = w or 400,
        height = h or 300,
    })
    a:frame(0)
    return a, b
end

local function tag(a, name)
    local p = a:find_tag(name)
    assert(p, "tag " .. name .. " not found")
    return p
end

-- Клик в центр области с меткой name.
local function click(a, name)
    local p = tag(a, name)
    local x, y = p.x + p.w / 2, p.y + p.h / 2
    a:frame(0, { x = x, y = y, down = false })
    a:frame(0, { x = x, y = y, down = true })
    a:frame(0, { x = x, y = y, down = false })
end

local function field_of(b)
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            return p
        end
    end
    error("missing field")
end

test("icons come from the design system rather than the core", function()
    local a, b = new_app(function()
        K.Icon("kompot_ui_icons:star", { size = 20 })
        UI.Theme({}, function()
            K.Icon("star", { size = 20 })
        end)
        UI.IconButton({ icon = "settings" })
    end)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    local sources = {}
    for _, p in ipairs(b.dl) do
        if p.kind == "image" then
            sources[#sources + 1] = p.src
        end
    end
    eq(#sources, 3)
    eq(sources[1], "kompot_ui_icons:star")
    eq(sources[2], "kompot_ui_icons:star")
    eq(sources[3], "kompot_ui_icons:settings")
    local missing = new_app(function()
        K.Icon("star")
    end)
    assert(#missing.rt.errors > 0 and tostring(missing.rt.errors[1]):find("theme.icons", 1, true))
end)

test("a mod can replace a Kompot UI skin with a PNG", function()
    local a, b = new_app(function()
        UI.Theme({ skin = { panel = { src = "kompot_ui_skin:button", tint = false } } }, function()
            UI.Panel({ title = "Custom skin" }, function()
                K.Text("Content")
            end)
        end)
    end)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    local background = b:find("nine_patch", function(p)
        return p.paint.src == "kompot_ui_skin:button"
    end)
    assert(
        background and background.color[1] == 1 and background.color[2] == 1,
        "PNG skin override must use the supplied image without color tint"
    )
end)

test("editor_state changes text and directed selection atomically", function()
    local state = K.new_text_field_state("начало")
    local changed
    local a, b = new_app(function()
        K.BasicTextField({
            editor_state = state,
            on_change = function(v)
                changed = v
            end,
        })
    end)
    eq(field_of(b).text, "начало")
    field_of(b).on_change("новое", { 4, 1 })
    eq(state.value.text, "новое")
    eq(state.value.anchor, 4)
    eq(state.value.caret, 1)
    eq(changed, "новое")
    state.value = { text = "замена", anchor = 0, caret = 6 }
    a:frame(0)
    eq(field_of(b).text, "замена")
    eq(field_of(b).editor_value.caret, 6)
    a:dispose()
end)

test("presentation uses native advances, UTF-8 ranges and custom caret", function()
    local P = require "kompot:kompot/ui/text_presentation"
    local layout = {
        font = "normal",
        textHeight = 16,
        caretRect = { 19, 2, 9, 20 },
        selectionRects = { { 10, 2, 9, 20 } },
        lines = { { start = 4, text = "Жa", pos = { 10, 2 }, advances = { 9, 5 } } },
    }
    local context = { focused = true, editable = true, color = "#FFFFFF", caret_age = 0 }
    local options = {
        spans = { { start = 4, finish = 5, color = "#FF0000" } },
        caret = { shape = "block", blink = 0 },
    }
    local out = P.draw(layout, options, context)
    eq(#out, 4)
    eq(out[1].w, 9)
    eq(out[2].text, "Ж")
    eq(out[3].x, 19)
    eq(out[4].x, 19)
    eq(out[4].w, 9)
    options.caret = { blink = 0.5 }
    context.caret_age = 0.6
    eq(#P.draw(layout, options, context), 3, "blink")
    options.caret.blink = 0
    options.draw_caret = function(r)
        return {
            { kind = "rect", x = r[1], y = r[2] + r[4] - 2, w = r[3], h = 2, color = "#00FFFF" },
        }
    end
    out = P.draw(layout, options, context)
    eq(out[4].y, 20)
    eq(out[4].h, 2)
    context.focused = false
    eq(#P.draw(layout, options, context), 2, "unfocused decorations")
    context.hint = true
    out = P.draw(layout, {}, context)
    eq(out[1].color[4], 0.5, "hint opacity")
end)

test("BasicTextField synchronizes state, external edits and callbacks", function()
    local state = K.new_state("начало")
    local changed, submitted
    local a, b = new_app(function()
        K.BasicTextField({
            state = state,
            modifier = M:width(300):height(40),
            on_change = function(v)
                changed = v
            end,
            on_submit = function(v)
                submitted = v
            end,
        })
    end)
    eq(#b.dl, 1, "no decoration")
    field_of(b).on_focus()
    field_of(b).on_change("новый текст")
    a:frame(0)
    eq(state.value, "новый текст")
    eq(changed, state.value)
    eq(field_of(b).text, state.value)
    state.value = "внешнее изменение"
    a:frame(0)
    eq(field_of(b).text, state.value, "external update while focused")
    field_of(b).on_submit(state.value)
    eq(submitted, state.value)
    field_of(b).on_defocus()
    a:frame(0)
    eq(field_of(b).text, state.value)
end)

test("BasicTextField preserves value callback draft until defocus", function()
    local a, b = new_app(function()
        K.BasicTextField({ value = "original", modifier = M:width(300):height(40) })
    end)
    field_of(b).on_focus()
    field_of(b).on_change("draft")
    a:frame(0)
    eq(field_of(b).text, "draft")
    field_of(b).on_defocus()
    a:frame(0)
    eq(field_of(b).text, "original")
end)

test("TextField forwards state and read-only fields reject editing", function()
    local state = K.new_state("locked")
    local a, b = new_app(function()
        UI.TextField({
            state = state,
            editable = false,
            on_change = function()
                error("read-only callback")
            end,
        })
    end)
    field_of(b).on_change("unexpected")
    eq(state.value, "locked")
    state.value = "updated"
    a:frame(0)
    eq(field_of(b).text, "updated")
end)

test("two fields share state and refresh callbacks", function()
    local state, callback = K.new_state("start"), K.new_state(1)
    local called
    local a, b = new_app(function()
        local current = callback.value
        K.Column(function()
            for _ = 1, 2 do
                K.BasicTextField({
                    state = state,
                    on_change = function(v)
                        eq(state.value, v, "state updates before callback")
                        called = current
                    end,
                })
            end
        end)
    end)
    callback.value = 2
    a:frame(0)
    field_of(b).on_change("shared")
    a:frame(0)
    eq(called, 2, "fresh callback")
    local count = 0
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            count = count + 1
            eq(p.text, "shared")
        end
    end
    eq(count, 2)
end)

test("changing state identity and editable discards legacy drafts", function()
    local source = K.new_state(nil)
    local editable = K.new_state(true)
    local a, b = new_app(function()
        K.BasicTextField({
            state = source.value,
            value = source.value == nil and "external" or nil,
            editable = editable.value,
        })
    end)
    field_of(b).on_focus()
    field_of(b).on_change("draft")
    a:frame(0)
    editable.value = false
    a:frame(0)
    eq(field_of(b).text, "external")
    editable.value, source.value = true, K.new_state("first state")
    a:frame(0)
    eq(field_of(b).text, "first state")
    source.value = K.new_state("replacement state")
    a:frame(0)
    eq(field_of(b).text, "replacement state")
    source.value = nil
    a:frame(0)
    eq(field_of(b).text, "external", "stale draft not restored")
end)

test("accepted legacy edits survive defocus", function()
    local value = K.new_state("before")
    local a, b = new_app(function()
        UI.TextField({
            value = value.value,
            on_change = function(v)
                value.value = v
            end,
        })
    end)
    field_of(b).on_focus()
    field_of(b).on_change("after")
    a:frame(0)
    field_of(b).on_defocus()
    a:frame(0)
    eq(field_of(b).text, "after")
end)

test("BasicTextField rejects invalid contracts", function()
    for _, props in ipairs({
        { state = {} },
        { state = K.new_state("x"), value = "y" },
        { state = K.new_state(false) },
        { state = K.new_state(nil) },
        { value = 42 },
        { lines = 0 },
        { lines = 1.5 },
        { lines = math.huge },
        { editor_state = {} },
        { editor_state = K.new_state("x") },
        { editor_state = K.new_text_field_state(""), state = K.new_state("") },
        { editor_state = K.new_text_field_state(""), value = "" },
        { editor_state = K.new_state({ text = "x", anchor = -1, caret = 0 }) },
        { editor_state = K.new_state({ text = "x", anchor = 0, caret = 0.5 }) },
        { editor_state = K.new_state({ text = "x", anchor = 0, caret = math.huge }) },
    }) do
        local a = new_app(function()
            K.BasicTextField(props)
        end)
        assert(#a.rt.errors > 0, "invalid input accepted")
    end
end)

test("multiline height follows measurer and explicit size wins", function()
    local b = recorder.new()
    local measurer = recorder.measurer()
    measurer.field_line_height = function(_, font)
        return font == "normal" and 29 or 37
    end
    local a = K.App.new({
        backend = b,
        measurer = measurer,
        width = 600,
        height = 1000,
        content = function()
            K.Column(function()
                UI.TextField({ value = "a\nb", lines = 3, font = false })
                UI.TextField({ value = "a\nb", lines = 3, font = "kompot_24" })
                UI.Lua({ code = "a\nb", lines = 3 })
                UI.TextField({ value = "fixed", lines = 3, height = 75 })
            end)
        end,
    })
    a:frame(0)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    local fields = {}
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            fields[#fields + 1] = p
        end
    end
    eq(#fields, 4)
    eq(fields[1].h, 29 * 3 + 2 * fields[1].pad)
    eq(fields[2].h, 37 * 3 + 2 * fields[2].pad)
    eq(fields[3].h, fields[2].h, "Lua uses vector Mono line metrics")
    eq(fields[2].line_height, 37, "metric exported")
    eq(fields[4].h, 75, "explicit height")
end)

test("Lua uses a selectable read-only native code field", function()
    local source = 'local K = require "kompot:kompot"\n-- comment\nK.Text(42)'
    local a, b = new_app(function()
        K.Theme(UI.theme(), function()
            UI.Lua({ code = source, title = "Пример", line_numbers = true })
        end)
    end, 600, 200)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    local field
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            field = p
        end
    end
    assert(field, "native TextField")
    eq(field.text, source, "source preserved")
    eq(field.editable, false, "read-only")
    eq(field.syntax, "lua", "native syntax highlighting")
    eq(field.font, "kompot_mono_16", "theme monospace font")
    eq(field.line_numbers, true, "native line numbers")
    eq(field.multiline, true, "multiline")
end)

test("Lua fonts honor theme Mono, explicit overrides and the engine fallback", function()
    local function fonts_for(theme)
        local _, b = new_app(function()
            K.Theme(theme, function()
                K.Column(function()
                    UI.Lua({ code = "return 1" })
                    K.BasicTextField({ value = "return 2", syntax = "lua" })
                    UI.Lua({ code = "return 3", font = "kompot_mono_20" })
                    K.BasicTextField({ value = "return 4", syntax = "lua", font = "kompot_mono_24" })
                    UI.Lua({ code = "return 5", font = false })
                    K.BasicTextField({ value = "return 6", syntax = "lua", font = false })
                end)
            end)
        end)
        local fonts = {}
        for _, p in ipairs(b.dl) do if p.kind == "field" then fonts[#fonts + 1] = p.font end end
        return fonts
    end
    local fonts = fonts_for(UI.theme({type = {mono = {font = "kompot_mono_14", size = 14}}}))
    eq(table.concat(fonts, ","), "kompot_mono_14,kompot_mono_14,kompot_mono_20,kompot_mono_24,normal,normal")
    local _, b = new_app(function()
        K.Theme({type = {body = {font = "kompot_16"}}}, function()
            K.BasicTextField({value = "return 1", syntax = "lua"})
        end)
    end)
    eq(field_of(b).font, "kompot_mono_13", "missing theme Mono uses base Mono")
end)

test("TextField forwards native code options and remains editable by default", function()
    local a, b = new_app(function()
        UI.TextField({
            value = "return 42",
            syntax = "lua",
            line_numbers = true,
            font = false,
            lines = 3,
            height = 100,
        })
    end)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            eq(p.editable, true)
            eq(p.syntax, "lua")
            eq(p.line_numbers, true)
            eq(p.font, "normal")
            eq(p.h, 100)
            return
        end
    end
    error("missing field")
end)

-- Раскладка

test("slider responds to keyboard arrows", function()
    local value = K.new_state(0.5)
    local a = new_app(function()
        K.Theme(UI.theme(), function()
            UI.Slider({
                value = value.value,
                min = 0,
                max = 1,
                step = 0.1,
                on_change = function(v)
                    value.value = v
                end,
            })
        end)
    end)
    a:frame(0, { key = "tab" })
    assert(a.input.focus_key, "slider received focus")
    a:frame(0, { key = "right" })
    assert(math.abs(value:peek() - 0.6) < 0.0001, "right arrow increases value")
    a:frame(0, { key = "left" })
    assert(math.abs(value:peek() - 0.5) < 0.0001, "left arrow decreases value")
end)

test("every component composes in the Kompot UI theme", function()
    local a, b = new_app(function()
        K.Theme(UI.theme(), function()
            K.Column({ spacing = 6 }, function()
                UI.MenuBar({
                    brand = "KOMPOT UI",
                    menus = {
                        {
                            text = "Правка",
                            items = { { text = "Отменить", shortcut = "Ctrl+Z" } },
                        },
                    },
                    actions = function()
                        UI.Button({ text = "Выйти", variant = "danger" })
                    end,
                })
                UI.Bar({
                    text = UI.key_chips({ { "ЛКМ", "рисовать" } }),
                    right = "[#FFD84D]F10[#E8E6DF] справка",
                })
                UI.Panel({
                    title = "Панель",
                    accent = "#E3AF67",
                    header = function()
                        UI.IconButton({ icon = "close" })
                    end,
                }, function()
                    for _, v in ipairs({ "default", "primary", "danger", "ghost", "toggle" }) do
                        UI.Button({
                            text = v,
                            variant = v,
                            selected = v == "toggle",
                            icon = "add",
                            tooltip = "tip",
                        })
                    end
                    UI.Button({ text = "off", enabled = false })
                    UI.ToolButton({ icon = "edit", selected = true, tooltip = "Draw" })
                    UI.Checkbox({ checked = true, label = "Флажок" })
                    UI.Switch({ checked = true, label = "Тумблер" })
                    UI.Choice({
                        options = { { "a", "А" }, { "b", "Б" }, { "c", "В" } },
                        selected = "b",
                        columns = 2,
                    })
                    UI.Stepper({ label = "Сила", value = 3 })
                    UI.Slider({
                        value = 0.3,
                        label = "Доля",
                        format = function(v)
                            return v .. ""
                        end,
                    })
                    UI.Tabs({
                        tabs = { "Один", { text = "Два", icon = "star" } },
                        selected = 2,
                    })
                    UI.Field({ value = "text", hint = "hint" })
                    UI.LabeledField({ label = "Имя", value = "x" })
                    UI.VectorField({ label = "Позиция", values = { 1, 2, 3 } })
                    UI.ListRow({
                        text = "Строка",
                        on_delete = function() end,
                        trailing = "F1",
                    })
                    UI.Slot({ icon = "cube", selected = true, badge = 5 })
                    UI.Card({ on_click = function() end, selected = true }, function()
                        K.Text("card")
                    end)
                    UI.Section("Раздел")
                    UI.Hint("подсказка")
                    UI.Divider()
                    UI.ProgressBar({ progress = 0.4 })
                    UI.ProgressBar({})
                    UI.Badge({ count = 7 })
                    UI.Key("Ctrl")
                    UI.Preview({ width = 100, height = 40, placeholder = "нет превью" })
                end)
                UI.Toast({ text = "Готово" })
                K.Box(function()
                    UI.Menu({ expanded = true }, function()
                        UI.MenuItem({ text = "Копировать", shortcut = "Ctrl+C" })
                        UI.MenuDivider()
                        UI.MenuItem({ text = "Удалить", danger = true })
                    end)
                end)
                UI.Window({ title = "Окно", on_close = function() end, width = 300 }, function()
                    K.Text("w")
                end)
                UI.Dialog({
                    visible = true,
                    title = "Диалог",
                    text = "Текст",
                    confirm = { text = "OK" },
                    dismiss = { text = "Нет" },
                })
            end)
        end)
    end, 1000, 2400)
    for _ = 1, 20 do
        a:frame(1 / 30)
    end
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    assert(#b.dl > 100, "rendered primitives: " .. #b.dl)
end)

test("choice, stepper, checkbox and slider react to input", function()
    local sel, n, chk, val
    local a = new_app(function()
        K.Theme(UI.theme(), function()
            local s, st, ck, sl = K.state("a"), K.state(1), K.state(false), K.state(0)
            sel, n, chk, val = s, st, ck, sl
            K.Column({ spacing = 6, modifier = M:width(260) }, function()
                K.Box({ modifier = M:fill_max_width():tag("choice") }, function()
                    UI.Choice({
                        options = { { "a", "А" }, { "b", "Б" } },
                        selected = s.value,
                        on_select = function(v)
                            s.value = v
                        end,
                    })
                end)
                K.Box({ modifier = M:fill_max_width():tag("stepper") }, function()
                    UI.Stepper({
                        label = "N",
                        value = st.value,
                        on_minus = function()
                            st.value = st:peek() - 1
                        end,
                        on_plus = function()
                            st.value = st:peek() + 1
                        end,
                    })
                end)
                K.Box({ modifier = M:tag("check") }, function()
                    UI.Checkbox({
                        checked = ck.value,
                        label = "Флажок",
                        on_change = function(v)
                            ck.value = v
                        end,
                    })
                end)
                K.Box({ modifier = M:fill_max_width():tag("slider") }, function()
                    UI.Slider({
                        value = sl.value,
                        on_change = function(v)
                            sl.value = v
                        end,
                    })
                end)
            end)
        end)
    end)
    for _ = 1, 3 do
        a:frame(1 / 60)
    end
    local p = tag(a, "choice")
    local function press(x, y)
        a:frame(0, { x = x, y = y, down = false })
        a:frame(0, { x = x, y = y, down = true })
        a:frame(0, { x = x, y = y, down = false })
    end
    press(p.x + p.w * 0.75, p.y + p.h / 2)
    eq(sel:peek(), "b", "choice")
    p = tag(a, "stepper")
    press(p.x + p.w - 10, p.y + p.h / 2)
    eq(n:peek(), 2, "plus")
    click(a, "check")
    eq(chk:peek(), true, "checkbox")
    p = tag(a, "slider")
    press(p.x + p.w / 2, p.y + p.h - 8)
    assert(math.abs(val:peek() - 0.5) < 0.05, "slider " .. tostring(val:peek()))
end)

test("panels block the pointer, empty space does not", function()
    local a = new_app(function()
        K.Theme(UI.theme(), function()
            K.Box({ modifier = M:fill_max_size() }, function()
                UI.Panel({ title = "Панель", modifier = M:tag("panel") }, function()
                    UI.Hint("текст")
                end)
            end)
        end)
    end, 600, 400)
    local p = tag(a, "panel")
    assert(a.input:hit(a.regions, p.x + 100, p.y + 20), "panel is UI")
    assert(not a.input:hit(a.regions, 500, 350), "empty space is world")
end)

test("portable screen composes through K.ui() in Kompot UI", function()
    local a, b = new_app(function()
        K.Theme(UI.theme(), function()
            local UI = K.ui()
            UI.Panel({ title = "Панель" }, function()
                UI.Button({ text = "Основная", variant = "primary" })
                UI.Button({ text = "Вторая", variant = "secondary" })
                UI.IconButton({ icon = "heart", tooltip = "Нравится" })
                UI.Checkbox({ checked = true, label = "Флажок" })
                UI.Switch({ checked = true, label = "Тумблер" })
                UI.Slider({ value = 0.4, steps = 4 })
                UI.TextField({ label = "Имя", value = "Kompot", supporting = "подпись" })
                UI.Tabs({ tabs = { "А", "Б" }, selected = 1 })
                UI.Segmented({ options = { "1", "2" }, selected = 2 })
                UI.ListItem({
                    headline = "Строка",
                    supporting = "детали",
                    icon = "folder",
                    on_click = function() end,
                })
                UI.Divider()
                UI.ProgressBar({ progress = 0.5 })
                UI.Badge({ count = 3 })
                K.Box(function()
                    UI.Menu({ expanded = true }, function()
                        UI.MenuItem({ text = "Копировать", shortcut = "Ctrl+C" })
                    end)
                end)
            end)
        end)
    end, 800, 1200)
    for _ = 1, 10 do
        a:frame(1 / 30)
    end
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    local texts = table.concat(b:texts(), "|")
    assert(
        texts:find("Основная", 1, true) and texts:find("Ctrl+C", 1, true),
        "texts rendered"
    )
end)

test("Kompot UI components fall back to their theme inside another theme", function()
    local a = new_app(function()
        UI.Panel({ title = "Без темы" }, function()
            UI.Button({ text = "ok" })
        end)
    end)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
end)

test("themes own their tokens and accept semantic roles", function()
    local a = UI.theme({
        colors = { primary = "#FF8800", surface = "#223344", on_surface = "#FFFFFF" },
        type = { body = { font = "kompot_20" } },
        metrics = { control = 38 },
        shapes = { control = 5 },
    })
    local b = UI.theme()
    local seed = K.hex("#FF8800")
    local from_seed = UI.theme({ accent = seed })
    from_seed.colors.primary[1] = 0
    eq(seed[1], 1, "accent table is not shared")
    eq(K.color.to_hex(a.colors.accent), "#FF8800FF", "semantic primary")
    eq(K.color.to_hex(a.colors.panel), "#223344FF", "semantic surface")
    eq(K.color.to_hex(a.colors.text), "#FFFFFFFF", "semantic content color")
    assert(not K.color.equals(a.colors.action, b.colors.action), "action follows primary")
    a.colors.text[1] = 0
    a.type.body.font = "changed"
    a.metrics.control = 99
    eq(b.type.body.font, UI.TYPE.body.font, "independent typography")
    eq(b.metrics.control, UI.METRICS.control, "independent metrics")
    assert(b.colors.text[1] > 0, "independent colors")
    eq(
        K.color.to_hex(
            UI.theme({ accents = { custom = "#E3AF67" }, accent = "custom" }).colors.primary
        ),
        "#E3AF67FF",
        "mod-defined accent"
    )
    assert(not pcall(function()
        UI.theme({ accent = "orange" })
    end), "no built-in accent presets")
end)

test("nested themes affect rendering and restore the parent", function()
    local a, b = new_app(function()
        UI.Theme({ colors = { on_surface = "#AA1122" } }, function()
            K.Column({ spacing = 8 }, function()
                UI.Button({ text = "parent", modifier = M:tag("parent") })
                UI.Theme({
                    colors = { on_surface = "#11CC44" },
                    type = { body = { font = "kompot_20" } },
                    metrics = { control_lg = 40 },
                    shapes = { control = 7 },
                    components = { Button = { size = "lg" } },
                }, function()
                    UI.Button({ text = "child", modifier = M:tag("child") })
                    UI.Button({ text = "explicit", size = "sm", modifier = M:tag("explicit") })
                end)
                UI.Button({ text = "restored", modifier = M:tag("restored") })
            end)
        end)
    end)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    eq(tag(a, "child").h, 40, "theme size defaults")
    eq(tag(a, "explicit").h, UI.METRICS.control_sm, "explicit size wins")
    eq(tag(a, "restored").h, UI.METRICS.control, "restored size")
    local child = b:find("text", function(p)
        return p.text == "child"
    end)
    local parent = b:find("text", function(p)
        return p.text == "parent"
    end)
    local restored = b:find("text", function(p)
        return p.text == "restored"
    end)
    eq(child.font, "kompot_20", "theme font used by the actual button")
    assert(K.color.equals(child.color, K.hex("#11CC44")), "child content color")
    assert(K.color.equals(parent.color, restored.color), "parent color restored")
    assert(b:find("nine_patch"), "game skin renders a shared image background")
end)

test("contract replacements inherit all other components", function()
    local a, b = new_app(function()
        UI.Theme({
            ui = {
                Button = function(props)
                    K.Text("custom " .. props.text)
                end,
            },
        }, function()
            K.Column(function()
                K.ui().Button({ text = "button" })
                K.ui().Checkbox({ checked = true, label = "still available" })
                UI.Button({ text = "original" })
            end)
        end)
    end)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    local texts = table.concat(b:texts(), "|")
    assert(
        texts:find("custom button", 1, true)
            and texts:find("still available", 1, true)
            and texts:find("original", 1, true),
        texts
    )
end)

test("density switches preserve explicit sizes and inherit locally", function()
    local a = new_app(function()
        UI.Theme({ density = "compact", metrics = { control = 31 } }, function()
            K.Column(function()
                UI.Theme({ accent = "#E3AF67" }, function()
                    UI.Button({ text = "inherit", modifier = M:tag("inherit") })
                end)
                UI.Theme({ density = "compact" }, function()
                    UI.Button({ text = "same", modifier = M:tag("same") })
                end)
                UI.Theme({ density = "comfortable", metrics = { control_sm = 33 } }, function()
                    UI.Button({ text = "normal", modifier = M:tag("normal") })
                    UI.Button({ text = "small", size = "sm", modifier = M:tag("small") })
                end)
                UI.Button({ text = "restore", modifier = M:tag("restore") })
            end)
        end)
    end)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    eq(tag(a, "inherit").h, 31)
    eq(tag(a, "same").h, 31)
    eq(tag(a, "normal").h, 36)
    eq(tag(a, "small").h, 33)
    eq(tag(a, "restore").h, 31)
    eq(UI.theme({ density = "compact" }).metrics.control, 26)
end)

test("primary buttons remain readable with light and dark accents", function()
    for _, accent in ipairs({ "#102040", "#E3AF67", "#8AC6D3" }) do
        local theme = UI.theme({ accent = accent })
        local a, b = new_app(function()
            K.Theme(theme, function()
                UI.Button({ text = "primary", variant = "primary" })
            end)
        end)
        local text = b:find("text", function(p)
            return p.text == "primary"
        end)
        assert(K.color.contrast(theme.colors.action, text.color) >= 4.5, "primary text contrast")
        assert(b:find("nine_patch"), "primary image background")
        assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    end
    local custom = UI.theme({ accent = "#E3AF67", colors = { on_primary = "#123456" } })
    eq(K.color.to_hex(custom.colors.on_primary), "#123456FF", "explicit foreground")
end)

test("dialog and toast accents are optional and theme defaults apply", function()
    for _, variant in ipairs({ "plain", "accent" }) do
        local a, b = new_app(function()
            UI.Theme(
                { components = { Toast = { tone = "warning", variant = variant } } },
                function()
                    UI.Toast({ text = "Notification" })
                    UI.Dialog({
                        visible = true,
                        title = "Dialog",
                        text = "Message",
                        variant = variant,
                    })
                end
            )
        end, 800, 600)
        for _ = 1, 20 do
            a:frame(1 / 30)
        end
        assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
        local stripes = 0
        for _, p in ipairs(b.dl) do
            if p.kind == "rect" and p.w == UI.METRICS.stripe_w then
                stripes = stripes + 1
            end
        end
        eq(stripes, variant == "accent" and 2 or 0, "explicit accent stripes")
        assert(
            b:find("text", function(p)
                return p.text == "Notification"
            end),
            "toast text"
        )
    end
end)

test("panel accent color draws a stripe only with the accent variant", function()
    local a, b = new_app(function()
        UI.Panel({ title = "Plain", accent = "#59CCFF" })
        UI.Panel({ title = "Accent", accent = "#59CCFF", variant = "accent" })
    end, 800, 600)
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
    local stripes = 0
    for _, p in ipairs(b.dl) do
        if p.kind == "rect" and p.w == UI.METRICS.stripe_w then
            stripes = stripes + 1
        end
    end
    eq(stripes, 1, "only explicit accent variant draws a stripe")
end)

test("SplitPane drag, bounds, keyboard and viewport resize", function()
    local size = K.new_state(180)
    local enabled = K.new_state(true)
    local a = new_app(function()
        UI.SplitPane({
            size = size.value,
            enabled = enabled.value,
            min_first = 100,
            min_second = 120,
            max_first = 300,
            divider_modifier = M:tag("split"),
            on_change = function(v)
                size.value = v
            end,
            first = function()
                K.Box({ modifier = M:fill_max_size():tag("first") })
            end,
            second = function()
                K.Box({ modifier = M:fill_max_size():tag("second") })
            end,
        })
    end, 600, 240)
    eq(tag(a, "first").w, 180)
    eq(tag(a, "second").w, 408)
    local function drag(dx)
        local p = tag(a, "split")
        local x, y = p.x + p.w / 2, p.y + 20
        a:frame(0, { x = x, y = y, down = false })
        a:frame(0, { x = x, y = y, down = true })
        a:frame(0, { x = x + dx, y = y, down = true })
        a:frame(0, { x = x + dx, y = y, down = false })
    end
    drag(60)
    eq(size.value, 240)
    eq(tag(a, "first").w, 240)
    drag(1000)
    eq(size.value, 300)
    drag(-1000)
    eq(size.value, 100)
    click(a, "split")
    a:frame(0, { key = "right" })
    eq(size.value, 110)
    size.value = 280
    a:frame(0)
    a:set_size(200, 240)
    a:frame(0)
    assert(tag(a, "first").w >= 0 and tag(a, "second").w >= 0)
    eq(tag(a, "first").w + tag(a, "second").w + tag(a, "split").w, 200)
    eq(size.value, 280, "resize preserves preferred size")
    a:set_size(600, 240)
    a:frame(0)
    eq(tag(a, "first").w, 280)
    enabled.value = false
    a:frame(0)
    drag(-40)
    eq(size.value, 280, "disabled divider")
    a:dispose()
end)

test("SplitPane vertical and internal size", function()
    local a = new_app(function()
        UI.SplitPane({
            orientation = "vertical",
            default_size = 80,
            divider_modifier = M:tag("split"),
            min_first = 40,
            min_second = 50,
            first = function()
                K.Box({ modifier = M:fill_max_size():tag("first") })
            end,
            second = function()
                K.Box({ modifier = M:fill_max_size():tag("second") })
            end,
        })
    end, 300, 240)
    eq(tag(a, "first").h, 80)
    eq(tag(a, "second").y, 92)
    local p = tag(a, "split")
    local x, y = p.x + 20, p.y + p.h / 2
    a:frame(0, { x = x, y = y, down = true })
    a:frame(0, { x = x + 80, y = y + 30, down = true })
    a:frame(0, { x = x + 80, y = y + 30, down = false })
    eq(tag(a, "first").h, 110, "vertical drag ignores x")
    eq(tag(a, "second").h, 118)
    click(a, "split")
    a:frame(0, { key = "up" })
    eq(tag(a, "first").h, 100)
    a:dispose()
end)

local function drag_at(a, x, y, dx, dy)
    a:frame(0, { x = x, y = y, down = false })
    a:frame(0, { x = x, y = y, down = true })
    a:frame(0, { x = x + dx, y = y + dy, down = true })
    a:frame(0, { x = x + dx, y = y + dy, down = false })
end

test("Window moves by title, clamps to viewport and keeps buttons clickable", function()
    local closed, clicks = 0, 0
    local a = new_app(function()
        UI.Window({
            title = "Move",
            draggable = true,
            width = 300,
            height = 180,
            modifier = M:tag("window"),
            title_modifier = M:tag("title"),
            on_close = function()
                closed = closed + 1
            end,
            header = function()
                UI.Button({
                    text = "Action",
                    modifier = M:tag("action"),
                    on_click = function()
                        clicks = clicks + 1
                    end,
                })
            end,
        }, function()
            K.Text("Body")
        end)
    end, 800, 600)
    for _ = 1, 6 do
        a:frame(0.1)
    end
    local before, title = tag(a, "window"), tag(a, "title")
    drag_at(a, title.x + 10, title.y + 12, 45, 30)
    eq(tag(a, "window").x, before.x + 45)
    eq(tag(a, "window").y, before.y + 30)
    click(a, "action")
    eq(clicks, 1)
    eq(tag(a, "window").x, before.x + 45, "header button must not drag")
    title = tag(a, "title")
    drag_at(a, title.x + 10, title.y + 12, -2000, -2000)
    eq(tag(a, "window").x, 0)
    eq(tag(a, "window").y, 0)
    title = tag(a, "title")
    drag_at(a, title.x + 10, title.y + 12, 2000, 2000)
    eq(tag(a, "window").x, 500)
    eq(tag(a, "window").y, 420)
    a:set_size(400, 300)
    a:frame(0)
    eq(tag(a, "window").x, 100)
    eq(tag(a, "window").y, 120)
    local close
    for _, p in ipairs(a.dl) do
        if p.kind == "text" and p.text == "Закрыть" then
            close = p
        end
    end
    assert(close)
    drag_at(a, close.x + 10, close.y + 8, 0, 0)
    eq(closed, 1)
    a:dispose()
end)

test("Window resizes from all edges without moving opposite edges", function()
    for _, edge in ipairs({ "n", "s", "w", "e", "nw", "ne", "sw", "se" }) do
        local bounds = K.new_state({ x = 200, y = 150, width = 300, height = 200 })
        local a = new_app(function()
            UI.Window({
                title = "Resize",
                resizable = true,
                bounds = bounds.value,
                on_bounds_change = function(v)
                    bounds.value = v
                end,
                min_width = 220,
                min_height = 140,
                max_width = 400,
                max_height = 300,
                modifier = M:tag("window"),
            }, function()
                K.Box({ modifier = M:fill_max_size():tag("body") })
            end)
        end, 800, 600)
        for _ = 1, 6 do
            a:frame(0.1)
        end
        local w = tag(a, "window")
        local west, east, north, south =
            edge:find("w"), edge:find("e"), edge:find("n"), edge:find("s")
        local x = west and w.x + 2 or (east and w.x + w.w - 2 or w.x + w.w / 2)
        local y = north and w.y + 2 or (south and w.y + w.h - 2 or w.y + w.h / 2)
        drag_at(a, x, y, west and -30 or 30, north and -20 or 20)
        local now = tag(a, "window")
        eq(now.w, (west or east) and 330 or 300, edge .. " width")
        eq(now.h, (north or south) and 220 or 200, edge .. " height")
        eq(now.x, west and 170 or 200, edge .. " x")
        eq(now.y, north and 130 or 150, edge .. " y")
        assert(tag(a, "body").h < now.h)
        a:dispose()
    end
end)

test("Window resize limits and content state survive first resize", function()
    local a = new_app(function()
        UI.Window({
            title = "Natural",
            resizable = true,
            width = 300,
            min_width = 220,
            max_width = 360,
            min_height = 120,
            max_height = 260,
            modifier = M:tag("window"),
        }, function()
            local n = K.state(0)
            UI.Button({
                text = tostring(n.value),
                modifier = M:tag("counter"),
                on_click = function()
                    n.value = n:peek() + 1
                end,
            })
        end)
    end, 800, 600)
    for _ = 1, 6 do
        a:frame(0.1)
    end
    click(a, "counter")
    local w = tag(a, "window")
    drag_at(a, w.x + w.w - 2, w.y + w.h - 2, 1000, 1000)
    eq(tag(a, "window").w, 360)
    eq(tag(a, "window").h, 260)
    local preserved = false
    for _, p in ipairs(a.dl) do
        if p.text == "1" then
            preserved = true
        end
    end
    assert(preserved, "first resize reset content state")
    w = tag(a, "window")
    drag_at(a, w.x + w.w - 2, w.y + w.h - 2, -1000, -1000)
    eq(tag(a, "window").w, 220)
    eq(tag(a, "window").h, 120)
    a:dispose()
end)

print(string.format("passed: %d, failed: %d", passed, failed))

app.close_world(false)
app.delete_world("kompot_ui_test")
