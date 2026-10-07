app.config_packs({ "kompot" })
app.new_world("kompot_fonts_test", "1", "core:default")
local K = require "kompot:kompot"
local F = K.fonts
local Text = require "kompot:kompot/core/text"
local Preview = require "kompot:kompot/preview"
local passed, failed = 0, 0
local function test(name, fn)
    local ok, err = xpcall(fn, debug.traceback)
    if ok then
        passed = passed + 1
    else
        failed = failed + 1
        print("FAIL " .. name .. ": " .. err)
    end
end

test("preview never substitutes an unrelated font", function()
    assert(not pcall(Preview.font_info, "player_custom_font"))
    local normal=Preview.font_info("normal")
    assert(normal.kind=="bitmap" and normal.file=="@engine/fonts/font" and normal.size==16)
    Preview.register_font("arbitrary_name", "other_pack/fonts/Custom.otf", 23)
    local custom=Preview.font_info("arbitrary_name")
    assert(custom.size==23 and custom.file=="other_pack/fonts/Custom.otf")
end)

test("family resolves real resources and registers preview paths", function()
    assert(F.resolve("kompot:sans", 14, "semibold") == "kompot_sb_14")
    assert(F.resolve("kompot:mono", 13) == "kompot_mono_13")
    local info = Preview.font_info("kompot_sb_14")
    assert(info.file == "kompot/fonts/IBMPlexSans-SemiBold.ttf" and not info.measured)
    assert(not pcall(F.resolve, "kompot:sans", 15))
    assert(not pcall(F.resolve, "kompot:sans", 14, "italic"))
end)

test("custom family replaces roles without mutating defaults", function()
    F.register_family("fixture:ui", {
        { name = "fixture_regular_14", file = "fixture/fonts/Regular.ttf", size = 14 },
        {
            name = "fixture_semibold_14",
            file = "fixture/fonts/Semibold.ttf",
            size = 14,
            weight = "semibold",
        },
        { name = "fixture_regular_16", file = "fixture/fonts/Regular.ttf", size = 16 },
        {
            name = "fixture_semibold_16",
            file = "fixture/fonts/Semibold.ttf",
            size = 16,
            weight = "semibold",
        },
    })
    local base = { font = "kompot_14", size = 14, bold = "kompot_sb_14" }
    local defaults = { body = base, body_md = base, mono = { font = "kompot_mono_13", size = 13 } }
    local t = F.typography(
        defaults,
        { family = "fixture:ui" },
        { title = { font = "kompot_sb_20", size = 20 } }
    )
    assert(t.body.font == "fixture_regular_14" and t.body.bold == "fixture_semibold_14")
    assert(t.body == t.body_md and t.body ~= base)
    assert(t.mono.font == "kompot_mono_13" and base.font == "kompot_14")
    assert(t.title.font == "kompot_sb_20")
    local resized = F.typography(defaults, { family = "fixture:ui" }, { body = { size = 16 } })
    assert(resized.body.font == "fixture_regular_16" and resized.body.bold == "fixture_semibold_16")
    assert(resized.body_md.font == "fixture_regular_14")
    local info = Preview.font_info(t.body.font)
    assert(info.file == "fixture/fonts/Regular.ttf" and info.measured == false)
end)

test("registration rejects duplicate resources without partial state", function()
    assert(not pcall(F.register_family, "fixture:bad", {
        { name = "temporary_14", file = "fixture/a.ttf", size = 14 },
        { name = "kompot_14", file = "fixture/b.ttf", size = 16 },
    }))
    assert(F.info("temporary_14") == nil)
end)

test("new metrics invalidate existing measurer caches", function()
    local m = Text.metrics_measurer()
    F.register_metrics({ fixture_regular_14 = { lh = 19, [65] = 5 } })
    assert(m:width("fixture_regular_14", "AA") == 10)
    F.register_metrics({ fixture_regular_14 = { lh = 20, [65] = 7, [0x1F600] = 14 } })
    assert(m:width("fixture_regular_14", "AA") == 14)
    assert(m:width("fixture_regular_14", "😀") == 14)
    assert(m:line_height("fixture_regular_14") == 20)
    assert(F.info("fixture_regular_14").measured)
end)
test("field pitch uses registered metrics and native fixtures", function()
    local m = Text.metrics_measurer()
    assert(Text.field_line_height(m, "normal") == 24)
    assert(Text.field_line_height(m, "kompot_24") == 36)
    F.register_metrics({ fixture_regular_14 = { lh = 20, field_lh = 31 } })
    assert(Text.field_line_height(m, "fixture_regular_14") == 31)
    F.register_metrics({ fixture_regular_14 = { lh = 20, field_lh = 33 } })
    assert(Text.field_line_height(m, "fixture_regular_14") == 33)
end)
print(string.format("passed: %d, failed: %d", passed, failed))
app.close_world(false)
app.delete_world("kompot_fonts_test")
