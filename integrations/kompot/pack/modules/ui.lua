-- Встроенная дизайн-система Kompot UI.
local K = require "kompot:kompot"
local T = require "kompot:ui/tokens"
local C = require "kompot:ui/components"
local Contract = require "kompot:ui/contract"
local Game = require "kompot:ui/game"
local V = {
    VERSION = "0.1.0",
    tokens = T,
    ui = Contract,
    components = C,
    PALETTE = T.PALETTE,
    TYPE = T.TYPE,
    METRICS = T.METRICS,
    MOTION = T.MOTION,
}
T.ui, T.DEFAULT.ui = Contract, Contract
V.DEFAULT, V.current = T.DEFAULT, T.current
function V.theme(opts)
    return T.theme(opts)
end
function V.Theme(opts, content)
    K.Theme(T.theme(opts, T.current()), content)
end
for name, fn in pairs(C) do
    V[name] = fn
end
V.TextField, V.Segmented, V.ListItem = Contract.TextField, Contract.Segmented, Contract.ListItem
-- Здесь нужна полная версия Panel с заголовком и настройками размера.
V.Panel = C.Panel
for name, fn in pairs(Game) do
    V[name], C[name] = fn, fn
end
function V.open_gallery()
    time.post_runnable(function()
        if not hud.is_open("kompot:gallery") then
            hud.show_overlay("kompot:gallery", false)
        end
    end)
end
---@cast V +KompotUiApi
return V
