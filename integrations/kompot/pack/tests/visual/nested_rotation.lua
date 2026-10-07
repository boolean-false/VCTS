-- Regression: resizing nested rotated layers must preserve both matte passes.
app.config_packs({"base", "kompot"})
app.new_world("kompot_nested_rotation_check", "1", "core:default")
local K = require "kompot:kompot"
local target = K.new_state(0)
local function content()
    local angle = K.animate(target.value, K.tween(5))
    K.Box({modifier = K.M:offset(100, 100):size(200)}, function()
        K.Box({modifier = K.M:size(100):rotate(angle):background("#FFFFFF")}, function()
            K.Box({modifier = K.M:size(70):rotate(angle):background("#B21D1D")}, function()
                K.Box({modifier = K.M:size(45):rotate(angle):background("#224312")})
            end)
        end)
    end)
end
local h = K.mount({content = content})
local widths, checked, partial = {}, 0, 0
local function check(backend)
    for _, entry in pairs(backend.entries) do
        if entry.layer_backend then
            local cv = entry.source_canvas
            assert(cv, "layer source was never captured")
            widths[cv.width] = true
            local buffer = cv:get_data()
            for i = 0, cv.width * cv.height * 4 - 1, 4 do
                local r, g, b, a = buffer.bytes[i], buffer.bytes[i+1], buffer.bytes[i+2], buffer.bytes[i+3]
                if a>0 and a<255 then partial=partial+1 end
                if a > 10 then
                    -- AA смешивает три цвета. Проверяем их выпуклую оболочку,
                    -- допуская округление RGBA при восстановлении из двух matte.
                    local tolerance=2+510/a
                    local dr,dg=r-34,g-67
                    local det=221*(-38)-188*144
                    local white=(dr*(-38)-dg*144)/det
                    local red=(221*dg-188*dr)/det
                    assert(r>=34-tolerance and g>=29-tolerance and b>=18-tolerance,
                        "nested rotation introduced a dark fringe")
                    assert(white>=-tolerance/100 and red>=-tolerance/100
                        and white+red<=1+tolerance/100
                        and math.abs(b-(18+237*white+11*red))<=tolerance*3,
                        "nested rotation corrupted a source color")
                end
            end
            checked = checked + 1
            check(entry.layer_backend)
            check(entry.layer_white_backend)
        end
    end
end
app.sleep(0.5)
check(h.backend)
target.value = 360
for _ = 1, 55 do
    app.sleep(0.1)
    assert(not h.app.rt.error_text, h.app.rt.error_text)
    check(h.backend)
end
app.sleep(0.3)
check(h.backend)
local sizes = 0
for _ in pairs(widths) do sizes = sizes + 1 end
assert(sizes > 5, "test did not exercise changing layer bounds")
assert(checked > 100, "too few nested layer snapshots checked")
assert(partial > 100, "nested rotation did not produce antialiased edges")
file.write_bytes("export:nested-rotation.png", gui.screenshot():encode("png"))
-- Reused frames must retain their matte images and resize them on remount.
h:set_content(function() end)
app.sleep(0.1)
target.value = 37
h:set_content(content)
app.sleep(0.5)
check(h.backend)
file.write_bytes("export:nested-rotation-antialias.png", gui.screenshot():encode("png"))
h:dispose()
app.close_world(false)
app.delete_world("kompot_nested_rotation_check")
print("passed: 1, failed: 0")
