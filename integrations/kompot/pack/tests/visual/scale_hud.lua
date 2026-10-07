-- Fixed HUD layers beside a changing, camera-like list of world labels.
-- Run: bash tests/visual/run.sh scale_hud
-- Compare the exported baseline/changed screenshots and scale-hud-results.lua.
app.config_packs({"base", "kompot"})
app.new_world("kompot_scale_hud", "1", "core:default")
-- The runner uses a temporary user directory. Borderless mode keeps the
-- test viewport fixed while the desktop manages other windows.
app.set_setting("display.window-mode", 2)
app.sleep(0.5)
local K = require "kompot:kompot"
local results = {}

local function fingerprint(canvas)
    if not canvas then return "missing" end
    local buffer = canvas:get_data()
    local hash = 0
    for i = 0, buffer.size - 1 do
        hash = (hash * 31 + buffer.bytes[i]) % 1000000007
    end
    return canvas.width .. ":" .. canvas.height .. ":" .. hash
end

for _, scale in ipairs({1.2, 1.45}) do
    for _, keyed in ipairs({false, true}) do
        local name = tostring(scale) .. (keyed and "-keyed" or "-positional")
        local revision = K.new_state(0)
        local running = false
        local h = K.mount({lock_inventory = false, content = function()
            K.on_frame(function()
                if running then revision.value = revision:peek() + 1 end
            end)
            K.Box({modifier = K.M:size(640, 420):background("#101820")}, function()
                local n = revision.value
                for i = 1, n % 3 do
                    K.Text("Station " .. i, {
                        modifier = K.M:offset(200 + n % 80, 40 + i * 28),
                    })
                end
                for i = 1, 2 do
                    K.Column({
                        key = keyed and ("hud-" .. i) or nil,
                        modifier = K.M:align(i == 1 and "bottom_start" or "bottom_end")
                            :padding(18, 0, 18, 35):scale(scale, nil, {0, 1})
                            :size(140, 64):background(i == 1 and "#BA3528" or "#2876BA")
                            :padding(6),
                        spacing = 4,
                    }, function()
                        K.Row({spacing = 6}, function()
                            K.Image("kompot_ui_icons:settings", {modifier = K.M:size(18)})
                            K.Text(i == 1 and "Health 100" or "Quick slots")
                        end)
                        K.Box({modifier = K.M:size(i == 1 and 110 or 75, 10)
                            :background("#FFFFFF")})
                    end)
                end
            end)
        end})
        h.fake_input = {x = -1, y = -1, down = false, inside = false}
        h.app:frame(0)
        local ready = false
        for _ = 1, 50 do
            app.sleep(0.1)
            local count = 0
            for _, p in ipairs(h.app.dl) do
                local entry = h.backend.entries[p.key]
                if p.kind == "layer" and entry and entry.canvas then count = count + 1 end
            end
            if count == 2 then ready = true; break end
        end
        assert(ready, "both HUD layers must finish warming up")
        app.sleep(0.2)
        local viewport = gui.get_viewport()
        local baseline, positions, sources = {}, {}, {}
        local screen_baseline, rectangles = {}, {}
        local function screen_values()
            local screenshot = gui.screenshot()
            local values = {}
            local visible = true
            for side, r in pairs(rectangles) do
                local crop = Canvas({r.w, r.h})
                crop:blit(screenshot, -r.x, -(screenshot.height - r.y - r.h))
                values[side] = fingerprint(crop)
                local buffer = crop:get_data()
                local i = ((r.h - 4) * r.w + r.w - 4) * 4
                local expected = side == 1 and {186, 53, 40} or {40, 118, 186}
                for channel = 1, 3 do
                    if buffer.bytes[i + channel - 1] ~= expected[channel] then visible = false end
                end
            end
            return values, screenshot, visible
        end
        local function inspect(initial)
            local current_viewport = gui.get_viewport()
            assert(viewport[1] == current_viewport[1] and viewport[2] == current_viewport[2],
                "viewport changed during the HUD check")
            assert(not h.app.rt.error_text, h.app.rt.error_text)
            local mismatches = 0
            local count = 0
            for _, p in ipairs(h.app.dl) do
                if p.kind == "layer" then
                    count = count + 1
                    local side = p.x < 320 and 1 or 2
                    local entry = h.backend.entries[p.key]
                    local value = fingerprint(entry and entry.canvas)
                    local position = table.concat({p.x, p.y, p.w, p.h}, ":")
                    if initial then
                        assert(value ~= "missing", "HUD did not finish warming up")
                        baseline[side], positions[side] = value, position
                        sources[side] = entry.source_canvas
                        local xy, wh = entry.el.wpos, entry.el.size
                        -- Exclude partially transparent boundary pixels over the world.
                        rectangles[side] = {x = xy[1] + 2, y = xy[2] + 2,
                            w = wh[1] - 4, h = wh[2] - 4}
                    else
                        assert(position == positions[side], "layout bounds moved for HUD " .. side
                            .. ": " .. tostring(positions[side]) .. " -> " .. position)
                        if value ~= baseline[side] then mismatches = mismatches + 1 end
                        assert(entry and entry.source_canvas == sources[side],
                            "unchanged HUD source was captured again after a key change")
                    end
                end
            end
            assert(count == 2, "HUD display list lost a layer")
            return mismatches
        end
        inspect(true)
        local drawn = false
        for _ = 1, 50 do
            local values, _, visible = screen_values()
            if visible then screen_baseline = values; drawn = true; break end
            app.sleep(0.1)
        end
        assert(drawn, "both HUD layers must reach the actual GPU draw before the baseline")
        local bad_apply, bad_draw, bad_screen = 0, 0, 0
        file.write_bytes("export:scale-hud-" .. name .. "-baseline.png", gui.screenshot():encode("png"))
        -- First observe the immediate backend state, with time to settle
        -- between updates. Then change labels every actual UI frame.
        for n = 1, 12 do
            revision.value = n
            h.app:frame(0)
            bad_apply = bad_apply + inspect(false)
            app.sleep(0.1)
        end
        running = true
        for sample = 1, 24 do
            app.sleep(0.02)
            local bad = inspect(false)
            local values, screenshot = screen_values()
            for side, value in pairs(values) do
                if value ~= screen_baseline[side] then
                    if bad_screen == 0 then
                        file.write_bytes("export:scale-hud-" .. name .. "-changed.png", screenshot:encode("png"))
                    end
                    bad_screen = bad_screen + 1
                end
            end
            bad_draw = bad_draw + bad
        end
        running = false
        results[#results + 1] = {scale = scale, keyed = keyed,
            bad_apply = bad_apply, bad_draw = bad_draw, bad_screen = bad_screen}
        print(name .. ": changed HUD canvases after apply=" .. bad_apply
            .. ", after draw=" .. bad_draw .. ", screen=" .. bad_screen)
        h:dispose()
        app.sleep(0.1)
    end
end
file.write("export:scale-hud.json", json.tostring(results))
local report = {"return {"}
for _, result in ipairs(results) do
    report[#report + 1] = string.format(
        "    {scale=%g, keyed=%s, bad_apply=%d, bad_draw=%d, bad_screen=%d},",
        result.scale, tostring(result.keyed), result.bad_apply, result.bad_draw, result.bad_screen)
end
report[#report + 1] = "}"
file.write("export:scale-hud-results.lua", table.concat(report, "\n"))
app.close_world(false)
app.delete_world("kompot_scale_hud")
for _, result in ipairs(results) do
    assert(result.bad_apply == 0 and result.bad_draw == 0 and result.bad_screen == 0,
        "fixed scaled HUD changed when neighboring labels changed")
end
print("passed: 4, failed: 0")
