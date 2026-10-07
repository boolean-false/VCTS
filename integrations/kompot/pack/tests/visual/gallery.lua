app.config_packs({ "base", "kompot" })
app.new_world("kompot_gallery_visual", "1", "base:demo")
world.set_day_time(0.45)
world.set_day_time_speed(0)
app.sleep(3)
player.set_flight(0, true)
local px, py, pz = player.get_pos(0)
player.set_pos(0, px, py + 14, pz)
player.set_rot(0, 0, -20, 0)
local function screenshot(path)
    gui.close_menu()
    app.sleep(0.05)
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
local G = require "kompot:ui/gallery"
local s = G.new_session()
local h = K.mount({
    content = function()
        G.App(s)
    end,
    theme = UI.DEFAULT,
})
app.sleep(1)
for _, entry in ipairs(G.pages) do
    G.select(s, entry.id)
    app.sleep(0.2)
    assert(#h.app.rt.errors == 0, entry.id .. ": " .. tostring(h.app.rt.errors[1]))
end
for _, id in ipairs({
    "chest",
    "pause",
    "workbench",
    "game_hud",
    "welcome",
    "buttons",
    "flow",
    "typography",
    "settings",
    "presentation",
    "split_pane",
}) do
    G.select(s, id)
    app.sleep(0.4)
    if id == "presentation" and h.backend:supports_text_presentation() then
        local field
        for _, entry in pairs(h.backend.entries) do
            if entry.is_field and entry.field_props.presentation then
                field = entry.el
            end
        end
        assert(field and field.externalRendering, "presentation not enabled")
        field.focused = true
        field.selection = { 6, 12 }
        app.sleep(0.2)
    end
    screenshot("export:lab_" .. id .. ".png")
end
s.nav_width.value = 400
app.sleep(0.3)
if h.app.rt.width >= 900 then
    assert(h.app:find_tag("guide_divider"), "split divider missing")
end
screenshot("export:lab_wide_navigation.png")
s.nav_width.value = 248
G.select(s, "welcome")
s.navigation.value = true
app.sleep(0.2)
local search
for _, entry in pairs(h.backend.entries) do
    if
        entry.is_field
        and entry.field_props.hint == "Поиск по названию или API"
    then
        search = entry.el
    end
end
assert(search, "search field missing")
search:paste("КАРЕТКА")
app.sleep(0.2)
assert(s.query:peek() == "КАРЕТКА", "native search input not synchronized")
assert(
    h.app:find_tag("nav_editor_state") and not h.app:find_tag("nav_welcome"),
    "search did not filter navigation"
)
s.query.value = ""
s.navigation.value = false
G.select(s, "buttons")
app.sleep(0.3)
h:dispose()
-- Фиксированные размеры хоста проверяют тот же адаптивный интерфейс в настоящем GUI.
gui.root.root:add("<container id='lab_narrow' size='560,640' pos='0,0'/>")
local narrow = K.mount({
    target = gui.root.lab_narrow,
    content = function()
        G.App(s)
    end,
    theme = UI.DEFAULT,
})
app.sleep(0.5)
assert(#narrow.app.rt.errors == 0, tostring(narrow.app.rt.errors[1]))
screenshot("export:lab_narrow.png")
s.navigation.value = true
app.sleep(0.3)
screenshot("export:lab_navigation.png")
narrow:dispose()
gui.root.lab_narrow:destruct()
for _ = 1, 2 do
    UI.open_gallery()
    app.sleep(0.3)
    assert(hud.is_open("kompot:gallery"))
    hud.close("kompot:gallery")
    app.sleep(0.2)
    assert(not hud.is_open("kompot:gallery"))
end
print("passed: 1, failed: 0")
app.close_world(false)
app.delete_world("kompot_gallery_visual")
