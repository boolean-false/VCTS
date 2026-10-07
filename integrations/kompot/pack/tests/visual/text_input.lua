-- Нативный контракт + ввод через tests/visual/text_input_driver.py.
app.config_packs({ "base", "kompot" })
app.new_world("kompot_text_input", "1", "core:default")
local presentation = file.exists("export:presentation")
        and { caret = { shape = "block", blink = 0 } }
    or nil
local function screenshot(path)
    if gui.screenshot then
        file.write_bytes(path, gui.screenshot():encode("png"))
        return
    end
    local before = {}
    if file.exists("user:screenshots") then
        for _, name in ipairs(file.list("user:screenshots")) do
            before[name] = true
        end
    end
    test.press("f2")
    app.sleep(0.15)
    for _, name in ipairs(file.list("user:screenshots")) do
        if not before[name] then
            file.write_bytes(path, file.read_bytes(name))
            return
        end
    end
    error("screenshot missing")
end
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Gallery = require "kompot:ui/gallery"
local old_app, mount = Gallery.App, K.mount
local h
K.mount = function(opts)
    h = mount(opts)
    return h
end
local value = K.new_state("alpha beta")
local editable = K.new_state(true)
local hint = K.new_state("old hint")
local numbers = K.new_state(false)
local version = K.new_state(0)
local visible = K.new_state(true)
local submits, changes = 0, 0
local defocuses = 0
local sink = K.new_state("clipboard target")
local lua_code = string.rep("local line = 42\n", 30)
local nested_code = string.rep("local nested = 42\n", 30)
local nested_scroll = require("kompot:kompot/core/scroll").new_scroll()
local modal, compact = K.new_state(false), K.new_state(false)
local modal_text = K.new_state("Первая\nВторая\nТретья")
Gallery.App = function()
    K.Box({ modifier = K.M:fill_max_size() }, function()
        K.Column(
            { modifier = K.M:width(760):padding(24):background("#202022"), spacing = 12 },
            function()
                K.Text("Text input · " .. version.value)
                if visible.value then
                    UI.TextField({
                        presentation = presentation,
                        state = value,
                        lines = 4,
                        font = false,
                        editable = editable.value,
                        wrap = true,
                        hint = hint.value,
                        syntax = numbers.value and "lua" or nil,
                        line_numbers = numbers.value,
                        on_change = function()
                            changes = changes + 1
                        end,
                        on_defocus = function()
                            defocuses = defocuses + 1
                        end,
                        on_submit = function()
                            submits = submits + 1
                        end,
                    })
                end
                UI.TextField({
                    state = sink,
                    label = "Clipboard target",
                    font = false,
                    on_submit = function()
                        submits = submits + 1
                    end,
                })
                UI.Lua({
                    code = lua_code,
                    line_numbers = true,
                    lines = 4,
                })
            end
        )
        K.Column({
            modifier = K.M:width(280):height(230):offset(780, 24)
                :vertical_scroll(nested_scroll):background("#202022"),
            spacing = 12,
        }, function()
            UI.Lua({ code = nested_code, lines = 4 })
            K.Box({ modifier = K.M:height(600) })
        end)
        UI.Theme({ density = compact.value and "compact" or "comfortable" }, function()
            UI.Dialog({
                visible = modal.value,
                title = "Native field in modal",
                dismiss = { text = "Close" },
                on_dismiss = function()
                    modal.value = false
                end,
            }, function()
                UI.TextField({ state = modal_text, font = "kompot_24", lines = 3, wrap = false })
            end)
        end)
    end)
end
UI.open_gallery()
app.sleep(0.8)
for _ = 1, 50 do
    local ready = false
    for _, entry in pairs(h.backend.entries) do
        if entry.is_field then
            ready = true
            break
        end
    end
    if ready then
        break
    end
    app.sleep(0.1)
end
local function field()
    for _, entry in pairs(h.backend.entries) do
        if entry.is_field and entry.el.text == value.value then
            return entry
        end
    end
    error("field not found: " .. value.value)
end
local entry = field()
local el = entry.el
el.focused = true
el.caret = 3
version.value = 1
app.sleep(0.15)
assert(field() == entry and el.focused and el.caret == 3, "recomposition lost native state")
hint.value, numbers.value, editable.value = "new hint", true, false
app.sleep(0.15)
assert(field() == entry, "mutable options recreated field")
assert(el.hint == "new hint" and el.syntax == "lua" and el.lineNumbers and not el.editable)
assert(el.caret == 3 and el.focused, "mutable options lost focus/caret")
value.value = "я"
app.sleep(0.15)
assert(el.text == "я" and el.caret <= 1, "external replacement left invalid caret")
editable.value, numbers.value = true, false
value.value = "alpha beta"
app.sleep(0.15)

