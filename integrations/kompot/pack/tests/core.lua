-- Тесты ядра Kompot (без графики: приближённый измеритель текста и
-- бэкенд-регистратор). Движок нужен только как интерпретатор Lua.
app.config_packs({ "kompot" })
-- паки подключаются при создании мира
app.new_world("kompot_core_test", "1", "core:default")

local K = require("kompot:kompot")
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

-- Обновление таблиц

test("copy preserves fields and nested references without changing inputs", function()
    local stats = { armor = 50 }
    local original = { name = "Петя", health = 100, stats = stats, [2] = "apple" }
    local changes = { health = 90, active = false, [2] = "bread" }
    local next = K.copy(original, changes)
    assert(next ~= original)
    eq(next.name, "Петя")
    eq(next.health, 90)
    eq(next.active, false)
    eq(next[2], "bread")
    eq(next.stats, stats, "shallow reference")
    eq(original.health, 100)
    eq(original[2], "apple")
    eq(changes.health, 90)
    local plain = K.copy(setmetatable(original, { __index = { inherited = 1 } }))
    eq(getmetatable(plain), nil, "plain output")
    eq(plain.inherited, nil)
    assert(K.copy(original) ~= original, "copy without changes is fresh")
end)

test("patch is shallow and stores function fields without executing them", function()
    local original = { name = "Петя", stats = { health = 100, armor = 50 } }
    local player = K.new_state(original)
    local callback = function() error("stored callback must not run") end
    local stats = { health = 90 }
    player:patch({ stats = stats, on_damage = callback, active = false })
    local next = player:peek()
    assert(next ~= original)
    eq(next.name, "Петя")
    eq(next.stats, stats)
    eq(next.stats.armor, nil, "whole nested value replaced")
    eq(next.on_damage, callback)
    eq(next.active, false)
    eq(original.stats.armor, 50)
    eq(original.on_damage, nil)
    player:patch({})
    assert(player:peek() ~= next, "empty patch still copies")
end)

test("update_field supports assignment, one computation and deletion", function()
    local original = { health = 100, coins = 5, active = true }
    local player = K.new_state(original)
    player:update_field("health", 90)
    player:update_field("active", false)
    local calls = 0
    player:update_field("coins", function(coins)
        calls = calls + 1
        return coins + 100
    end)
    eq(calls, 1)
    eq(player:peek().coins, 105)
    player:update_field("new", function(value)
        eq(value, nil, "missing field")
        return 42
    end)
    eq(player:peek().new, 42)
    player:update_field("health", nil)
    player:update_field("new", function() return nil end)
    eq(player:peek().health, nil)
    eq(player:peek().new, nil)
    eq(player:peek().active, false)
    eq(original.health, 100)
    eq(original.coins, 5)
    player:update_field(2, "bread")
    eq(player:peek()[2], "bread")
end)

test("nested field update keeps untouched data and previous snapshots", function()
    local original = { name = "Петя", stats = { health = 100, armor = 50 } }
    local player = K.new_state(original)
    player:update_field("stats", function(stats)
        return K.copy(stats, { health = 90 })
    end)
    local next = player:peek()
    eq(next.name, "Петя")
    eq(next.stats.health, 90)
    eq(next.stats.armor, 50)
    assert(next.stats ~= original.stats)
    eq(original.stats.health, 100)
end)

test("table state helpers validate before updating", function()
    local function fails(fn, message)
        local ok, err = pcall(fn)
        assert(not ok and tostring(err):find(message, 1, true), tostring(err))
    end
    for _, value in ipairs({ 1, "x", false }) do
        fails(function() K.copy(value) end, "table source")
        local state = K.new_state(value)
        fails(function() state:patch({}) end, "table value")
        fails(function() state:update_field("x", function() error("unexpected callback") end) end, "table value")
    end
    local original = { x = 1 }
    local state = K.new_state(original)
    fails(function() K.copy(original, false) end, "changes must be a table")
    fails(function() state:patch(nil) end, "changes must be a table")
    fails(function() state:patch("x") end, "changes must be a table")
    fails(function() state:update_field(nil, 2) end, "key must not")
    fails(function() state:update_field(0 / 0, 2) end, "key must not")
    fails(function() state:update_field("x", function() error("callback failed") end) end, "callback failed")
    eq(state:peek(), original, "errors leave state unchanged")
end)

test("table helpers notify the owning component and respect custom equality", function()
    local player = K.new_state({ health = 100, name = "Петя" })
    local root_runs, child_runs = 0, 0
    local Child = K.component(function()
        child_runs = child_runs + 1
        K.Text(tostring(player.value.health), { modifier = M:tag("health") })
    end)
    local a, b = new_app(function()
        root_runs = root_runs + 1
        Child()
    end)
    player:patch({ health = 90 })
    a:frame(0)
    eq(b:texts()[1], "90")
    player:update_field("health", function(health) return health - 10 end)
    a:frame(0)
    eq(b:texts()[1], "80")
    eq(root_runs, 1, "unsubscribed parent remains clean")
    eq(child_runs, 3, "each mutation notifies subscriber")
    a:dispose()
    local original = { health = 100 }
    local calls = 0
    local same = K.new_state(original, function(old, next)
        calls = calls + 1
        return old.health == next.health
    end)
    same:patch({ health = 100 })
    same:update_field("health", 100)
    eq(same:peek(), original, "comparator suppresses equivalent replacements")
    eq(calls, 2)
    same:update_field("health", 90)
    eq(same:peek().health, 90)
    eq(original.health, 100)
end)

-- Раскладка

