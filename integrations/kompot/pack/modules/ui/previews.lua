local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Guide = require "kompot:ui/guide"

for _, entry in ipairs(Guide.search("")) do
    if entry.render then
        local section = entry.section == "core" and "Kompot"
            or entry.section == "game" and "Kompot UI / Game"
            or "Kompot UI"
        K.preview(section .. ": " .. entry.title, {
            width = 640,
            height = 600,
            theme = UI.theme(),
            group = section,
        }, function()
            K.Column({ modifier = K.M:fill_max_size():padding(16), spacing = 12 }, function()
                K.Text(entry.title, { style = "title" })
                K.Text(entry.description)
                if entry.requires then
                    UI.Hint(
                        "Живая демонстрация доступна в галерее Kompot на движке с API текстовой раскладки."
                    )
                    UI.Lua({ code = entry.source, lines = 12 })
                else
                    entry.render()
                end
            end)
        end)
    end
end

K.preview("", {}, function()
    local count = K.state(0)
    UI.Panel({ title = "Счётчик" }, function()
        K.Text("Нажато: " .. count.value)
        UI.Button({
            text = "+1",
            variant = "primary",
            on_click = function()
                count.value = count.value + 1
            end,
        })
    end)
end)

return {}
