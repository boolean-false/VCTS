app.config_packs({ "kompot" })
app.new_world("kompot_modal_test", "1", "core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local recorder = require "kompot:kompot/backend/recorder"
local level = K.new_state(0)
local inter = K.new_interaction()
local clicks, wheels, drags, rights = 0, 0, 0, 0
local b = recorder.new()
local a = K.App.new({
    backend = b,
    measurer = recorder.measurer(),
    width = 800,
    height = 600,
    content = function()
        K.Column({ modifier = K.M:fill_max_size() }, function()
            K.Box({
                modifier = K.M
                    :size(200, 80)
                    :hoverable(inter)
                    :clickable(function()
                        clicks = clicks + 1
                    end, {
                        interaction = inter,
                        on_right_click = function()
                            rights = rights + 1
                        end,
                    })
                    :draggable({
                        interaction = inter,
                        on_event = function(e)
                            if e.type == "move" then drags = drags + 1 end
                        end,
                    })
                    :on_wheel(function()
                        wheels = wheels + 1
                        return true
                    end),
            })
            UI.TextField({ value = "background" })
            UI.Window({
                visible = level.value >= 1,
                modal = true,
                z = 1,
                title = "First",
                on_close = function() end,
            }, function()
                UI.TextField({ value = "first" })
            end)
            UI.Dialog(
                { visible = level.value >= 2, title = "Second", on_dismiss = function() end },
                function()
                    UI.TextField({ value = "second" })
                end
            )
        end)
    end,
})
local function settle()
    for _ = 1, 10 do
        a:frame(0.05)
    end
    assert(#a.rt.errors == 0, tostring(a.rt.errors[1]))
end
local function field(name)
    for _, p in ipairs(b.dl) do
        if p.kind == "field" and p.text == name then
            return p
        end
    end
    error("field missing: " .. name)
end
settle()
a:frame(0, { x = 30, y = 30, down = false })
assert(inter.hovered:peek())
a:frame(0, { x = 30, y = 30, down = true, rdown = true })
assert(inter.pressed:peek())
level.value = 1
settle()
assert(
    not inter.hovered:peek() and not inter.pressed:peek(),
    "background interaction was not cancelled"
)
assert(not a.input.capture and not a.input.rcapture and not a.input.focus_key)
a:frame(0, { x = 50, y = 30, down = true, rdown = true, wheel = 1 })
a:frame(0, { x = 50, y = 30, down = false, rdown = false })
assert(clicks == 0 and rights == 0 and drags == 0 and wheels == 0, "input leaked through modal")
assert(field("background").input_blocked and not field("first").input_blocked)
level.value = 2
settle()
assert(field("background").input_blocked and field("first").input_blocked)
assert(not field("second").input_blocked)
level.value = 1
settle()
assert(field("background").input_blocked and not field("first").input_blocked)
level.value = 0
settle()
assert(not field("background").input_blocked)
a:frame(0, { x = 30, y = 30, down = false })
assert(inter.hovered:peek(), "hover not restored")
a:frame(0, { x = 30, y = 30, down = true })
a:frame(0, { x = 30, y = 30, down = false, wheel = 1 })
assert(clicks == 1 and wheels == 1, "input not restored")
a:dispose()
print("passed: 1, failed: 0")
app.close_world(false)
app.delete_world("kompot_modal_test")
