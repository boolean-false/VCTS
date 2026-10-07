local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Gallery = require "kompot:ui/gallery"
local handle

function on_open()
    local session = Gallery.new_session()
    handle = K.mount({
        target = document.root,
        theme = UI.DEFAULT,
        content = function()
            Gallery.App(session, function()
                local current = handle
                if not current or current.close_pending then
                    return
                end
                current.close_pending = true
                -- Обработчик клика выполняется из таймера внутри этого окна.
                -- Удалять дерево HUD можно только после завершения его обхода.
                time.post_runnable(function()
                    if handle == current then
                        hud.close("kompot:gallery")
                    end
                end)
            end)
        end,
    })
end

function on_close()
    if handle then
        handle:dispose()
        handle = nil
    end
end
