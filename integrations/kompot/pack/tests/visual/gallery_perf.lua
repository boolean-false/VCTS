-- Reproducible phase timings; identical fixed host sizes for before/after runs.
app.config_packs({ "base", "kompot" })
app.new_world("kompot_gallery_perf", "1", "base:demo")
app.sleep(1)
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local G = require "kompot:ui/gallery"
local App = require "kompot:kompot/core/app"
local frame, canvas = App.frame, K.Canvas
local clock = os.clock
local report
K.Canvas = function(p)
    local draw = p.draw
    p.draw = function(cv, w, h)
        local t = clock()
        draw(cv, w, h)
        if report then
            report.draw = report.draw + (clock() - t) * 1000
            report.pixels = report.pixels + w * h
            report.canvases = report.canvases + 1
        end
    end
    canvas(p)
end
App.frame = function(self, ...)
    local old = { self.stats.compose_ms, self.stats.layout_ms, self.stats.apply_ms }
    local layouts = self.stats.layout
    local t = clock()
    local result = frame(self, ...)
    local ms = (clock() - t) * 1000
    if report then
        report.peak = math.max(report.peak, ms)
        report.frames = report.frames + 1
        if self.stats.layout ~= layouts then
            report.compose = report.compose + (self.stats.compose_ms - old[1] * 0.9) * 10
            report.layout = report.layout + (self.stats.layout_ms - old[2] * 0.9) * 10
            report.apply = report.apply + (self.stats.apply_ms - old[3] * 0.9) * 10
        end
    end
    return result
end
local function sample(label, action, h)
    report = {
        draw = 0,
        pixels = 0,
        canvases = 0,
        compose = 0,
        layout = 0,
        apply = 0,
        peak = 0,
        frames = 0,
    }
    action()
    h.app:frame(0)
    app.sleep(0.35)
    assert(#h.app.rt.errors == 0, tostring(h.app.rt.errors[1]))
    print(
        string.format(
            "PERF %s frames=%d peak=%.2fms compose=%.2f layout=%.2f apply=%.2f draw=%.2f canvases=%d pixels=%d",
            label,
            report.frames,
            report.peak,
            report.compose,
            report.layout,
            report.apply,
            report.draw,
            report.canvases,
            report.pixels
        )
    )
    report = nil
end
for _, size in ipairs({ { 1280, 720 }, { 1920, 1080 } }) do
    local host_id = "perf_host_" .. size[1]
    gui.root.root:add(
        "<container id='" .. host_id .. "' size='" .. size[1] .. "," .. size[2] .. "' pos='0,0'/>"
    )
    local s = G.new_session()
    local h = K.mount({
        target = gui.root[host_id],
        theme = UI.DEFAULT,
        content = function()
            G.App(s)
        end,
    })
    h.fake_input = { x = -100, y = -100, down = false, inside = false }
    app.sleep(0.4)
    local prefix = size[1] .. "x" .. size[2] .. " "
    sample(prefix .. "core-cold", function()
        G.switch_section(s, "core")
    end, h)
    sample(prefix .. "core-idle", function() end, h)
    sample(prefix .. "game", function()
        G.switch_section(s, "game")
    end, h)
    sample(prefix .. "code-cold", function()
        s.show_code.value = true
    end, h)
    sample(prefix .. "code-idle", function() end, h)
    sample(prefix .. "code-close", function()
        s.show_code.value = false
    end, h)
    sample(prefix .. "code-reopen", function()
        s.show_code.value = true
    end, h)
    h:dispose()
    gui.root[host_id]:destruct()
end
K.Canvas, App.frame = canvas, frame
app.close_world(false)
print("passed: gallery performance capture, failed: 0")
