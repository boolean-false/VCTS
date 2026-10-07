app.config_packs({ "base", "kompot" })
app.new_world("kompot_window_native", "1", "core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Gallery = require "kompot:ui/gallery"
local old_app, mount = Gallery.App, K.mount
local h
K.mount = function(opts)
    h = mount(opts)
    return h
end
local value = K.new_state("Window text")
local background = K.new_state("Background must not receive input")
Gallery.App = function()
    K.BasicTextField({ state = background, lines = 10, modifier = K.M:fill_max_size() })
    UI.Window({
        title = "Movable editor",
        draggable = true,
        resizable = true,
        width = 400,
        height = 200,
        modifier = K.M:tag("window"),
        title_modifier = K.M:tag("title"),
    }, function()
        K.BasicTextField({
            state = value,
            lines = 6,
            wrap = true,
            modifier = K.M:fill_max_size():background("#121212"),
        })
    end)
end
UI.open_gallery()
-- Ждём кадры приложения, а не время: под нагрузкой кадр может длиться
-- дольше паузы, и событие ввода не попало бы ни в один кадр.
local function frames(n)
    local target = h.app.stats.frames + (n or 3)
    for _ = 1, 1000 do
        if h.app.stats.frames >= target then
            return
        end
        app.sleep(0.01)
    end
    error("Kompot stopped producing frames")
end
for _ = 1, 100 do
    if h then
        break
    end
    app.sleep(0.05)
end
assert(h, "gallery did not mount")
frames(5)
local function check()
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
end
local function drag(x, y, dx, dy)
    for _, ev in ipairs({
        { x = x, y = y, down = false, inside = true },
        { x = x, y = y, down = true, inside = true },
        { x = x + dx, y = y + dy, down = true, inside = true },
        { x = x + dx, y = y + dy, down = false, inside = true },
    }) do
        h.fake_input = ev
        frames(2)
    end
    h.fake_input = nil
    frames(3)
    check()
end
local function field()
    for _, e in pairs(h.backend.entries) do
        if e.is_field and e.el.text ~= background.value then
            return e.el
        end
    end
end
check()
for _ = 1, 30 do
    if field() then
        break
    end
    frames(1)
end
local el = assert(field())
test.fill(el, "!")
frames()
local text = value.value
assert(text ~= "Window text", "initial input failed (focused=" .. tostring(el.focused) .. ")")
local before = h.app:find_tag("window")
local title = h.app:find_tag("title")
local bg
for _, e in pairs(h.backend.entries) do
    if e.is_field and e.el.text == background.value then
        bg = e.el
    end
end
assert(bg)
local function click_at(x, y)
    test.click({ exists = true, wpos = { x, y }, size = { 1, 1 } })
    frames()
end
for _, point in ipairs({
    { title.x + 30, title.y + 12 },
    { before.x + 2, before.y + before.h / 2 },
    { before.x + before.w - 2, before.y + before.h - 2 },
}) do
    bg.focused = true
    bg.caret = 3
    click_at(point[1], point[2])
    assert(not bg.focused and bg.caret == 3, "window chrome passed native input to background")
end
click_at(20, 20)
assert(bg.focused, "uncovered background is not interactive")
local oldpos, oldsize = el.wpos, el.size
-- Окно не выходит за экран (UI.Window прижимает его к границам). Окно
-- движка может быть меньше обычного (тайловый WM), поэтому ожидания
-- считаются с той же границей.
local W, H = h.app.rt.width, h.app.rt.height
local dx = math.min(40, W - before.x - before.w)
local dy = math.min(30, H - before.y - before.h)
assert(dx > 0 and dy > 0, string.format("viewport %dx%d is too small to move the window", W, H))
drag(title.x + 30, title.y + 12, 40, 30)
local moved = h.app:find_tag("window")
assert(
    moved.x == before.x + dx and moved.y == before.y + dy,
    string.format("window did not move: %d,%d -> %d,%d", before.x, before.y, moved.x, moved.y)
)
assert(field() == el and value.value == text, "move recreated field or lost text")
assert(
    el.wpos[1] == oldpos[1] + dx and el.wpos[2] == oldpos[2] + dy,
    "native field did not follow"
)
local dw = math.min(60, W - moved.x - moved.w)
local dh = math.min(40, H - moved.y - moved.h)
assert(dw > 0 and dh > 0, string.format("viewport %dx%d is too small to resize the window", W, H))
drag(moved.x + moved.w - 2, moved.y + moved.h - 2, 60, 40)
local resized = h.app:find_tag("window")
assert(
    resized.w == moved.w + dw and resized.h == moved.h + dh,
    string.format("window did not resize: %dx%d -> %dx%d", moved.w, moved.h, resized.w, resized.h)
)
assert(field() == el and value.value == text, "resize recreated field or lost text")
assert(
    el.size[1] == oldsize[1] + dw and el.size[2] == oldsize[2] + dh,
    "native field did not resize"
)
test.fill(el, "?")
frames()
assert(value.value ~= text, "input after resize failed")
file.write_bytes("export:window_resized.png", gui.screenshot():encode("png"))
hud.close("kompot:gallery")
K.mount, Gallery.App = mount, old_app
app.close_world(false)
app.delete_world("kompot_window_native")
print("passed: native window drag and resize, failed: 0")