-- Снять точный шаг строки для всех доступных штатных шрифтов.
local metrics = { "-- Generated by tests/visual/text_input.lua", "return {" }
local fonts = { "normal" }
table.sort(fonts)
for _, font in ipairs(fonts) do
    h.backend.measurer:field_line_height(font)
end
app.sleep(0.3)
for _, font in ipairs(fonts) do
    local lh = h.backend.measurer:field_line_height(font)
    assert(lh > 0, "invalid line pitch: " .. font)
    metrics[#metrics + 1] = string.format("[%q] = %d,", font, lh)
end
metrics[#metrics + 1] = "}"
file.write("export:field_metrics.lua", table.concat(metrics, "\n") .. "\n")
local sink_el
for _, e in pairs(h.backend.entries) do
    if e.is_field and e.el.text == sink.value then
        sink_el = e.el
    end
end
local function focus(target)
    if not target.focused then
        target.focused = true
    end
    app.sleep(0.1)
end
local sequence = 0
local function drive(action)
    assert(file.exists("export:driver"), "run with text_input_driver.py")
    sequence = sequence + 1
    action.id = sequence
    file.write("export:request.json", json.tostring(action))
    local path = "export:reply_" .. sequence .. ".json"
    for _ = 1, 150 do
        if file.exists(path) then
            local response = json.parse(file.read(path))
            assert(not response.error, response.error)
            app.sleep(0.15)
            if gui.screenshot then
                screenshot("export:text_input_last.png")
            end
            return
        end
        app.sleep(0.1)
    end
    error("input driver timeout")
end
local function key(name, ctrl)
    local names = {
        enter = "Return",
        backspace = "BackSpace",
        escape = "Escape",
        tab = "Tab",
        ["end"] = "End",
        left = "Left",
    }
    local keys = {}
    local chord = (ctrl and "ctrl+" or "") .. (names[name] or name)
    for part in chord:gmatch("[^+]+") do
        keys[#keys + 1] = part
    end
    -- Движок подтверждает каждый этап своим кадром. Фиксированная задержка
    -- X11 между down/up может потерять короткое нажатие при низком FPS.
    drive({ down = keys })
    local reverse = {}
    for i = #keys, 1, -1 do
        reverse[#reverse + 1] = keys[i]
    end
    drive({ up = reverse })
end
local lua_field
for _, candidate in pairs(h.backend.entries) do
    if candidate.is_field and candidate.el.text == lua_code then
        lua_field = candidate.el
        break
    end
end
assert(lua_field and not lua_field.focused and lua_field.scroll == 0)
local lua_pos, lua_size = lua_field.wpos, lua_field.size
drive({ wheel = { lua_pos[1] + lua_size[1] / 2, lua_pos[2] + lua_size[2] / 2, 2 } })
assert(not lua_field.focused and lua_field.scroll < 0, "unfocused Lua field ignored mouse wheel")
local nested_field
for _, candidate in pairs(h.backend.entries) do
    if candidate.is_field and candidate.el.text == nested_code then
        nested_field = candidate.el
        break
    end
end
assert(nested_field and nested_scroll.max > 0, "nested scroll fixture missing")
local nested_pos, nested_size = nested_field.wpos, nested_field.size
local nested_x = nested_pos[1] + nested_size[1] / 2
local nested_y = nested_pos[2] + nested_size[2] / 2
drive({ wheel = { nested_x, nested_y, 2 } })
assert(nested_field.scroll < 0, "nested field did not scroll")
assert(nested_scroll.value == 0, "parent scrolled while text field could scroll")
drive({ wheel = { nested_x, nested_y, 35 } })
assert(nested_scroll.value > 0, "wheel did not reach parent at text field boundary")
local function copy_from(target)
    focus(target)
    target.caret = target.caret
    key("a", true)
    key("c", true)
end
local function paste_into(target)
    focus(target)
    target.caret = target.caret
    key("a", true)
    key("v", true)
end
focus(el)
key("a", true)
version.value = 2
app.sleep(0.15)
key("c", true)
paste_into(sink_el)
assert(sink.value == "alpha beta", "Ctrl+A/C/V or selection across recomposition failed")
sink.value = "Привет\n\nмир"
app.sleep(0.15)
assert(sink_el.text == sink.value, "external sink update not rendered")
copy_from(sink_el)
paste_into(el)
assert(
    value.value == "Привет\n\nмир",
    "Unicode paste did not update state: " .. value.value
)
key("z", true)
assert(value.value == "alpha beta", "undo failed")
key("y", true)
assert(value.value == "Привет\n\nмир", "redo failed")
key("end")
key("left")
local caret = el.caret
key("enter")
assert(el.caret > caret, "multiline Enter failed")
key("a", true)
drive({ text = "Новый текст" })
app.sleep(0.15)
assert(value.value == "Новый текст", "typed Unicode failed")
value.value = "alpha beta"
editable.value = false
app.sleep(0.2)
copy_from(el)
paste_into(sink_el)
assert(sink.value == value.value, "read-only copy failed")
focus(el)
local before = changes
key("v", true)
key("backspace")
drive({ text = "forbidden" })
app.sleep(0.15)
assert(
    value.value == "alpha beta" and el.text == value.value and changes == before,
    "read-only editing allowed"
)
-- Выделение мышью: первые пять символов без gutter.
local pos = el.wpos
local x, y = pos[1] + UI.theme().metrics.field_pad, pos[2] + UI.theme().metrics.field_pad + 5
local width = h.backend.measurer:width("normal", "alpha")
drive({ drag = { x, y, x + width, y } })
key("c", true)
paste_into(sink_el)
assert(sink.value == "alpha", "mouse selection copy failed: " .. sink.value)
key("enter")
assert(submits == 1, "single-line Enter did not submit exactly once")
editable.value = true
value.value = string.rep("long line of text\n", 30)
app.sleep(0.2)
focus(el)
el.caret = #value.value
app.sleep(0.2)
assert(el.scroll < 0, "cursor at end of long text was not scrolled into view")
screenshot("export:text_input_scrolled.png")
value.value = "alpha beta"
app.sleep(0.2)
el.caret = 5
key("shift+Left")
key("c", true)
paste_into(sink_el)
assert(sink.value == "a", "Shift+Left selection failed")
focus(el)
local before_tab = value.value
key("tab")
assert(hud.is_open("kompot:gallery"), "Tab closed overlay")
assert(not el.focused, "Tab did not leave native field")
assert(value.value == before_tab, "Tab both moved focus and edited text")
assert(changes > 0, "no change events")
focus(el)
local before_remove, old_value = defocuses, value.value
visible.value = false
app.sleep(0.15)
for _, current in pairs(h.backend.entries) do
    assert(current ~= entry, "removed field retained")
end
assert(defocuses == before_remove + 1, "removal did not notify defocus")
-- Без буквенных горячих клавиш HUD (например, T открывает чат).
drive({ text = "123" })
assert(hud.is_open("kompot:gallery"), "numeric input closed overlay")
assert(value.value == old_value, "removed field still receives input")
value.value = "    alpha beta\n\n"
visible.value = true
app.sleep(0.15)
assert(field() ~= entry and field().el.text == value.value, "remount did not restore state")
assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
screenshot("export:text_input.png")
modal.value = true
app.sleep(0.4)
local modal_el
for _, e in pairs(h.backend.entries) do
    if e.is_field and e.el.text == modal_text.value then
        modal_el = e.el
    end
end
assert(modal_el, "modal field missing")
focus(modal_el)
local function check_modal_height()
    for _, p in ipairs(h.app.dl) do
        if p.kind == "field" and p.text == modal_text.value then
            assert(p.line_height == h.backend.measurer:field_line_height("kompot_24"))
            assert(p.h == p.line_height * 3 + p.pad * 2, "modal height ignores font/density")
            return
        end
    end
    error("modal primitive missing")
end
check_modal_height()
key("a", true)
drive({ text = "В модальном окне" })
assert(modal_text.value == "В модальном окне", "modal input failed")
local before_modal_tab = modal_text.value
key("tab")
assert(modal.value and hud.is_open("kompot:gallery"), "Tab closed modal")
assert(modal_text.value == before_modal_tab, "Tab edited modal text")
compact.value = true
app.sleep(0.3)
check_modal_height()
screenshot("export:text_input_modal.png")
key("escape")
assert(not hud.is_open("kompot:gallery") and h.disposed, "Escape did not close HUD overlay")
K.mount, Gallery.App = mount, old_app
app.close_world(false)
app.delete_world("kompot_text_input")
print("passed: native text input, failed: 0")
