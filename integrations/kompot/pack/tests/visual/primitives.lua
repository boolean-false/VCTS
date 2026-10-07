-- Визуальная проверка примитивов бэкенда: скругления, рамки, тени, текст,
-- иконки, холст. Скриншот: export:primitives.png
app.config_packs({ "base", "kompot" })
app.new_world("kompot_visual", "1", "core:default")
local K = require("kompot:kompot")
local M = K.M

local h = K.mount {
    content = function()
        local t = K.theme()
        local c = t.colors
        K.Box({ modifier = M:fill_max_size():background(c.background) }, function()
            K.Column({ spacing = 16, modifier = M:padding(24) }, function()
                K.Row({ spacing = 16 }, function()
                    for _, r in ipairs({ 0, 4, 8, 16, 28 }) do
                        K.Box({ modifier = M:size(90, 60):background(c.primary, r) })
                    end
                    K.Box({
                        modifier = M:size(90, 60):shadow(12, 12):background(c.surface_raised, 12),
                    })
                    K.Box({ modifier = M:size(90, 60):border(2, c.warning, 14) })
                    K.Box({ modifier = M:size(60, 60):background(c.success, math.huge) })
                end)
                K.Row({ spacing = 12 }, function()
                    -- угол: левая верхняя четверть красная, правая нижняя синяя
                    K.Box({ modifier = M:size(80):background("#ff3030", 40) })
                    K.Box({ modifier = M:size(120, 40):background("#3080ff", 20) })
                    K.Box({ modifier = M:size(40, 120):background("#30c060", 20) })
                end)
                for _, s in ipairs({
                    "display_md",
                    "headline_md",
                    "title_lg",
                    "title_md",
                    "body_lg",
                    "body_md",
                    "body_sm",
                    "label_md",
                    "mono",
                }) do
                    K.Text(
                        s
                            .. ": Съешь же ещё этих мягких французских булок - The quick brown fox",
                        { style = s }
                    )
                end
                K.Row({ spacing = 10 }, function()
                    for _, n in ipairs({
                        "home",
                        "settings",
                        "search",
                        "heart",
                        "star",
                        "bell",
                        "trash",
                        "edit",
                        "palette",
                        "sparkle",
                        "rocket",
                        "moon",
                    }) do
                        K.Icon("kompot_ui_icons:" .. n, { size = 24, color = c.primary })
                    end
                end)
                K.Canvas({
                    width = 200,
                    height = 60,
                    version = 1,
                    draw = function(cv, w, h)
                        cv:clear(0x20242CFF)
                        for x = 0, w - 1 do
                            local y = math.floor(h / 2 + math.sin(x / 12) * (h / 2 - 4))
                            cv:set(x, y, 255, 200, 60, 255)
                            cv:set(x, y + 1, 255, 200, 60, 255)
                        end
                    end,
                })
            end)
        end)
    end,
}
app.sleep(1.5)
assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
local st = h.app.stats
print(
    string.format(
        "frames %d, compose %d, layout %d, prims %d",
        st.frames,
        st.compose,
        st.layout,
        st.prims
    )
)
file.write_bytes("export:primitives.png", gui.screenshot():encode("png"))
print("passed: 1, failed: 0")
h:dispose()
app.close_world(false)
app.delete_world("kompot_visual")
