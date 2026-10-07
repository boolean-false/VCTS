app.config_packs({ "kompot" })
app.new_world("kompot_gallery_test", "1", "core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local G = require "kompot:ui/gallery"
local Guide = G.catalog
local recorder = require "kompot:kompot/backend/recorder"
local s = G.new_session()
local other = G.new_session()
local b = recorder.new()
local a = K.App.new({
    content = function()
        G.App(s)
    end,
    backend = b,
    measurer = recorder.measurer(),
    width = 1100,
    height = 800,
})
local function settle()
    for _ = 1, 6 do
        a:frame(1 / 30)
    end
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
end
local function click(tag)
    local p = assert(a:find_tag(tag), tag)
    local x, y = p.x + p.w / 2, p.y + p.h / 2
    assert(x >= 0 and x < a.rt.width and y >= 0 and y < a.rt.height, "outside viewport: " .. tag)
    for _, down in ipairs({ false, true, false }) do
        a:frame(0, { x = x, y = y, down = down })
    end
    settle()
end
assert(#Guide.entries >= 35)
assert(#Guide.search("КАРЕТКА", "core") > 0, "Russian case insensitive search")
assert(#Guide.search("UI.Button", "ui") > 0, "API search")
assert(#Guide.search("no_such_feature", "core") == 0)
for _, entry in ipairs(Guide.entries) do
    G.select(s, entry.id)
    settle()
    assert(#a.dl > 20, "empty page: " .. entry.id)
    if entry.render then
        local test_backend = recorder.new()
        local isolated = K.App.new({
            content = function()
                UI.Theme({}, entry.render)
            end,
            backend = test_backend,
            measurer = recorder.measurer(),
            width = 500,
            height = 600,
        })
        for _ = 1, 5 do
            isolated:frame(1 / 30)
        end
        assert(#isolated.rt.errors == 0, entry.id .. ": " .. tostring(isolated.rt.errors[1]))
        isolated:dispose()
    end
end
G.select(s, "welcome")
settle()
local divider = assert(a:find_tag("guide_divider"))
local x, y = divider.x + divider.w / 2, divider.y + 40
for _, event in ipairs({
    { x = x, y = y, down = true },
    { x = x + 80, y = y, down = true },
    { x = x + 80, y = y, down = false },
}) do
    a:frame(0, event)
end
settle()
assert(
    s.nav_width.value == 328 and other.nav_width.value == 248,
    "navigation resize/session isolation"
)
click("demo_counter")
local found = false
for _, p in ipairs(a.dl) do
    if p.text == "Нажатий: 1" then
        found = true
    end
end
assert(found, "live sample did not update")
click("reset_example")
found = false
for _, p in ipairs(a.dl) do
    if p.text == "Нажатий: 0" then
        found = true
    end
end
assert(found, "example reset failed")
assert(other.page:peek() == "chest" and not other.generations.welcome, "session isolation")
s.history.ui = "buttons"
s.query.value = "каретка"
settle()
click("section_ui")
assert(s.query:peek() == "" and s.page:peek() == "buttons")
click("section_core")
assert(s.query:peek() == "каретка" and s.page:peek() == "welcome")
assert(not a:find_tag("open_appearance"), "gallery should use one visual style")
click("toggle_code")
assert(s.show_code:peek())
s.query.value = "no_such_feature"
settle()
for _, width in ipairs({ 760, 480 }) do
    a:set_size(width, 640)
    s.navigation.value = true
    settle()
    assert(a:find_tag("guide_search"), "narrow navigation missing")
    s.navigation.value = false
    settle()
    assert(a:find_tag("reset_example"), "narrow content missing")
end
a:set_size(1100, 800)
settle()
assert(a:find_tag("guide_divider") and s.nav_width.value == 328, "navigation width lost")
a:dispose()
print("passed: 1, failed: 0")
app.close_world(false)
app.delete_world("kompot_gallery_test")
