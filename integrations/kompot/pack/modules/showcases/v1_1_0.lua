-- Демонстрационный лист обновления Kompot 1.1.0.
-- Откройте этот файл в Lens: превью готово для отдельного скриншота.
-- Для следующего обновления скопируйте файл под новой версией и замените примеры.
-- Временно вернуть страницу в галерею (в modules/ui/guide.lua):
-- require("kompot:showcases/v1_1_0").register(G)
local K = require "kompot:kompot"
local M, S = K.M, K.Shape
local ink, muted = "#F4F0E8", "#A5B2C2"
local colors = {"#83CDB5", "#8EB9EF", "#D2ADF0", "#E8BD7C", "#EF9D9D"}
local asymmetric = {top_left = 28, top_right = 8, bottom_right = 0, bottom_left = 16}
local mixed = {top_left = S.percent(50), top_right = S.px(8), bottom_right = 0, bottom_left = S.percent(25)}

local function label(text, font, color)
    K.Text(text, {font = font or "kompot_13", color = color or ink, wrap = false, max_lines = 1})
end
local function shape(value, color, w, h)
    K.Box({modifier = M:size(w or 112, h or 48):background(color, value)})
end
local function stripes()
    K.Box({modifier = M:fill_max_size():background("#8EB9EF")}, function()
        for i = 0, 5 do
            K.Box({modifier = M:offset(i * 26 - 16, -14):size(13, 94):rotate(25):background("#D6E6FF")})
        end
        K.Box({modifier = M:offset(75, 25):size(65, 35):background("#436A9A")})
    end)
end
local function clipped(value)
    K.Box({modifier = M:size(112, 48):clip(value)}, stripes)
end
local function all(value, color)
    K.Box({modifier = M:size(112, 48):shadow(6, value):background(color, value)
        :border(2, ink, value):clip(value)}, function()
        K.Box({modifier = M:offset(60, 25):size(80, 30):background("#FFFFFF55")})
    end)
end
local function tile(title, code, draw)
    K.Column({modifier = M:weight(1):background("#202C3C", S.rounded(10)):padding(10, 6), spacing = 2}, function()
        K.Box({modifier = M:fill_max_width():height(58), align = "center"}, draw)
        label(title, "kompot_sb_13")
        label(code, "kompot_mono_11", muted)
    end)
end
local function row(title, items)
    K.Column({modifier = M:fill_max_width(), spacing = 3}, function()
        label(title, "kompot_sb_12", muted)
        K.Row({modifier = M:fill_max_width(), spacing = 8}, function()
            for _, item in ipairs(items) do tile(item[1], item[2], item[3]) end
        end)
    end)
end
local function sheet()
    K.Column({modifier = M:width(math.min(1120, K.runtime().width - 48))
        :background("#131C29"):padding(16), spacing = 7}, function()
        K.Row({modifier = M:fill_max_width(), align = "center"}, function()
            K.Column({modifier = M:weight(1), spacing = 2}, function()
                label("Обнова 1.1.0", "kompot_sb_24")
                label("Всякие формы", "kompot_14", muted)
            end)
        end)
        row("01   ФОРМЫ", {
            {"Прямоугольник", "S.rectangle()", function() shape(S.rectangle(), colors[1]) end},
            {"Круг", "S.circle() · квадрат", function() shape(S.circle(), colors[2], 54, 54) end},
            {"Капсула", "S.circle() · прямоугольник", function() shape(S.circle(), colors[3]) end},
            {"Скруглённые углы", "S.rounded(16)", function() shape(S.rounded(16), colors[4]) end},
            {"Срезанные углы", "S.cut(16)", function() shape(S.cut(16), colors[5]) end},
        })
        row("02   РАЗМЕРЫ И НЕЗАВИСИМЫЕ УГЛЫ · TL / TR / BR / BL", {
            {"Каждый радиус отдельно", "rounded · 28 / 8 / 0 / 16", function() shape(S.rounded(asymmetric), colors[1]) end},
            {"Каждый срез отдельно", "cut · 28 / 8 / 0 / 16", function() shape(S.cut(asymmetric), colors[2]) end},
            {"Проценты меньшей стороны", "S.cut(S.percent(50))", function() shape(S.cut(S.percent(50)), colors[3], 56, 56) end},
            {"Пиксели + проценты", "50% / px(8) / 0 / 25%", function() shape(S.rounded(mixed), colors[4]) end},
            {"Нормализация радиусов", "S.rounded(120)", function() shape(S.rounded(120), colors[5]) end},
        })
        row("03   ПРИМЕНЕНИЕ · ОДНА ФОРМА ПЕРЕДАЁТСЯ В ЛЮБОЙ МОДИФИКАТОР", {
            {"Фон", "M:background(color, s)", function() shape(S.cut(asymmetric), colors[1]) end},
            {"Рамка без заливки", "M:border(3, color, s)", function()
                K.Box({modifier = M:size(112, 48):border(3, colors[2], S.rounded(asymmetric))})
            end},
            {"Тень по контуру", "M:shadow(8, s)", function()
                K.Box({modifier = M:size(112, 48):shadow(8, S.cut(16), "#000000CC", 5):background(colors[3], S.cut(16))})
            end},
            {"Скруглённая маска", "M:clip(S.rounded(20))", function() clipped(S.rounded(20)) end},
            {"Маска со срезами", "M:clip(S.cut(20))", function() clipped(S.cut(20)) end},
        })
        row("04   КОМПОЗИЦИЯ И СОВМЕСТИМОСТЬ", {
            {"Всё вместе", "shadow → bg → border → clip", function() all(S.rounded(asymmetric), colors[1]) end},
            {"Вложенные маски", "cut → padding → circle", function()
                K.Box({modifier = M:size(112, 54):background(colors[2], S.cut(18)):clip(S.cut(18)):padding(5):clip(S.circle())}, stripes)
            end},
            {"Поворот + маска", "rotate(12):clip(s)", function()
                K.Box({modifier = M:size(94, 44):rotate(12):clip(S.cut(12))}, stripes)
            end},
            {"Числовой радиус", "radius = 12 / math.huge", function()
                K.Row({spacing = 8}, function() shape(12, colors[4], 48, 48); shape(math.huge, colors[4], 48, 48) end)
            end},
            {"Таблица углов", "K.rounded_corners({...})", function() all(K.rounded_corners(asymmetric), colors[5]) end},
        })
    end)
end
local Sheet = {render = sheet}
function Sheet.register(G)
    G.add("game", "shape_sheet", "Shape · все возможности", "Все поддерживаемые формы на одном листе.",
        {"K.Shape", "M.background", "M.border", "M.shadow", "M.clip"},
        'require("kompot:showcases/v1_1_0").render()', {section = "game", scene = true})
end

K.preview("Kompot 1.1.0 · Shape", {
    width = 1152, height = 800,
    theme = require("kompot:ui").theme(),
    group = "Обновления",
}, function()
    K.Box({modifier = M:fill_max_size():background("#131C29"), align = "center"}, sheet)
end)

return Sheet
