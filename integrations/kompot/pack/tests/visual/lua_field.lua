app.config_packs({ "base", "kompot" })
app.new_world("kompot_lua_field", "1", "core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local source = [[local inter = K.interaction()
UI.Button({text = "Сохранить", variant = "primary",
    on_click = save, modifier = M:tag("save")})
UI.IconButton({icon = "settings", tooltip = "Настройки"})]]
local Gallery = require "kompot:ui/gallery"
local gallery_app = Gallery.App
local h
local mount = K.mount
K.mount = function(opts)
    h = mount(opts)
    return h
end
Gallery.App = function()
    K.Column({ modifier = K.M:width(920):padding(24), spacing = 16 }, function()
        UI.Lua({
            code = source,
            title = "Lua · выделение и копирование",
            line_numbers = true,
        })
        UI.Lua("return 42")
        UI.TextField({
            label = "Редактируемый Lua",
            value = "local value = 1\nreturn value",
            syntax = "lua",
            font = false,
            lines = 3,
            line_numbers = true,
        })
    end)
end
UI.open_gallery()
app.sleep(1)
assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
local count = 0
for _, entry in pairs(h.backend.entries) do
    if entry.is_field then
        count = count + 1
        assert(entry.el.syntax == "lua", "syntax not forwarded")
        if entry.el.text == source then
            assert(entry.el.editable == false, "code is editable")
            assert(entry.el.lineNumbers, "line numbers missing")
            entry.el.focused = true
            assert(entry.el.focused, "read-only code cannot receive focus")
        end
    end
end
assert(count == 3, "expected three native code fields")
app.sleep(0.3)
file.write_bytes("export:lua_field.png", gui.screenshot():encode("png"))
hud.close("kompot:gallery")
K.mount = mount
Gallery.App = gallery_app
app.close_world(false)
app.delete_world("kompot_lua_field")
print("passed: 1, failed: 0")
