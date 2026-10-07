app.config_packs({ "base", "kompot" })
app.new_world("kompot_presentation", "1", "core:default")
local function screenshot(path)
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
    error("screenshot was not saved")
end
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Gallery = require "kompot:ui/gallery"
local original, mount = Gallery.App, K.mount
local h
K.mount = function(opts)
    h = mount(opts)
    return h
end
local editor = K.new_text_field_state("local message = 'Привет'\nreturn message\n\n-- end")
local style = K.new_state({
    caret = { shape = "block", color = "#E3AF6770", blink = 0 },
    selection_color = "#803DAAB0",
    spans = {
        { start = 0, finish = 5, color = "#E3AF67" },
        { start = 16, finish = 24, color = "#87C38F" },
    },
})
local changes, selections = 0, 0
Gallery.App = function()
    K.Column(
        { modifier = K.M:width(720):padding(24):background("#202022"), spacing = 12 },
        function()
            K.Text("Kompot · собственная отрисовка текста")
            UI.TextField({
                editor_state = editor,
                presentation = style.value,
                lines = 5,
                font = K.style("mono").font,
                wrap = true,
                on_change = function()
                    changes = changes + 1
                end,
                on_selection_change = function()
                    selections = selections + 1
                end,
            })
            K.Text("Нативный textbox для сравнения")
            UI.TextField({ value = editor.value.text, lines = 5, font = K.style("mono").font, wrap = true })
        end
    )
end
UI.open_gallery()
app.sleep(1)
assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
local field
for _ = 1, 50 do
    for _, entry in pairs(h.backend.entries) do
        if entry.is_field and entry.field_props and entry.field_props.presentation then
            field = entry
        end
    end
    if field and field.paint then
        break
    end
    app.sleep(0.1)
end
assert(field and field.paint, "custom presentation missing")
local el = field.el
assert(el.externalRendering, "native text was not hidden")
assert(field.field_props.font == "kompot_mono_16", "presentation must exercise the vector Mono font")
el.focused = true
editor.value = { text = editor.value.text, anchor = 13, caret = 6 }
app.sleep(0.2)
assert(el.selection[1] == 13 and el.selection[2] == 6, "directed selection not applied")
local layout = el.textLayout
assert(layout.ready and #layout.selectionRects == 1)
assert(layout.lines[1].text == "local message = 'Привет'")
local x = layout.lines[1].pos[1]
for i = 1, 6 do
    x = x + layout.lines[1].advances[i]
end
assert(layout.caretRect[1] == x, "caret does not match glyph advances")
assert(el.focused and layout.caretRect[3] > 0, "caret is not drawable")
file.write("export:presentation_layout.json", json.tostring(layout))
screenshot("export:presentation_block.png")
test.press("right")
app.sleep(0.2)
assert(
    editor.value.caret == el.caret and editor.value.anchor == el.selection[1],
    "arrow not synchronized"
)
assert(selections > 0, "missing selection event")
el.selection = { 0, 5 }
el:paste("local")
app.sleep(0.2)
assert(editor.value.text == el.text and changes > 0, "editing not synchronized")
style.value = {
    selection_color = "#386F94AA",
    draw_caret = function(r)
        return {
            { kind = "rect", x = r[1], y = r[2] + r[4] - 3, w = r[3], h = 3, color = "#60D5FFFF" },
        }
    end,
}
editor.value = { text = "Первая\nВторая\n\nТретья", anchor = 2, caret = 15 }
app.sleep(0.2)
assert(field.paint and el.selection[2] == 15)
layout = el.textLayout
assert(#layout.selectionRects >= 3, "multiline selection missing")
screenshot("export:presentation_custom.png")
editor.value = {
    text = string.rep("длинная строка без перевода ", 25),
    anchor = 0,
    caret = 500,
}
app.sleep(0.3)
assert(el.scroll < 0, "wrapped text did not scroll")
layout = el.textLayout
assert(#layout.lines < 10, "offscreen lines leaked into visible snapshot")
screenshot("export:presentation_wrapped.png")
style.value = nil
app.sleep(0.2)
assert(not el.externalRendering and not field.paint, "native rendering not restored")
assert(el.text == editor.value.text, "presentation switch changed text")
assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
hud.close("kompot:gallery")
K.mount, Gallery.App = mount, original
app.close_world(false)
app.delete_world("kompot_presentation")
print("passed: text presentation, failed: 0")