test("form keeps independent field states and does not reset during composition", function()
    local form, saved, reset_value = nil, nil, K.new_state("first")
    local nested = { health = 100 }
    local callback = function() return 1 end
    local a, b = new_app(function()
        form = K.form({ name = reset_value.value, enabled = false, coins = 0,
            stats = nested, callback = callback })
        K.Text(form.name.value .. ":" .. form.coins.value)
    end)
    saved = form
    assert(K.is_state(form.name) and K.is_state(form.enabled))
    eq(form.enabled:peek(), false)
    eq(form.stats:peek(), nested, "nested field remains ordinary table")
    eq(form.callback:peek(), callback, "function is a field value")
    form.name.value = "edited"
    form.coins.value = 100
    a:frame(0)
    eq(b:texts()[1], "edited:100")
    reset_value.value = "new initial"
    a:frame(0)
    eq(form, saved, "stable form identity")
    eq(form.name, saved.name, "stable field identity")
    eq(form.name:peek(), "edited", "initial values do not overwrite edits")
    eq(#a.rt.errors, 0)
    a:dispose()
end)

test("form belongs to its keyed component and is recreated with a new key", function()
    local forms = {}
    local key = K.new_state(0)
    local a = new_app(function()
        for _, id in ipairs({ "left", "right" }) do
            K.key(id .. key.value, function()
                forms[id] = K.form({ name = id })
                K.Text(forms[id].name.value)
            end)
        end
    end)
    assert(forms.left ~= forms.right and forms.left.name ~= forms.right.name)
    forms.left.name.value = "changed"
    a:frame(0)
    eq(forms.right.name:peek(), "right")
    local old = forms.left
    key.value = 1
    a:frame(0)
    assert(forms.left ~= old)
    eq(forms.left.name:peek(), "left")
    eq(#a.rt.errors, 0)
    a:dispose()
end)

test("form updates only the field consumers", function()
    local form, parent_runs, runs = nil, 0, { name = 0, coins = 0 }
    local Field = K.component(function(props)
        runs[props.id] = runs[props.id] + 1
        K.Text(tostring(props.state.value))
    end)
    local a = new_app(function()
        parent_runs = parent_runs + 1
        form = K.form({ name = "Петя", coins = 0 })
        Field({ id = "name", state = form.name })
        Field({ id = "coins", state = form.coins })
    end)
    form.name.value = "Player"
    a:frame(0)
    eq(parent_runs, 1)
    eq(runs.name, 2)
    eq(runs.coins, 1)
    eq(#a.rt.errors, 0)
    a:dispose()
end)

test("form rejects schema changes and invalid initial values", function()
    assert(not pcall(K.form, false))
    assert(not pcall(K.form, {}), "form is a composition hook")
    for _, initial in ipairs({ {}, { name = "a", extra = 1 } }) do
        local change = K.new_state(false)
        local a = new_app(function()
            K.form(change.value and initial or { name = "a" })
        end)
        change.value = true
        a:frame(0)
        assert(a.rt.error_text and a.rt.error_text:find("K.form schema changed", 1, true))
        a:dispose()
    end
    local a = new_app(function() K.form({}) end)
    eq(#a.rt.errors, 0, "empty fixed schema is valid")
    a:dispose()
end)

test("hook types are checked before reusing a slot", function()
    local change = K.new_state(false)
    local side_effects = 0
    local a = K.App.new({
        width = 400, height = 300, hook_diagnostics = true,
        measurer = recorder.measurer(),
        content = function()
            if change.value then
                K.effect(function() side_effects = side_effects + 1 end)
            else
                K.state(0)
            end
        end,
    })
    a:frame(0)
    change.value = true
    a:frame(0)
    local err = a.rt.error_text
    assert(err and err:find("expected state, got effect", 1, true), tostring(err))
    assert(err:find("Previous:", 1, true) and err:find("Current:", 1, true))
    assert(err:find("core.lua", 1, true), "error includes source location")
    eq(side_effects, 0)
    change.value = false
    a:frame(0)
    eq(a.rt.error_text, nil, "original order recovers")
    a:dispose()
end)

test("hook count detects additions and removals including a zero-hook baseline", function()
    for _, starts_with_hook in ipairs({ false, true }) do
        local visible = K.new_state(starts_with_hook)
        local calls = 0
        local a = new_app(function()
            if visible.value then
                K.effect(function() calls = calls + 1 end)
            end
        end)
        local before = calls
        visible.value = not starts_with_hook
        a:frame(0)
        assert(a.rt.error_text and a.rt.error_text:find("Hook order changed", 1, true))
        eq(calls, before, "invalid added hook cannot run")
        visible.value = starts_with_hook
        a:frame(0)
        eq(a.rt.error_text, nil)
        a:dispose()
    end
end)

test("public animation and state hooks have distinct types", function()
    local hooks = {
        function() K.animate(1) end,
        function() K.clock() end,
        function() K.after(1) end,
        function() K.form({ name = "a" }) end,
        function() K.interaction() end,
        function() K.scroll_state() end,
        function() K.lazy_state() end,
        function() K.text_field_state() end,
        function() K.poll(function() return 1 end) end,
        function() K.on_frame(function() end) end,
        function() K.on_dispose(function() end) end,
    }
    local names = { "animate", "clock", "after", "form", "interaction", "scroll_state",
        "lazy_state", "text_field_state", "poll", "on_frame", "on_dispose" }
    for i, hook in ipairs(hooks) do
        local change = K.new_state(false)
        local a = new_app(function()
            if change.value then hook() else K.remember(1) end
        end)
        change.value = true
        a:frame(0)
        assert(a.rt.error_text and a.rt.error_text:find("expected remember, got " .. names[i], 1, true), names[i])
        a:dispose()
    end
end)

test("correct keyed branches and compound hooks keep a stable order", function()
    local show = K.new_state(false)
    local disposed = 0
    local a = K.App.new({
        width = 400, height = 300, hook_diagnostics = true,
        measurer = recorder.measurer(),
        content = function()
            K.state(0)
            K.form({ name = "test" })
            K.animate(1)
            K.clock()
            K.after(1)
            K.poll(function() return 1 end)
            if show.value then
                K.key("child", function()
                    K.state(0)
                    K.on_dispose(function() disposed = disposed + 1 end)
                end)
            end
        end,
    })
    for _, visible in ipairs({ false, true, false, true, false }) do
        show.value = visible
        a:frame(0.1)
        eq(#a.rt.errors, 0)
    end
    eq(disposed, 2)
    eq(a.rt.root_scope.hook_count, 6, "one slot per public hook including poll")
    a:dispose()
    eq(next(a.rt.pollers), nil, "poll cleanup still works")
end)

test("failed component is retried and pending effects wait for a valid composition", function()
    local mode = K.new_state("valid")
    local parent_tick = K.new_state(0)
    local effects, cleanup, child_runs = 0, 0, 0
    local Child = K.component(function()
        child_runs = child_runs + 1
        local current = mode.value
        K.effect(function()
            effects = effects + 1
            return function() cleanup = cleanup + 1 end
        end, current)
        if current ~= "invalid" then K.state(0) end
    end)
    local a = new_app(function()
        K.Text(tostring(parent_tick.value))
        Child()
    end)
    eq(effects, 1)
    mode.value = "invalid"
    a:frame(0)
    assert(a.rt.error_text)
    eq(effects, 1)
    eq(cleanup, 0, "existing committed effect remains intact")
    local before = child_runs
    parent_tick.value = 1
    a:frame(0)
    assert(child_runs > before and a.rt.error_text, "failed clean-props child must not be skipped")
    mode.value = "recovered"
    a:frame(0)
    eq(a.rt.error_text, nil)
    eq(effects, 2, "cancelled dependency change is retried")
    eq(cleanup, 1)
    a:dispose()
    eq(cleanup, 2)
end)

test("failed first composition rolls back new hooks and their resources", function()
    local mode = K.new_state("invalid")
    local frames, effects = 0, 0
    local a = new_app(function()
        if mode.value == "invalid" then
            K.state(0)
            K.clock()
            K.poll(function() return 1 end)
            K.on_frame(function() frames = frames + 1 end)
            K.effect(function() effects = effects + 1 end)
            error("first composition failed")
        else
            K.form({ name = "recovered" })
        end
    end)
    assert(a.rt.error_text)
    eq(frames, 0)
    eq(effects, 0)
    eq(next(a.rt.pollers), nil)
    eq(#a.rt.root_scope.slots, 0)
    mode.value = "recovered"
    a:frame(0.1)
    eq(a.rt.error_text, nil, "only successful composition defines order")
    eq(a.rt.root_scope.hook_kinds[1], "form")
    eq(frames, 0, "rolled back frame callback stays inactive")
    eq(#a.rt.anims, 0, "rolled back clock stops")
    a:dispose()
end)

test("failed initializer does not establish a hook baseline", function()
    local broken = K.new_state(true)
    local a = new_app(function()
        if broken.value then
            K.state(function() error("initializer failed") end)
        else
            K.form({ name = "valid" })
        end
    end)
    assert(a.rt.error_text)
    eq(next(a.rt.root_scope.hook_kinds), nil)
    broken.value = false
    a:frame(0)
    eq(a.rt.error_text, nil)
    a:dispose()
    local invalid = new_app(function()
        K.remember(function() return K.state(1) end)
    end)
    assert(invalid.rt.error_text and invalid.rt.error_text:find("hook called inside initializer of remember", 1, true))
    invalid:dispose()
end)

test("column with padding and spacing", function()
    local a = new_app(function()
        K.Column({ spacing = 10, modifier = M:tag("col"):padding(20) }, function()
            K.Box({ modifier = M:size(50, 30):tag("a") })
            K.Box({ modifier = M:size(80, 40):tag("b") })
        end)
    end)
    local col, pa, pb = tag(a, "col"), tag(a, "a"), tag(a, "b")
    eq(col.w, 80 + 40, "column width")
    eq(col.h, 30 + 10 + 40 + 40, "column height")
    eq(pa.x, 20, "a.x")
    eq(pa.y, 20, "a.y")
    eq(pb.y, 20 + 30 + 10, "b.y")
end)

test("row weights split the free space", function()
    local a = new_app(function()
        K.Row({ modifier = M:width(300), spacing = 0 }, function()
            K.Box({ modifier = M:width(60):height(10) })
            K.Box({ modifier = M:weight(1):height(10):tag("w1") })
            K.Box({ modifier = M:weight(2):height(10):tag("w2") })
        end)
    end)
    eq(tag(a, "w1").w, 80, "weight 1")
    eq(tag(a, "w2").w, 160, "weight 2")
    eq(tag(a, "w2").x, 140, "w2.x")
end)

test("arrangement between and center alignment", function()
    local a = new_app(function()
        K.Row(
            { modifier = M:width(200):height(50), arrangement = "between", align = "center" },
            function()
                K.Box({ modifier = M:size(20):tag("l") })
                K.Box({ modifier = M:size(20):tag("r") })
            end
        )
    end)
    eq(tag(a, "l").x, 0)
    eq(tag(a, "r").x, 180)
    eq(tag(a, "l").y, 15, "centered vertically")
end)

test("box alignment and fill", function()
    local a = new_app(function()
        K.Box({ modifier = M:size(100):tag("box"), align = "bottom_end" }, function()
            K.Box({ modifier = M:size(10):tag("c") })
            K.Box({ modifier = M:size(10):align("center"):tag("m") })
            K.Box({ modifier = M:fill_max_width():height(5):tag("f") })
        end)
    end)
    eq(tag(a, "c").x, 90)
    eq(tag(a, "c").y, 90)
    eq(tag(a, "m").x, 45)
    eq(tag(a, "m").y, 45)
    eq(tag(a, "f").w, 100, "fill width")
end)

test("modifier order: padding outside vs inside background", function()
    local a, b = new_app(function()
        K.Box({ modifier = M:padding(10):background("#ff0000"):size(40) })
    end)
    local r = b:find("rect")
    eq(r.x, 10, "background after padding starts inside")
    eq(r.w, 40, "background size")
end)

test("text wraps by words and ellipsizes", function()
    local a = new_app(function()
        K.Column({ modifier = M:width(100) }, function()
            K.Text(
                "один два три четыре пять",
                { font = "kompot_10", modifier = M:tag("t") }
            )
            K.Text(
                "очень длинная строка без переноса",
                { font = "kompot_10", wrap = false, modifier = M:tag("e") }
            )
        end)
    end)
    -- приближённый измеритель: 5.5 px на символ шрифта 10
    local t = tag(a, "t")
    assert(t.h > 13, "wrapped to several lines, h=" .. t.h)
    local found = false
    for _, s in ipairs(a.backend and a.backend:texts() or {}) do
        if s:find("…") then
            found = true
        end
    end
    assert(found, "ellipsis")
end)

test("trailing spaces separate adjacent Text elements", function()
    local text = require("kompot:kompot/core/text")
    local m = recorder.measurer()
    local font = "kompot_14"
    local laid = text.layout(m, font, "Тест1 ", 400)
    eq(laid.lines[1], "Тест1 ", "last line keeps its space")
    eq(laid.w, m:width(font, "Тест1 "), "space has width")
    local wrapped = text.layout(m, font, "A B ", m:width(font, "A "))
    eq(wrapped.lines[1], "A", "soft wrap drops preceding space")
    eq(wrapped.lines[2], "B ", "last wrapped line keeps its space")
    local rich =
        text.layout_rich(m, { { text = "A ", font = font }, { text = "B ", font = font } }, 400)
    eq(rich.lines[1].w, m:width(font, "A B "), "rich text keeps spaces")

    local a, b = new_app(function()
        K.Row({}, function()
            K.Text("Тест1 ", { modifier = M:tag("first") })
            K.Text("Тест2", { modifier = M:tag("second") })
        end)
    end)
    eq(tag(a, "first").w, m:width(font, "Тест1 "), "first element includes space")
    eq(tag(a, "second").x, tag(a, "first").x + tag(a, "first").w, "next element starts after space")
    eq(
        b:find("text", function(p)
            return p.text == "Тест1 "
        end).text,
        "Тест1 ",
        "backend keeps space"
    )
end)

test("scroll state clips and offsets content", function()
    local st
    local a, b = new_app(function()
        st = K.scroll_state()
        K.Column({ modifier = M:height(100):vertical_scroll(st):tag("sc") }, function()
            for i = 1, 10 do
                K.Box({ modifier = M:size(50, 30):tag("i" .. i) })
            end
        end)
    end)
    eq(st.max, 200, "scroll range")
    local p = tag(a, "sc")
    a:frame(0, { x = p.x + 5, y = p.y + 5, wheel = -1 })
    eq(st.value, 48, "wheel scrolled")
    a:frame(0)
    eq(tag(a, "i2").y, 30 - 48, "content moved up")
end)

test("wheel reaches parent scroll through a blocking child", function()
    local scroll
    local a = new_app(function()
        scroll = K.scroll_state()
        K.Column({ modifier = M:height(100):vertical_scroll(scroll) }, function()
            K.Box({ modifier = M:size(120, 300):block_pointer() })
        end)
    end)
    a:frame(0, { x = 10, y = 10, wheel = -1, inside = true })
    eq(scroll.value, 48, "parent scroll received wheel")
end)

-- Состояние и рекомпозиция

test("click updates state and recomposes", function()
    local a, b = new_app(function()
        local n = K.state(0)
        K.Column(function()
            K.Text("count " .. n.value)
            K.Box({
                modifier = M:size(40)
                    :clickable(function()
                        n.value = n.value + 1
                    end)
                    :tag("btn"),
            })
        end)
    end)
    eq(b:texts()[1], "count 0")
    click(a, "btn")
    click(a, "btn")
    eq(b:texts()[1], "count 2")
end)

test("keyboard focus skips disabled controls and activates the focused control", function()
    local calls = {}
    local focused
    local a = new_app(function()
        focused = K.interaction()
        K.Column(function()
            K.Box({
                modifier = M:size(40, 20)
                    :clickable(function()
                        calls[#calls + 1] = "a"
                    end, { interaction = focused })
                    :tag("a"),
            })
            K.Box({
                modifier = M:size(40, 20)
                    :clickable(function()
                        calls[#calls + 1] = "disabled"
                    end, { enabled = false })
                    :tag("disabled"),
            })
            K.Box({
                modifier = M:size(40, 20)
                    :clickable(function()
                        calls[#calls + 1] = "b"
                    end)
                    :tag("b"),
            })
        end)
    end)
    a:frame(0, { key = "tab" })
    eq(focused.focused:peek(), true, "first control focused")
    a:frame(0, { key = "enter" })
    a:frame(0, { key = "tab" })
    a:frame(0, { key = "space" })
    a:frame(0, { key = "tab", shift = true })
    eq(focused.focused:peek(), true, "reverse tab returns to first control")
    a:frame(0, { key = "escape" })
    eq(focused.focused:peek(), false, "escape clears focus")
    eq(table.concat(calls, ","), "a,b", "keyboard activation")
end)

test("mouse focus does not draw a keyboard focus ring", function()
    local a = new_app(function()
        K.Box({ modifier = M:size(40, 20):clickable(function() end):tag("button") })
    end)
    local function ring()
        for _, p in ipairs(a.dl) do
            if p.key:find("|focus", 1, true) then
                return true
            end
        end
        return false
    end
    click(a, "button")
    eq(ring(), false, "mouse click has no keyboard ring")
    a:frame(0, { key = "tab" })
    eq(ring(), true, "Tab shows keyboard ring")
    click(a, "button")
    eq(ring(), false, "mouse click hides existing keyboard ring")
end)

test("Tab stays inside the topmost modal focus scope", function()
    local a = new_app(function()
        K.Column(function()
            K.Box({ modifier = M:size(40, 20):clickable(function() end):tag("background") })
            K.Box({
                modifier = M:size(40, 20)
                    :clickable(function() end, { focusable = false, focus_scope = true })
                    :tag("scrim"),
            })
            K.Box({ modifier = M:size(40, 20):clickable(function() end):tag("confirm") })
            K.Box({ modifier = M:size(40, 20):clickable(function() end):tag("cancel") })
        end)
    end)
    local function focused(name)
        local p = tag(a, name)
        return a.input.focus_region and a.input.focus_region.y == p.y
    end
    a:frame(0, { key = "tab" })
    eq(focused("confirm"), true, "first modal control")
    a:frame(0, { key = "tab" })
    eq(focused("cancel"), true, "second modal control")
    a:frame(0, { key = "tab" })
    eq(focused("confirm"), true, "modal focus wraps")
    a:frame(0, { key = "tab", shift = true })
    eq(focused("cancel"), true, "reverse modal focus wraps")
end)

test("image source size, contain and cover preserve aspect ratio", function()
    local a, b = new_app(function()
        K.Column(function()
            K.Image(
                "sample",
                { width = 100, source_size = { 200, 100 }, modifier = M:tag("intrinsic") }
            )
            K.Image(
                "sample",
                { width = 100, height = 100, source_size = { 200, 100 }, fit = "contain" }
            )
            K.Image(
                "sample",
                { width = 100, height = 100, source_size = { 200, 100 }, fit = "cover" }
            )
            K.Image("sample", {
                width = 100,
                height = 100,
                source_size = { 200, 100 },
                region = { 0, 0.5, 1, 1 },
                fit = "cover",
            })
            K.Image("sample", { source_size = { 30, 20 }, modifier = M:tag("native") })
        end)
    end, 400, 500)
    eq(tag(a, "intrinsic").h, 50, "height from source aspect")
    eq(tag(a, "native").w, 30, "native width")
    eq(tag(a, "native").h, 20, "native height")
    local images = {}
    for _, p in ipairs(b.dl) do
        if p.kind == "image" then
            images[#images + 1] = p
        end
    end
    eq(images[2].x, 0, "contained image x")
    eq(images[2].y, 75, "contained image centered vertically")
    eq(images[2].w, 100, "contained width")
    eq(images[2].h, 50, "contained height")
    eq(images[3].region[1], 0.25, "cover crops left UV")
    eq(images[3].region[3], 0.75, "cover crops right UV")
    eq(images[4].region[1], 0.375, "cover respects original atlas region")
    eq(images[4].region[2], 0.5, "cover keeps original vertical UV")
end)

test("clean components are skipped", function()
    local child_runs = 0
    local Child = K.component(function(props)
        child_runs = child_runs + 1
        K.Text("child " .. props.label)
    end)
    local outer
    local a = new_app(function()
        outer = K.state(0)
        K.Column(function()
            K.Text("outer " .. outer.value)
            Child({ label = "x" })
        end)
    end)
    eq(child_runs, 1)
    outer.value = 5
    a:frame(0)
    eq(child_runs, 1, "child skipped when props are equal")
end)

test("state survives inside key groups and providers", function()
    local counters = {}
    local a = new_app(function()
        K.Theme(K.BASE_THEME, function()
            for _, id in ipairs({ "a", "b" }) do
                K.key(id, function()
                    local s = K.state(0)
                    counters[id] = s
                    K.Text(id .. s.value)
                end)
            end
        end)
    end)
    counters.a.value = 3
    a:frame(0)
    counters.b.value = 7
    a:frame(0)
    eq(counters.a:peek(), 3, "a kept")
    eq(counters.b:peek(), 7, "b kept")
end)

test("effects run after commit and clean up on dispose", function()
    local log = {}
    local show
    local a = new_app(function()
        show = K.state(true)
        if show.value then
            K.key("fx", function()
                K.effect(function()
                    log[#log + 1] = "start"
                    return function()
                        log[#log + 1] = "stop"
                    end
                end)
                K.Text("fx")
            end)
        end
    end)
    eq(table.concat(log, ","), "start")
    show.value = false
    a:frame(0)
    eq(table.concat(log, ","), "start,stop")
end)

test("tween animation reaches the target", function()
    local target
    local value
    local a = new_app(function()
        target = K.state(0)
        value = K.animate(target.value, K.tween(0.2, "linear"))
        K.Text(tostring(value))
    end)
    target.value = 100
    a:frame(0)
    a:frame(0.1)
    assert(value > 40 and value < 60, "halfway: " .. value)
    a:frame(0.15)
    eq(value, 100, "done")
end)

test("spring animation settles", function()
    local target, value
    local a = new_app(function()
        target = K.state(0)
        value = K.animate(target.value, K.spring(400, 0.8))
    end)
    target.value = 50
    for _ = 1, 120 do
        a:frame(1 / 60)
    end
    eq(value, 50, "settled")
end)

-- Ленивые списки и всплывающие слои

test("lazy column composes only visible items", function()
    local composed = {}
    local st
    local a, b = new_app(function()
        st = K.lazy_state()
        K.LazyColumn({
            count = 1000,
            state = st,
            modifier = M:height(100):width(100):tag("list"),
            item = function(i)
                composed[i] = true
                K.Box({ modifier = M:height(20) }, function()
                    K.Text("item " .. i)
                end)
            end,
        })
    end)
    local n = 0
    for _ in pairs(composed) do
        n = n + 1
    end
    assert(n >= 5 and n <= 7, "visible items composed: " .. n)
    local p = tag(a, "list")
    for _ = 1, 20 do
        a:frame(0, { x = p.x + 5, y = p.y + 5, wheel = -1 })
    end
    a:frame(0)
    assert(st.first > 40, "scrolled far: first = " .. st.first)
    local texts = b:texts()
    assert(texts[1]:find("item"), "items rendered")
end)

test("fast lazy scrolling does not compose skipped rows", function()
    local st, composed, active = nil, 0, 0
    local a = new_app(function()
        st = K.lazy_state()
        K.LazyColumn({
            count = 10000,
            state = st,
            modifier = M:size(400, 320),
            item = function(i)
                composed = composed + 1
                K.effect(function()
                    active = active + 1
                    return function()
                        active = active - 1
                    end
                end, {})
                K.Row({ modifier = M:fill_max_width():height(36), spacing = 12 }, function()
                    K.Text("#" .. i)
                    K.Box({ modifier = M:size(12):background("#ABCDEF", 6) })
                    K.Text("row " .. i)
                end)
            end,
        })
    end)
    composed = 0
    local t = os.clock()
    st:scroll_by(360000)
    a:frame(0)
    print(
        string.format(
            "lazy 10000-row jump: %.2f ms, composed: %d, active: %d",
            (os.clock() - t) * 1000,
            composed,
            active
        )
    )
    assert(composed <= 20, "composed skipped rows: " .. composed)
    assert(active <= 10, "retained offscreen rows: " .. active)
    eq(st.first, 9992, "last page")
    composed = 0
    st:scroll_by(-360000)
    a:frame(0)
    eq(st.first, 1, "back to first page")
    assert(composed <= 20, "composed skipped rows on return: " .. composed)
    assert(active <= 10, "retained rows on return: " .. active)
    a:dispose()
    eq(active, 0, "row effects cleaned up")
end)

test("lazy variable sizes, keys, spacing and empty list", function()
    local st, count, active
    active = 0
    local a, b = new_app(function()
        st = K.lazy_state()
        count = K.state(10000)
        K.LazyColumn({
            count = count.value,
            state = st,
            spacing = 3,
            pad = 7,
            key_of = function(i)
                return "row:" .. i
            end,
            modifier = M:size(200, 100),
            item = function(i)
                K.effect(function()
                    active = active + 1
                    return function()
                        active = active - 1
                    end
                end, {})
                K.Box({ modifier = M:height(i % 2 == 0 and 30 or 20) }, function()
                    K.Text("row " .. i)
                end)
            end,
        })
    end)
    for _, delta in ipairs({ 1e6, -1e6, 50000, 1e6, -1e6 }) do
        st:scroll_by(delta)
        a:frame(0)
        assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
        assert(#b:texts() >= 3 and #b:texts() <= 5, "viewport filled")
        assert(active <= 6, "only nearby rows retained")
        if delta == 1e6 then
            eq(b:texts()[#b:texts()], "row 10000", "end reached")
        elseif delta == -1e6 then
            eq(st.first, 1, "start reached")
        end
    end
    count.value = 0
    a:frame(0)
    eq(active, 0, "empty list disposes all rows")
    eq(st.total, 0, "empty extent")
    eq(#b:texts(), 0, "empty rendering")
    a:dispose()
end)

test("lazy position observers receive the settled position", function()
    local st, shown, fraction
    local a = new_app(function()
        st = K.lazy_state()
        shown, fraction = st:first_visible(), st:fraction()
        K.LazyColumn({
            count = 10000,
            state = st,
            modifier = M:size(100, 100),
            item = function(i)
                K.Box({ modifier = M:height(20) })
            end,
        })
    end)
    for _, delta in ipairs({ 200000, -200000 }) do
        st:scroll_by(delta)
        a:frame(0)
        a:frame(0)
        eq(shown, st.first, "first-visible observer")
        eq(fraction, delta > 0 and 1 or 0, "scrollbar observer")
        assert(not a.rt.need_compose, "position notification must settle")
    end
    a:dispose()
end)

test("lazy row skips distant items", function()
    local st, runs = nil, 0
    local a = new_app(function()
        st = K.lazy_state()
        K.LazyRow({
            count = 10000,
            state = st,
            modifier = M:size(100, 30),
            item = function(i)
                runs = runs + 1
                K.Box({ modifier = M:size(20, 30) })
            end,
        })
    end)
    runs = 0
    st:scroll_by(200000)
    a:frame(0)
    eq(st.first, 9996, "horizontal last page")
    assert(runs <= 6, "horizontal skipped items composed")
    a:dispose()
end)

test("popup is placed below its anchor on top of everything", function()
    local a, b = new_app(function()
        K.Column(function()
            K.Box({ modifier = M:size(50, 20) })
            K.Box({ modifier = M:size(60, 30):tag("anchor_box") }, function()
                K.Popup({ placement = "below" }, function()
                    K.Box({ modifier = M:size(80, 40):background("#00ff00"):tag("pop") })
                end)
            end)
        end)
    end)
    local anchor, pop = tag(a, "anchor_box"), tag(a, "pop")
    eq(pop.y, anchor.y + anchor.h + 4, "below with gap")
    eq(b.dl[#b.dl].kind, "rect", "popup drawn last")
end)

test("display list keys are stable between frames", function()
    local s
    local a, b = new_app(function()
        s = K.state("a")
        K.Column(function()
            K.Text(s.value)
            K.Box({ modifier = M:size(10):background("#fff") })
        end)
    end)
    local keys1 = {}
    for _, p in ipairs(b.dl) do
        keys1[#keys1 + 1] = p.key
    end
    s.value = "b"
    a:frame(0)
    local keys2 = {}
    for _, p in ipairs(b.dl) do
        keys2[#keys2 + 1] = p.key
    end
    eq(table.concat(keys1, " "), table.concat(keys2, " "))
end)

test("errors in UI do not crash and are shown", function()
    local a, b = new_app(function()
        error("boom")
    end)
    assert(a.rt.error_text and a.rt.error_text:find("boom"), "error captured")
    assert(
        b:find("rect", function(p)
            return p.key == "__error_bg"
        end),
        "error overlay"
    )
end)

test("hover and cursor via interaction", function()
    local inter
    local a = new_app(function()
        inter = K.interaction()
        K.Box({ modifier = M:size(40):clickable(function() end, { interaction = inter }):tag("h") })
    end)
    local p = tag(a, "h")
    a:frame(0, { x = p.x + 5, y = p.y + 5 })
    eq(inter.hovered:peek(), true, "hovered")
    eq(a.input.cursor, "pointer")
    a:frame(0, { x = 300, y = 290 })
    eq(inter.hovered:peek(), false, "unhovered")
end)

test("drag reports deltas", function()
    local dx_sum = 0
    local a = new_app(function()
        K.Box({
            modifier = M:size(40)
                :draggable({
                    on_event = function(e)
                        if e.type == "move" then dx_sum = dx_sum + e.dx end
                    end,
                })
                :tag("d"),
        })
    end)
    local p = tag(a, "d")
    local x, y = p.x + 5, p.y + 5
    a:frame(0, { x = x, y = y, down = true })
    a:frame(0, { x = x + 10, y = y, down = true })
    a:frame(0, { x = x + 30, y = y, down = true })
    a:frame(0, { x = x + 30, y = y, down = false })
    eq(dx_sum, 30, "dragged distance")
end)

test("drag targets receive enter, leave and drop across captured pointer", function()
    local events = {}
    local accepted
    local a = new_app(function()
        K.Row(function()
            K.Box({
                modifier = M:size(40)
                    :draggable({
                        on_event = function(e)
                            if e.type == "start" then return "item"
                            elseif e.type == "end" then accepted = e.accepted end
                        end,
                    })
                    :tag("source"),
            })
            for i = 1, 2 do
                K.Box({
                    modifier = M:size(40)
                        :drop_target({
                            on_enter = function(item)
                                events[#events + 1] = "enter" .. i .. item
                            end,
                            on_leave = function(item)
                                events[#events + 1] = "leave" .. i .. item
                            end,
                            on_drop = function(item)
                                events[#events + 1] = "drop" .. i .. item
                            end,
                        })
                        :tag("target" .. i),
                })
            end
            K.Box({
                modifier = M:size(40)
                    :drop_target({
                        on_drop = function()
                            return false
                        end,
                    })
                    :tag("reject"),
            })
        end)
    end)
    local s, t1, t2 = tag(a, "source"), tag(a, "target1"), tag(a, "target2")
    a:frame(0, { x = s.x + 5, y = s.y + 5, down = true })
    a:frame(0, { x = t1.x + 5, y = t1.y + 5, down = true })
    a:frame(0, { x = t2.x + 5, y = t2.y + 5, down = true })
    a:frame(0, { x = t2.x + 5, y = t2.y + 5, down = false })
    eq(table.concat(events, ","), "enter1item,leave1item,enter2item,drop2item,leave2item")
    eq(accepted, true, "drop accepted")
    local reject = tag(a, "reject")
    a:frame(0, { x = s.x + 5, y = s.y + 5, down = true })
    a:frame(0, { x = reject.x + 5, y = reject.y + 5, down = true })
    a:frame(0, { x = reject.x + 5, y = reject.y + 5, down = false })
    eq(accepted, false, "rejected drop")
end)

test("right drag visits drop target without right click", function()
    local events = {}
    local a = new_app(function()
        K.Row(function()
            K.Box({
                modifier = M:size(40)
                    :clickable(nil, {
                        on_right_click = function()
                            events[#events + 1] = "click"
                        end,
                    })
                    :draggable({
                        button = "right",
                        on_event = function(e)
                            if e.type == "start" then return "stack" end
                        end,
                    }),
            })
            K.Box({
                modifier = M:size(40):drop_target({
                    on_enter = function(item)
                        events[#events + 1] = "enter:" .. item
                    end,
                    on_drop = function(item)
                        events[#events + 1] = "drop:" .. item
                    end,
                }),
            })
        end)
    end)
    a:frame(0, { x = 5, y = 5, rdown = true })
    a:frame(0, { x = 45, y = 5, rdown = true })
    a:frame(0, { x = 45, y = 5, rdown = false })
    eq(table.concat(events, ","), "enter:stack,drop:stack")
end)

test("layout performance: local change in a large screen", function()
    -- 40x25 ячеек-компонентов (~4000 узлов); меняется одна ячейка, как при
    -- наведении или анимации одного слота
    local cells = {}
    local Cell = K.component(function(p)
        local on = K.state(false)
        cells[p.i] = on
        K.Box({
            modifier = M:size(28):background(on.value and "#ffcc00" or "#333333", 4):padding(2),
        }, function()
            K.Text(tostring(p.i))
        end)
    end)
    local a = new_app(function()
        K.Column({ spacing = 2 }, function()
            for r = 1, 40 do
                K.Row({ spacing = 2 }, function()
                    for c = 1, 25 do
                        Cell({ i = (r - 1) * 25 + c })
                    end
                end)
            end
        end)
    end, 1000, 1400)
    local t0 = os.clock()
    for i = 1, 20 do
        local cell = cells[(i * 37) % 1000 + 1]
        cell.value = not cell:peek()
        a:frame(0)
    end
    local ms = (os.clock() - t0) * 1000 / 20
    print(string.format("local change in ~4000 nodes: %.2f ms", ms))
end)

test("preview renders without the engine", function()
    K.preview("test/hello", { width = 200, height = 100 }, function()
        K.Text("hello preview")
    end)
    local dl = require("kompot:kompot/preview").render("test/hello")
    local found = false
    for _, p in ipairs(dl) do
        if p.kind == "text" and p.text == "hello preview" then
            found = true
        end
    end
    assert(found, "text in preview")
end)

test("layout performance: 600 nodes", function()
    local s
    local a = new_app(function()
        s = K.state(0)
        K.Column(function()
            for i = 1, 200 do
                K.Row({ spacing = 4 }, function()
                    K.Box({ modifier = M:size(10):background("#fff") })
                    K.Text("row " .. i .. " " .. s.value)
                end)
            end
        end)
    end, 800, 4000)
    local t0 = os.clock()
    for i = 1, 20 do
        s.value = i
        a:frame(0)
    end
    local ms = (os.clock() - t0) * 1000 / 20
    print(string.format("recompose+layout+render of ~600 nodes: %.2f ms", ms))
    assert(ms < 20, "too slow: " .. ms)
end)

-- Частичная рекомпозиция

test("state change reruns only the dirty scope", function()
    local parent_runs, leaf_runs = 0, 0
    local leaf_state
    local Leaf = K.component(function()
        leaf_runs = leaf_runs + 1
        leaf_state = K.state(0)
        K.Text("leaf " .. leaf_state.value)
    end)
    local a, b = new_app(function()
        parent_runs = parent_runs + 1
        K.Column(function()
            K.Text("parent")
            Leaf()
            K.Text("after")
        end)
    end)
    eq(parent_runs, 1)
    eq(leaf_runs, 1)
    leaf_state.value = 42
    a:frame(0)
    eq(parent_runs, 1, "parent not rerun")
    eq(leaf_runs, 2, "leaf rerun")
    local texts = b:texts()
    eq(texts[2], "leaf 42")
    eq(texts[3], "after", "sibling order kept")
end)

test("animation in a leaf does not recompose ancestors", function()
    local parent_runs = 0
    local target
    local Leaf = K.component(function()
        target = K.state(0)
        local v = K.animate(target.value, K.tween(0.5, "linear"))
        K.Box({ modifier = M:size(math.floor(v) + 1, 10):background("#fff"):tag("anim") })
    end)
    local a = new_app(function()
        parent_runs = parent_runs + 1
        K.Row(function()
            Leaf()
        end)
    end)
    target.value = 100
    -- анимация стартует в кадре рекомпозиции, дальше 0.5 с
    for _ = 1, 12 do
        a:frame(0.05)
    end
    eq(parent_runs, 1, "parent composed once")
    eq(tag(a, "anim").w, 101, "animated to the end")
end)

test("state inside a lazy item updates that item only", function()
    local item_states = {}
    local runs = {}
    local a, b = new_app(function()
        K.LazyColumn({
            count = 50,
            modifier = M:height(200):width(100),
            item = function(i)
                runs[i] = (runs[i] or 0) + 1
                local s = K.state(0)
                item_states[i] = s
                K.Text("item " .. i .. ":" .. s.value)
            end,
        })
    end)
    local before3 = runs[3]
    item_states[2].value = 9
    a:frame(0)
    eq(runs[3], before3, "other items not recomposed")
    local found = false
    for _, t in ipairs(b:texts()) do
        if t == "item 2:9" then
            found = true
        end
    end
    assert(found, "item updated")
end)

-- Мост к обычному коду, разметка, ввод

test("poll reruns the scope only when the source changes", function()
    local source = { n = 1 }
    local runs = 0
    local a, b = new_app(function()
        K.Column(function()
            local Probe = K.component(function()
                runs = runs + 1
                local n = K.poll(function()
                    return source.n
                end)
                K.Text("n=" .. n)
            end)
            Probe()
            K.Text("static")
        end)
    end)
    local before = runs
    a:frame(0)
    a:frame(0)
    eq(runs, before, "no change - no rerun")
    source.n = 5
    a:frame(0)
    eq(runs, before + 1, "rerun on change")
    local found = false
    for _, s in ipairs(b:texts()) do
        if s == "n=5" then
            found = true
        end
    end
    assert(found, "new value shown")
end)

test("poll compares tables by fields", function()
    local runs = 0
    local a = new_app(function()
        runs = runs + 1
        local t = K.poll(function()
            return { x = 1, y = 2 }
        end)
        K.Text(t.x .. "," .. t.y)
    end)
    local before = runs
    for _ = 1, 3 do
        a:frame(0)
    end
    eq(runs, before, "equal tables do not rerun")
end)

test("md markup: colors and bold become runs", function()
    local runs = K.text.parse_md("[#FFD84D]ЛКМ[#E8E6DF] тянуть **жирно** \\[x]")
    eq(#runs, 4, "run count")
    eq(runs[1].text, "ЛКМ", "first run")
    assert(
        math.abs(runs[1].color[1] - 1) < 0.01 and math.abs(runs[1].color[2] - 0.847) < 0.01,
        "yellow"
    )
    eq(runs[3].text, "жирно", "bold text")
    eq(runs[3].bold, true, "bold flag")
    eq(runs[4].text, " [x]", "escaped bracket")
end)

test("rich text wraps across runs and keeps colors", function()
    local a, b = new_app(function()
        K.Box({ modifier = M:width(120) }, function()
            K.Text(
                "[#FF0000]красный[#00FF00] зелёный текст переносится **по словам**",
                { markup = "md" }
            )
        end)
    end)
    local red, lines = nil, {}
    for _, p in ipairs(b.dl) do
        if p.kind == "text" then
            if p.text == "красный" then
                red = p
            end
            lines[p.y] = true
        end
    end
    assert(red and red.color[1] > 0.99 and red.color[2] < 0.01, "red run")
    local n = 0
    for _ in pairs(lines) do
        n = n + 1
    end
    assert(n >= 2, "wrapped into lines: " .. n)
end)

test("right click reaches on_right_click", function()
    local left, right = 0, 0
    local a = new_app(function()
        K.Box({
            modifier = M:size(50):tag("t"):clickable(function()
                left = left + 1
            end, {
                on_right_click = function()
                    right = right + 1
                end,
            }),
        })
    end)
    local p = tag(a, "t")
    a:frame(0, { x = p.x + 5, y = p.y + 5 })
    a:frame(0, { x = p.x + 5, y = p.y + 5, rdown = true })
    a:frame(0, { x = p.x + 5, y = p.y + 5, rdown = false })
    eq(right, 1, "right click")
    eq(left, 0, "no left click")
end)

test("block_pointer marks panels as UI and stops hits below", function()
    local clicks = 0
    local a = new_app(function()
        K.Box({
            modifier = M:fill_max_size():clickable(function()
                clicks = clicks + 1
            end),
        }, function()
            K.Box({ modifier = M:size(80):tag("panel"):block_pointer() })
        end)
    end, 300, 200)
    local p = tag(a, "panel")
    assert(a.input:hit(a.regions, p.x + 10, p.y + 10), "panel is UI")
    click(a, "panel")
    eq(clicks, 0, "click did not pass through the panel")
    local empty = new_app(function()
        K.Box({ modifier = M:size(80):background(K.hex("#333333")) })
    end)
    assert(not empty.input:hit(empty.regions, 10, 10), "plain background is not UI")
end)

test("theme mechanism: base theme, styles, K.ui, extend", function()
    local seen
    local a = new_app(function()
        K.Text("x", { style = "title" })
        K.Text("y", { style = "no_such_style" })
        seen = K.style("title").font
    end)
    eq(seen, "kompot_sb_16", "base title style")
    local bare = new_app(function()
        K.ui()
    end)
    assert(
        bare.rt.error_text and bare.rt.error_text:find("has no components", 1, true),
        "K.ui() without a design system"
    )
    local th = K.extend_theme(K.BASE_THEME, {
        name = "mine",
        colors = { primary = K.hex("#FF0000") },
        ui = {
            Hello = function()
                K.Text("hi")
            end,
        },
    })
    eq(th.colors.surface, K.BASE_THEME.colors.surface, "inherited color")
    eq(th.colors.primary[1], 1, "overridden color")
    local b
    a, b = new_app(function()
        K.Theme(th, function()
            K.ui().Hello()
        end)
    end)
    eq(b:texts()[1], "hi", "K.ui() resolves theme components")
end)

test("text input passes focus handlers and code options", function()
    local focused = false
    local a, b = new_app(function()
        K.TextInput({
            value = "x",
            font = false,
            lines = 5,
            syntax = "lua",
            line_numbers = true,
            on_focus = function()
                focused = true
            end,
        })
    end)
    local f
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            f = p
        end
    end
    assert(f, "field emitted")
    eq(f.font, "normal", "engine font")
    eq(f.syntax, "lua", "syntax")
    eq(f.line_numbers, true, "line numbers")
    f.on_focus()
    eq(focused, true, "focus handler")
end)

test("duplicate keys among siblings produce a warning", function()
    local a = new_app(function()
        K.Column(function()
            for _, id in ipairs({ "x", "y", "x" }) do
                K.key(id, function()
                    K.Text(id)
                end)
            end
        end)
    end)
    eq(#a.rt.warnings, 1, "warnings")
    assert(a.rt.warnings[1]:find("duplicate key 'x'", 1, true), a.rt.warnings[1])
end)

test("z order preserves native field keys", function()
    local raised
    local a, b = new_app(function()
        raised = K.state(false)
        K.Box(function()
            K.TextInput({
                value = "first",
                modifier = M:size(100, 30):z_index(raised.value and 1 or 0),
            })
            K.TextInput({ value = "second", modifier = M:size(100, 30) })
        end)
    end)
    local keys = {}
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            keys[p.text] = p.key
        end
    end
    raised.value = true
    a:frame(0)
    local last
    for _, p in ipairs(b.dl) do
        if p.kind == "field" then
            eq(p.key, keys[p.text], "identity after z-order change")
            last = p.text
        end
    end
    eq(last, "first", "raised field drawn last")
    a:dispose()
end)

test("source-over combines transparent and translucent colors", function()
    local c = K.color.over({ 0, 0, 1, 0 }, { 1, 0, 0, 0.25 })
    assert(K.color.equals(c, { 1, 0, 0, 0.25 }), "transparent base retains overlay alpha")
    c = K.color.over({ 0, 0, 1, 0.5 }, { 1, 0, 0, 0.5 })
    assert(K.color.equals(c, { 2 / 3, 0, 1 / 3, 0.75 }), "translucent source-over")
    c = K.color.over({ 0, 0, 1, 1 }, { 1, 0, 0, 0.25 })
    assert(K.color.equals(c, { 0.25, 0, 0.75, 1 }), "opaque base")
    c = K.color.over({ 0, 0, 1, 0 }, { 1, 0, 0, 0 })
    assert(K.color.equals(c, { 0, 0, 0, 0 }), "fully transparent result")
end)

test("scope stops rerunning for state it no longer reads", function()
    local s, flag = K.new_state(0), K.new_state(true)
    local runs = 0
    local Probe = K.component(function()
        runs = runs + 1
        if flag.value then
            local _ = s.value
        end
    end)
    local a = new_app(function()
        Probe()
    end)
    flag.value = false
    a:frame(0)
    local before = runs
    s.value = 1
    a:frame(0)
    eq(runs, before, "stale subscription dropped")
    flag.value = true
    a:frame(0)
    s.value = 2
    a:frame(0)
    eq(runs, before + 2, "subscribed again after reading")
end)

test("layout cache re-measures only the changed path", function()
    local layout = require("kompot:kompot/core/layout")
    local labels = {}
    local Label = K.component(function(p)
        local text = K.state(p.text)
        labels[p.i] = text
        K.Text(text.value, { modifier = M:tag("l" .. p.i) })
    end)
    local a, b = new_app(function()
        K.Column(function()
            for r = 1, 20 do
                K.Row({ spacing = 4 }, function()
                    Label({ i = r * 2 - 1, text = "a" })
                    Label({ i = r * 2, text = "b" })
                end)
            end
        end)
    end)
    local before = tag(a, "l2").x
    local misses = layout.stats.misses
    labels[1].value = "much longer text"
    a:frame(0)
    local measured = layout.stats.misses - misses
    assert(measured < 12, "re-measured nodes: " .. measured)
    assert(tag(a, "l2").x > before, "sibling moved after the label grew")
    eq(tag(a, "l4").x, before, "other rows untouched")
    local found = false
    for _, s in ipairs(b:texts()) do
        found = found or s == "much longer text"
    end
    assert(found, "new text rendered")
end)

test("layout cache follows scroll and text metrics", function()
    local st
    local a = new_app(function()
        st = K.scroll_state()
        K.Column({ modifier = M:height(100):vertical_scroll(st) }, function()
            for i = 1, 10 do
                K.Box({ modifier = M:size(50, 40):tag("s" .. i) })
            end
        end)
    end)
    local y = tag(a, "s2").y
    st:scroll_by(30)
    a:frame(0)
    eq(tag(a, "s2").y, y - 30, "scrolled inside a cached tree")
    local layouts = a.stats.layout
    K.text.clear_cache()
    a.rt.need_layout = true
    a:frame(0)
    eq(a.stats.layout, layouts + 1, "relayout after metrics reset")
    eq(tag(a, "s2").y, y - 30, "same geometry")
end)

test("components with equal modifiers skip parent reruns", function()
    local runs = 0
    local Child = K.component(function(p)
        runs = runs + 1
        K.Box({ modifier = p.modifier })
    end)
    local tick, color, handler = K.new_state(0), K.new_state("#ff0000"), K.new_state(nil)
    local stable = function() end
    local a = new_app(function()
        local _ = tick.value
        Child({
            modifier = M:padding(4):background(color.value, 3):clickable(handler.value or stable),
        })
    end)
    eq(runs, 1, "first")
    tick.value = 1
    a:frame(0)
    eq(runs, 1, "equal modifier chain skipped")
    color.value = "#00ff00"
    a:frame(0)
    eq(runs, 2, "different color reruns")
    handler.value = function() end
    a:frame(0)
    eq(runs, 3, "new handler reruns")
    assert(
        not M.equals(M:padding(1), M:padding(1):padding(1)),
        "chains of different length differ"
    )
end)

test("remember keys compare nil positions", function()
    local k1, k2 = K.new_state(nil), K.new_state(1)
    local made = 0
    local a = new_app(function()
        K.remember(function()
            made = made + 1
            return {}
        end, k1.value, k2.value)
    end)
    eq(made, 1, "first")
    k2.value = 2
    a:frame(0)
    eq(made, 2, "second key after nil changed")
    k1.value = "x"
    a:frame(0)
    eq(made, 3, "nil -> value changed")
    k2.value = 2
    a:frame(0)
    eq(made, 3, "same keys keep value")
end)

test("invalidate recomposes replaced root content", function()
    local label = "A"
    local a, b = new_app(function()
        K.Text(label)
    end)
    eq(b:texts()[1], "A", "initial")
    label = "B"
    a.rt:invalidate()
    a:frame(0)
    eq(b:texts()[1], "B", "recomposed")
end)

-- Полоса прокрутки знает пределы сразу после первой раскладки

test("scroll fraction reflects limits after first layout without scrolling", function()
    local visible
    local a = new_app(function()
        local scroll = K.scroll_state()
        local _, view = scroll:fraction()
        visible = view
        K.Column({ modifier = M:size(100, 100):vertical_scroll(scroll) }, function()
            for i = 1, 20 do K.Box({ key = i, modifier = M:size(100, 30) }) end
        end)
    end)
    a:frame(0)
    assert(visible < 1, "fraction still reports whole content visible: " .. tostring(visible))
    eq(math.floor(visible * 100 + .5), math.floor(100 / 600 * 100 + .5), "visible fraction")
end)

-- Стабильные ключи областей ввода: оформление перед clickable не влияет на ключ

test("click survives decoration added on hover and removed on press", function()
    local clicks = 0
    local a = new_app(function()
        local inter = K.interaction()
        local mod = M:size(120, 40)
        -- Типичная кнопка: подсветка при наведении, снятая при нажатии.
        if inter.hovered.value and not inter.pressed.value then
            mod = mod:background("#FFFFFF20")
        end
        K.Box({ modifier = mod:clickable(function() clicks = clicks + 1 end, { interaction = inter }):tag("btn") })
    end)
    click(a, "btn")
    eq(clicks, 1, "clicks")
end)

test("region key ignores visual and layout modifiers before input", function()
    local hovered = K.new_state(false)
    local a = new_app(function()
        local mod = M:size(100, 30)
        if hovered.value then mod = mod:padding(2):background("#FF0000"):border(1, "#00FF00") end
        K.Box({ modifier = mod:clickable(function() end):tag("btn") })
    end)
    local before = a.regions[1].key
    hovered.value = true
    a:frame(0)
    eq(a.regions[1].key, before, "key after decoration")
end)

test("focus and press capture keep their region when decoration changes", function()
    local decorated = K.new_state(false)
    local clicks = 0
    local a = new_app(function()
        local mod = M:size(100, 30)
        if decorated.value then mod = mod:background("#202020"):alpha(0.9) end
        K.Box({ modifier = mod:clickable(function() clicks = clicks + 1 end):tag("btn") })
    end)
    local p = tag(a, "btn")
    local x, y = p.x + p.w / 2, p.y + p.h / 2
    a:frame(0, { x = x, y = y, down = false })
    a:frame(0, { x = x, y = y, down = true })
    eq(a.input.capture ~= nil, true, "captured")
    local captured = a.input.capture
    decorated.value = true
    a:frame(0, { x = x, y = y, down = true })
    eq(a.input.capture, captured, "capture kept after recomposition")
    a:frame(0, { x = x, y = y, down = false })
    eq(clicks, 1, "clicks")
    a:frame(0, { key = "tab" })
    local focused = a.input.focus_key
    decorated.value = false
    a:frame(0)
    eq(a.input.focus_key, focused, "focus kept")
end)

test("separate input regions of one element keep distinct stable keys", function()
    local extra = K.new_state(false)
    local a = new_app(function()
        local mod = M:size(100, 60):clickable(function() end)
        if extra.value then mod = mod:background("#303030") end
        mod = mod:padding(10):clickable(function() end)
        K.Box({ modifier = mod })
    end)
    local function keys()
        local out = {}
        for i, r in ipairs(a.regions) do out[i] = r.key end
        return table.concat(out, ",")
    end
    local before = keys()
    eq(#a.regions, 2, "two regions")
    extra.value = true
    a:frame(0)
    eq(keys(), before, "keys after decoration between regions")
end)

-- Splitting an earlier group must not transfer an unrelated capture/focus.
for _, initial in ipairs({0, 5}) do
    test("input groups split/merge without transferring click or focus: " .. initial, function()
        local padding = K.new_state(initial)
        local hit
        local a = new_app(function()
            K.Box({modifier=M:size(100)
                :clickable(function() hit="A" end)
                :padding(padding.value)
                :clickable(function() hit="B" end)
                :padding(10)
                :clickable(function() hit="C" end)})
        end)
        a:frame(0, {x=50, y=50, down=true})
        local captured = a.input.capture
        local focused = a.input.focus_key
        assert(captured and focused)
        padding.value = initial == 0 and 5 or 0
        a:frame(0, {x=50, y=50, down=true})
        eq(a.input.capture, captured, "unrelated capture remains")
        eq(a.input.focus_key, focused, "unrelated focus remains")
        a:frame(0, {x=50, y=50, down=false})
        eq(hit, "C", "original handler receives click")
        a:dispose()
    end)
    test("changed input group cancels capture instead of transferring it: " .. initial, function()
        local padding = K.new_state(initial)
        local hits = 0
        local a = new_app(function()
            K.Box({modifier=M:size(100)
                :clickable(function() hits=hits+1 end)
                :padding(padding.value)
                :clickable(function() hits=hits+1 end)})
        end)
        a:frame(0, {x=50, y=50, down=true})
        assert(a.input.capture)
        padding.value = initial == 0 and 5 or 0
        a:frame(0, {x=50, y=50, down=true})
        eq(a.input.capture, nil, "changed group cancels capture")
        a:frame(0, {x=50, y=50, down=false})
        eq(hits, 0, "no handler receives a transferred click")
        a:dispose()
    end)
end

print(string.format("passed: %d, failed: %d", passed, failed))

app.close_world(false)
app.delete_world("kompot_core_test")
