-- Поверхности из PNG. Края сохраняем, середину повторяем через UV
local K = require "kompot:kompot"
local T = require "kompot:ui/tokens"
local S = {}
local function byte(v)
    return math.max(0, math.min(255, math.floor(v + 0.5)))
end
local MIDTONE = { panel = 140, button = 200, button_pressed = 140, inset = 140 }
-- Размеры штатных PNG. У панелей и углублений большая
-- середина: маленький тайл на больших окнах читается как сетка. Для своих
-- без указания source_size по дефолту ожидается 72x72
local SOURCE_SIZE = {
    ["kompot_ui_skin:panel"] = { 264, 264 },
    ["kompot_ui_skin:inset"] = { 264, 264 },
    ["kompot_ui_skin:button"] = { 72, 72 },
    ["kompot_ui_skin:button_pressed"] = { 72, 72 },
}

function S.Surface(p)
    p = p or {}
    local c = T.current().colors
    local kind = p.kind or "panel"
    local base = K.color.of(p.color) or (kind == "inset" and c.sunken or c.panel_bg)
    local edge = K.color.of(p.edge)
    local r, g, b, a =
        byte(base[1] * 255), byte(base[2] * 255), byte(base[3] * 255), byte((base[4] or 1) * 255)
    if a == 0 then
        return
    end
    local state = kind == "button" and p.pressed and "button_pressed" or kind
    local choice = assert(T.current().skin[state], "unknown Kompot UI skin: " .. tostring(state))
    local opts = type(choice) == "table" and choice or { src = choice }
    local paint = type(choice) == "table" and choice.kind == "nine_patch" and choice
        or K.nine_patch(opts.src, {
            source_size = opts.source_size or SOURCE_SIZE[opts.src] or { 72, 72 },
            border = opts.border or { 4, (kind == "inset" or p.pressed) and 6 or 4, 4, 4 },
            center = opts.center or "tile",
            edges = opts.edges or "tile",
            scale = opts.scale,
        })
    local mid = opts.midtone or MIDTONE[state]
    local tint = opts.tint == false and { 1, 1, 1, a / 255 }
        or { math.min(1, r / mid), math.min(1, g / mid), math.min(1, b / mid), a / 255 }
    local modifier = (p.modifier or K.M:match_parent_size()):background_image(paint, tint)
    if p.selected and edge then
        modifier = modifier:border(2, edge)
    end
    K.Box({ modifier = modifier })
end

-- Значки рисуем в той же пиксельной сетке, что и поверхности.
local glyphs = {
    health = { " ## ## ", "#######", "#######", " ##### ", "  ###  ", "   #   " },
    energy = { "   ##  ", "  ##   ", " ##### ", "   ##  ", "  ##   ", " ##    " },
    experience = { "   #   ", "  ###  ", " ## ## ", "##   ##", " ## ## ", "  ###  ", "   #   " },
}
function S.Icon(name, size, tint)
    local glyph = glyphs[name]
    if not glyph then
        local atlas = K.theme().icons or T.current().icons
        local src = name:find(":", 1, true) and name or atlas .. ":" .. name
        K.Icon(src, { size = size, color = tint })
        return
    end
    local c = tint or T.current().colors.text
    K.Canvas({
        width = size,
        height = size,
        version = name .. table.concat(c, ","),
        draw = function(cv, w, h)
            local scale = math.max(1, math.floor(math.min(w / #glyph[1], h / #glyph)))
            local ox, oy =
                math.floor((w - #glyph[1] * scale) / 2), math.floor((h - #glyph * scale) / 2)
            for y, row in ipairs(glyph) do
                for x = 1, #row do
                    if row:sub(x, x) == "#" then
                        cv:rect(
                            ox + (x - 1) * scale,
                            oy + (y - 1) * scale,
                            scale,
                            scale,
                            byte(c[1] * 255),
                            byte(c[2] * 255),
                            byte(c[3] * 255),
                            byte((c[4] or 1) * 255)
                        )
                    end
                end
            end
        end,
    })
end
return S
