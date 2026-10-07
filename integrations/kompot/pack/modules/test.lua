local K = require "kompot:kompot";
local UI = require "kompot:ui";
local M = K.M;

K.preview("хуета", { width = 500, height = 300, theme = UI.theme }, function()
    UI.Panel({ modifier = M:fill_max_width() }, function()
        K.Column({ modifier = M:fill_max_width(), spacing = 12 }, function()
            local width = K.state(260)
            local material = K.remember(function()
                local source = K.raster({
                    key = "kompot:guide/material",
                    width = 16,
                    height = 16,
                    draw = function(cv)
                        cv:clear(50, 65, 50, 255)
                        cv:rect(0, 0, 16, 2, 100, 120, 85, 255)
                        cv:rect(0, 2, 2, 12, 100, 120, 85, 255)
                        cv:rect(0, 14, 16, 2, 20, 30, 20, 255)
                        cv:rect(14, 2, 2, 12, 20, 30, 20, 255)
                        cv:rect(4, 4, 2, 2, 65, 80, 60, 255)
                    end,
                })
                return K.nine_patch(source, { border = 2, center = "tile", scale = 2 })
            end)
            UI.Slider({
                label = "Ширина",
                min = 120,
                max = 360,
                value = width.value,
                on_change = function(v)
                    width.value = v
                end,
            })
            K.Box(
                { modifier = M:width(width.value):height(120):background_image(material):padding(12) },
                function()
                    K.Text("Один материал для всех размеров")
                end
            )
        end)
    end)
end)

K.preview("Тест", { width = 500, height = 300, theme = UI.theme }, function()
    UI.Panel({ modifier = M:fill_max_width() }, function()

    end)
end)
