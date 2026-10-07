app.config_packs({ "base", "kompot" })
app.new_world("kompot_native_modal", "1", "core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local level = K.new_state(0)
local text = K.new_state("background")
local first = K.new_state("first")
local second = K.new_state("second")
local Gallery = require "kompot:ui/gallery"
local old_app, mount = Gallery.App, K.mount
local h
K.mount = function(opts)
    h = mount(opts)
    return h
end
Gallery.App = function()
    K.Box({ modifier = K.M:fill_max_size() }, function()
        K.Column({ modifier = K.M:width(600):padding(16), spacing = 8 }, function()
            UI.TextField({ state = text })
            UI.Lua({ code = "local example = 42" })
        end)
        UI.Window({
            visible = level.value >= 1,
            modal = true,
            z = 1,
            title = "First",
            on_close = function() end,
        }, function()
            UI.TextField({ state = first })
        end)
        UI.Dialog(
            { visible = level.value >= 2, title = "Second", on_dismiss = function() end },
            function()
                UI.TextField({ state = second })
            end
        )
    end)
end
UI.open_gallery()
app.sleep(0.8)
local function settle()
    app.sleep(0.3)
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
end
local function field(value)
    for _, entry in pairs(h.backend.entries) do
        if entry.is_field and entry.el.text == value then
            return entry.el
        end
    end
end
for _ = 1, 30 do
    if field("background") then
        break
    end
    app.sleep(0.1)
end
local bg, code = assert(field("background")), assert(field("local example = 42"))
bg.focused = true
bg.caret = 3
settle()
level.value = 1
settle()
local inner = assert(field("first"))
assert(not bg.interactive and not bg.enabled and not bg.focused, "background field still active")
assert(not code.interactive and not code.enabled, "read-only code still selectable")
assert(inner.interactive and inner.enabled)
test.fill(bg, "BAD")
settle()
assert(text:peek() == "background" and bg.caret == 3 and not bg.focused, "input reached background")
test.click(code)
settle()
assert(not code.focused, "background code took focus")
inner.focused = true
level.value = 2
settle()
local top = assert(field("second"))
assert(not inner.interactive and not inner.focused and top.interactive, "nested modal not isolated")
test.fill(top, "!")
settle()
assert(second:peek() ~= "second", "top modal input disabled")
level.value = 1
settle()
assert(inner.interactive and inner.enabled and not bg.interactive)
level.value = 0
settle()
assert(
    bg.interactive and bg.enabled and code.interactive and code.enabled,
    "background not restored"
)
assert(field("background") == bg, "field was recreated")
test.fill(bg, "!")
settle()
assert(text:peek() ~= "background", "background input not restored")
hud.close("kompot:gallery")
K.mount, Gallery.App = mount, old_app
app.close_world(false)
app.delete_world("kompot_native_modal")
print("passed: 1, failed: 0")
