local InventoryLock = require "kompot:kompot/backend/inventory_lock"

-- Демо галерея, По умолчанию F12
function on_hud_open()
    input.add_callback("kompot.gallery", function()
        time.post_runnable(function()
            if hud.is_open("kompot:gallery") then
                hud.close("kompot:gallery")
            elseif not hud.is_inventory_open() then
                hud.show_overlay("kompot:gallery", false)
            end
        end)
        return true
    end, nil, true)
end

-- Хост, закрытый без handle:dispose(), не должен навсегда отключить Tab
function on_hud_render()
    InventoryLock.watch()
end

function on_hud_close()
    InventoryLock.release_all()
end
