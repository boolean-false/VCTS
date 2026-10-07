-- Regression: a font first used after mount must not cache the label's
-- placeholder width. Run with: bash tests/visual/run.sh font_ready
app.config_packs({ "base", "kompot" })
app.new_world("kompot_font_ready", "1", "core:default")
local K = require "kompot:kompot"
local sample = "Outlined Elevated AV Wi ИО йё 0123"
local selected
local h = K.mount({
    content = function()
        selected = K.state("kompot_14")
        K.Column({ modifier = K.M:width(1000) }, function()
            K.Text(sample, { font = selected.value, wrap = false })
        end)
    end,
})
app.sleep(1)
for _, font in ipairs({ "kompot_sb_11", "kompot_mono_14" }) do
    selected.value = font
    app.sleep(0.5)
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
    local found = false
    for _, p in ipairs(h.app.dl) do
        if p.kind == "text" and p.text == sample then
            local width = 0
            for char in sample:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
                width = width + h.backend.measurer:width(font, char)
            end
            assert(p.w == width, "cached width differs from native advances: " .. font)
            found = true
        end
    end
    assert(found, "text was not rendered")
end
h:dispose()
print("passed: 1, failed: 0")
app.close_world(false)
app.delete_world("kompot_font_ready")
