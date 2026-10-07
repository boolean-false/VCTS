local K = require "kompot:kompot"
local V = require "kompot:ui"
local E = require "kompot:ui/examples"
local M = K.M
local G = {}
G.App = K.component(function(p)
    p = p or {}
    local internal = K.state(1)
    local page = p.page or internal
    local scroll = K.scroll_state()
    K.Column({ modifier = M:fill_max_size():padding(16), spacing = 12 }, function()
        K.FlowRow({ spacing = 4, run_spacing = 4 }, function()
            for i, entry in ipairs(E.pages) do
                V.Button({
                    text = entry[1],
                    selected = page.value == i,
                    size = "sm",
                    on_click = function()
                        page.value = i
                        scroll:scroll_to(0)
                    end,
                })
            end
            if p.on_close then
                V.Button({ text = "Закрыть", on_click = p.on_close })
            end
        end)
        K.Column({ modifier = M:fill_max_width():weight(1):vertical_scroll(scroll) }, function()
            K.Box({
                modifier = M:fill_max_width()
                    :height_in(math.max(360, K.runtime().height - 100), 10000),
                align = "center",
            }, function()
                K.key(page.value, function()
                    E.pages[page.value][2]({ on_close = p.on_close })
                end)
            end)
        end)
    end)
end)
return G
