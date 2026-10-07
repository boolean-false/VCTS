-- Run from any directory: lua tests/run.lua /path/to/game/content
local content = assert(arg[1], "content directory required")
unpack = unpack or table.unpack
local native = require
local loaded = {}
function require(name)
    local pack, path = name:match("^([%w_%-]+):(.+)$")
    if not pack then
        return native(name)
    end
    if loaded[name] then
        return loaded[name]
    end
    loaded[name] = assert(loadfile(content .. "/" .. pack .. "/modules/" .. path .. ".lua"))()
        or true
    return loaded[name]
end
local K = require "kompot:kompot"
local V = require "kompot:ui"
local E = require "kompot:ui/examples"
local B = require "kompot:kompot/backend/recorder"
local M = K.M
local passed = 0
local function test(name, fn)
    local ok, err = xpcall(fn, debug.traceback)
    if not ok then
        error(name .. "\n" .. err)
    end
    passed = passed + 1
    print("PASS " .. name)
end
local function make(fn, width, height)
    local b = B.new()
    local a = K.App.new({
        content = function()
            K.Theme(V.theme(), fn)
        end,
        backend = b,
        measurer = B.measurer(),
        width = width or 900,
        height = height or 1200,
    })
    a:frame(0)
    a:frame(0.25)
    assert(#a.rt.errors == 0, table.concat(a.rt.errors, "\n"))
    return a, b
end
local function point(a, name)
    local r = assert(a:find_tag(name), name)
    return r.x + r.w / 2, r.y + r.h / 2
end
local function click(a, name)
    local x, y = point(a, name)
    a:frame(0, { x = x, y = y, down = false })
    a:frame(0, { x = x, y = y, down = true })
    a:frame(0, { x = x, y = y, down = false })
    assert(#a.rt.errors == 0, table.concat(a.rt.errors, "\n"))
end
local function drag(a, from, to)
    local x, y = point(a, from)
    local tx, ty = point(a, to)
    a:frame(0, { x = x, y = y, down = false })
    a:frame(0, { x = x, y = y, down = true })
    a:frame(0.05, { x = x + 10, y = y, down = true })
    a:frame(0.05, { x = tx, y = ty, down = true })
    a:frame(0, { x = tx, y = ty, down = false })
    a:frame(0)
    assert(#a.rt.errors == 0, table.concat(a.rt.errors, "\n"))
end

test("theme isolation and nested inheritance", function()
    local a, b = V.theme(), V.theme()
    a.colors.primary[1] = 0
    a.metrics.slot = 99
    assert(b.colors.primary[1] ~= 0 and b.metrics.slot == 52)
    local app = make(function()
        V.Theme({ accent = "#FFCC44", density = "compact" }, function()
            assert(V.current().metrics.slot == 28)
            V.Theme({ colors = { health = "#FFFFFF" } }, function()
                assert(V.current().metrics.slot == 28)
                assert(V.current().colors.primary[1] == 1)
                assert(V.current().colors.health[1] == 1)
            end)
        end)
        assert(V.current().metrics.slot == 52)
    end)
    app:dispose()
end)

test("portable screen implements every K.ui contract member", function()
    local a = make(function()
        local U = K.ui()
        local scroll = K.scroll_state()
        K.Column({ modifier = M:width(500), spacing = 6 }, function()
            U.Panel({ title = "Contract" }, function()
                K.Text("Body")
            end)
            U.Button({ text = "Primary" })
            U.IconButton({ icon = "cube" })
            U.Checkbox({ checked = true, label = "Enabled" })
            U.Switch({ checked = false, label = "Switch" })
            U.Slider({ value = 0.5 })
            U.TextField({ value = "text", label = "Name", supporting = "Help" })
            U.Tabs({ tabs = { "A", "B" }, selected = 1 })
            U.Segmented({ options = { "A", "B" }, selected = 1 })
            U.ListItem({ headline = "Item", supporting = "Details", icon = "cube", trailing = "12" })
            U.Divider()
            U.Badge({ count = 2 })
            U.ProgressBar({ progress = 0.5 })
            U.Tooltip({ text = "Tip" }, function()
                K.Text("Hover")
            end)
            U.Dialog({ visible = true, title = "Dialog", confirm = { text = "OK" } })
            U.Menu({ expanded = true }, function()
                U.MenuItem({ text = "Entry" })
            end)
            U.Scrollbar({ state = scroll, modifier = M:height(100) })
        end)
    end)
    a:dispose()
end)

test("buttons and keyboard honor disabled state", function()
    local hits = 0
    local a = make(function()
        K.Column(function()
            V.Button({
                text = "Go",
                modifier = M:tag("go"),
                on_click = function()
                    hits = hits + 1
                end,
            })
            V.Button({
                text = "No",
                enabled = false,
                modifier = M:tag("no"),
                on_click = function()
                    hits = hits + 100
                end,
            })
        end)
    end)
    click(a, "go")
    click(a, "no")
    assert(hits == 1)
    a:frame(0, { key = "tab" })
    a:frame(0, { key = "enter" })
    assert(hits == 2)
    a:dispose()
end)

test("inventory moves, rejects incompatible placement, renders empty slots", function()
    local calls = 0
    local a = make(function()
        V.InventoryGrid({
            items = E.items(),
            count = 12,
            columns = 6,
            on_move = function(from, to, item)
                assert(from == 1 and to == 2 and item.id == "base:stone")
                calls = calls + 1
                return true
            end,
            accepts = function(i)
                return i ~= 3
            end,
        })
    end)
    assert(a:find_tag("slot_12"))
    drag(a, "slot_1", "slot_2")
    assert(calls == 1, "drop not delivered")
    drag(a, "slot_1", "slot_3")
    assert(calls == 1, "rejected drop delivered")
    a:dispose()
end)

test("drag image follows the pointer across inventory columns", function()
    local a = make(function()
        V.InventoryGrid({
            items = E.items(),
            count = 8,
            columns = 8,
            on_move = function()
                return true
            end,
        })
    end)
    local sx, sy = point(a, "slot_1")
    a:frame(0, { x = sx, y = sy, down = false })
    a:frame(0, { x = sx, y = sy, down = true })
    for _, column in ipairs({ 3, 8 }) do
        local x, y = point(a, "slot_" .. column)
        a:frame(0.05, { x = x, y = y, down = true })
        local ghost
        for _, p in ipairs(a.dl) do
            if
                p.kind == "image"
                and p.src == "block-previews:base:stone"
                and p.key:sub(1, 1) == "o"
            then
                ghost = p
                break
            end
        end
        assert(
            ghost and math.abs(ghost.x - (x + 10)) <= 1 and math.abs(ghost.y - (y + 10)) <= 1,
            "drag image must stay beside the pointer at column " .. column
        )
    end
    a:frame(0, { x = sx, y = sy, down = false })
    a:dispose()
end)

test("locked slot blocks actions and drops", function()
    local calls = 0
    local a = make(function()
        K.Row({ spacing = 10 }, function()
            V.ItemSlot({
                item = E.items()[1],
                modifier = M:tag("source"),
                on_drag_event = function(e, item)
                    if e.type == "start" then return item end
                end,
            })
            V.ItemSlot({
                locked = true,
                modifier = M:tag("locked"),
                on_click = function()
                    calls = calls + 1
                end,
                on_drop = function()
                    calls = calls + 1
                end,
            })
        end)
    end)
    click(a, "locked")
    drag(a, "source", "locked")
    assert(calls == 0)
    a:dispose()
end)
test("item slot uses one drag callback for payload, result and cancellation", function()
    local item = E.items()[1]
    local events, received = {}, nil
    local a = make(function()
        K.Row({spacing = 10}, function()
            V.ItemSlot({item = item, modifier = M:tag("source"), on_drag_event = function(e, source)
                assert(source == item)
                events[#events + 1] = e
                if e.type == "start" then return source end
            end})
            V.ItemSlot({modifier = M:tag("target"), on_drop = function(payload)
                received = payload
            end})
        end)
    end)
    drag(a, "source", "target")
    assert(received == item and events[#events].type == "end" and events[#events].accepted)
    local x, y = point(a, "source")
    a:frame(0, {x = x, y = y, down = true})
    a:frame(0.05, {x = x + 10, y = y, down = true})
    a:frame(0, {x = x + 10, y = y, down = true, key = "escape"})
    assert(events[#events].type == "cancel" and events[#events].reason == "escape")
    for _, p in ipairs(a.dl) do
        assert(not (p.kind == "image" and p.src == item.src and p.key:sub(1, 1) == "o"),
            "cancelled slot kept its drag image")
    end
    a:dispose()
end)

test("resource bars clamp values and preserve fractional segments", function()
    for _, v in ipairs({ -10, 0, 35, 100, 120 }) do
        local a, b = make(function()
            V.ResourceBar({ value = v, max = 100, color = "#123456", modifier = M:width(300) })
        end)
        local filled = 0
        for _, p in ipairs(b.dl) do
            assert((p.w or 0) >= 0 and (p.h or 0) >= 0)
            if p.kind == "rect" and p.color and math.abs(p.color[1] - 0x12 / 255) < 0.0001 then
                filled = filled + 1
            end
        end
        assert(filled == (v <= 0 and 0 or v == 35 and 4 or 10), "segment count " .. filled)
        a:dispose()
    end
end)

test("all game examples at narrow and wide widths", function()
    for _, width in ipairs({ 360, 860, 1280 }) do
        for _, page in ipairs(E.pages) do
            local a = make(page[2], width, 1400)
            for i = 1, 5 do
                a:frame(0.1)
            end
            assert(#a.rt.errors == 0, page[1] .. ": " .. table.concat(a.rt.errors, "\n"))
            a:dispose()
        end
    end
end)
test("cross-grid payloads are rejected by default", function()
    local calls = 0
    local a = make(function()
        K.Column({ spacing = 20 }, function()
            V.InventoryGrid({
                items = E.items(),
                count = 6,
                tag_prefix = "a",
                on_move = function()
                    calls = calls + 1
                end,
            })
            V.InventoryGrid({
                items = E.items(),
                count = 6,
                tag_prefix = "b",
                on_move = function()
                    calls = calls + 1
                end,
            })
        end)
    end)
    drag(a, "a1", "b2")
    assert(calls == 0)
    a:dispose()
end)

test("disabled slider ignores keyboard and pointer; stepped values stay in range", function()
    local calls = 0
    local a = make(function()
        V.Slider({
            value = 0,
            min = 0,
            max = 10,
            enabled = false,
            modifier = M:tag("slider"),
            on_change = function()
                calls = calls + 1
            end,
        })
    end)
    click(a, "slider")
    a:frame(0, { key = "tab" })
    a:frame(0, { key = "right" })
    assert(calls == 0)
    a:dispose()
    a = make(function()
        V.Slider({
            value = 0,
            min = 0,
            max = 10,
            step = 6,
            modifier = M:tag("slider"),
            on_change = function(v)
                assert(v >= 0 and v <= 10)
            end,
        })
    end)
    local r = a:find_tag("slider")
    a:frame(0, { x = r.x + r.w - 1, y = r.y + r.h / 2, down = true })
    a:frame(0, { down = false })
    a:dispose()
end)

test("text field forwards editing and displays validation", function()
    local value = K.new_state("before")
    local a, b = make(function()
        V.TextField({ state = value, error = "Invalid", label = "Name" })
    end)
    local field, message
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            field = p
        end
        if p.kind == "text" and p.text == "Invalid" then
            message = p
        end
    end
    assert(field and message)
    field.on_change("after")
    a:frame(0)
    assert(value:peek() == "after")
    a:dispose()
end)

test("machine completes a cycle and output can be collected", function()
    local a, b = make(E.Machine)
    click(a, "machine_start")
    for i = 1, 65 do
        a:frame(0.1)
    end
    assert(#a.rt.errors == 0, table.concat(a.rt.errors, "\n"))
    local found = false
    for _, p in ipairs(b.dl) do
        if p.kind == "text" and p.text == "4" then
            found = true
        end
    end
    assert(found, "completed recipe has no output")
    click(a, "machine_output")
    for _, p in ipairs(b.dl) do
        assert(not (p.kind == "text" and p.text == "4"), "output not collected")
    end
    a:dispose()
end)
test("inventory example updates item locations after drop", function()
    local a, b = make(E.Inventory)
    local target = a:find_tag("slot_8")
    drag(a, "slot_1", "slot_8")
    local found = false
    for _, p in ipairs(b.dl) do
        if
            p.kind == "image"
            and p.src == "block-previews:base:stone"
            and p.x >= target.x
            and p.x < target.x + target.w
            and p.y >= target.y
            and p.y < target.y + target.h
        then
            found = true
        end
    end
    assert(found, "item not rendered in target slot")
    a:dispose()
end)
test("chest transfers to backpack with drag and quick transfer", function()
    local a, b = make(E.Inventory)
    local target = a:find_tag("slot_27")
    drag(a, "slot_1", "slot_27")
    local found = false
    for _, p in ipairs(b.dl) do
        if
            p.kind == "image"
            and p.src == "block-previews:base:stone"
            and p.x >= target.x
            and p.x < target.x + target.w
            and p.y >= target.y
            and p.y < target.y + target.h
        then
            found = true
        end
    end
    assert(found, "chest item did not reach backpack")
    local x, y = point(a, "slot_27")
    a:frame(0, { x = x, y = y, rdown = true })
    a:frame(0, { x = x, y = y, rdown = false })
    a:frame(0)
    local source = a:find_tag("slot_1")
    local returned = false
    for _, p in ipairs(b.dl) do
        if
            p.kind == "image"
            and p.src == "block-previews:base:stone"
            and p.x >= source.x
            and p.x < source.x + source.w
            and p.y >= source.y
            and p.y < source.y + source.h
        then
            returned = true
        end
    end
    assert(returned, "quick transfer did not return item to chest")
    a:dispose()
end)
test("pause navigation returns and resumes through caller", function()
    local resumed = false
    local a = make(function()
        E.Pause({
            on_close = function()
                resumed = true
            end,
        })
    end)
    click(a, "pause_settings")
    assert(a:find_tag("pause_back"))
    click(a, "pause_back")
    click(a, "pause_resume")
    assert(resumed)
    a:dispose()
end)
print("passed: " .. passed .. ", failed: 0")
