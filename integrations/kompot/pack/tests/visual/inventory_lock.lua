-- Блокировка Tab (hud.inventory) снимается, даже если хост закрыли без
-- handle:dispose(): сторож из scripts/hud.lua видит, что хост перестал тикать.
app.config_packs({ "base", "kompot" })
app.new_world("kompot_inventory_lock", "1", "core:default")
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Lock = require "kompot:kompot/backend/inventory_lock"

local failed = 0
local function check(cond, msg)
    if not cond then
        failed = failed + 1
        print("FAIL " .. msg)
    end
end

-- 1. Хост уничтожен напрямую
local cleanups = 0
local h = K.mount({ target = gui.root.root, content = function()
    K.effect(function() return function() cleanups = cleanups + 1 end end)
    K.Text("lock")
end })
app.sleep(0.5)
check(Lock.count() == 1, "mount with target holds the lock: " .. Lock.count())
h.host:destruct()
app.sleep(0.3)
check(Lock.count() == 0, "destroyed host released the lock: " .. Lock.count())
check(h.disposed == true, "destroyed host disposed automatically")
check(cleanups == 1, "destroyed host cleans up effects once")
h:dispose()
check(cleanups == 1, "dispose remains idempotent")

-- 2. Макет закрыт, а dispose() забыли
local mount = K.mount
local mounted
K.mount = function(opts)
    mounted = mount(opts)
    return mounted
end
UI.open_gallery()
app.sleep(0.7)
local leaked = assert(mounted)
check(Lock.count() == 1, "gallery holds the lock: " .. Lock.count())
local dispose = leaked.dispose
leaked.dispose = function() end
hud.close("kompot:gallery")
app.sleep(0.3)
check(Lock.count() == 0, "closed layout released the lock: " .. Lock.count())
check(not leaked.disposed, "hidden layout stays alive")

-- 3. Повторное открытие снова блокирует Tab
UI.open_gallery()
app.sleep(0.7)
check(mounted ~= leaked, "gallery remounted")
-- документ макета переиспользуется: забытый хост тоже оживает и снова
-- берёт блокировку, пока он на экране
check(Lock.count() == 2, "reopened gallery holds the lock: " .. Lock.count())
hud.close("kompot:gallery")
app.sleep(0.3)
check(Lock.count() == 0, "normal close released the lock: " .. Lock.count())
dispose(leaked)
K.mount = mount

-- 4. lock_inventory = false: хост с target не трогает Tab
-- (экран во фрейме-текстуре, который не перекрывает игровой интерфейс)
local free = K.mount({ target = gui.root.root, lock_inventory = false, content = function()
    K.Box({modifier=K.M:size(100):clickable(function() end)})
end })
free.fake_input = {x=50, y=50, down=false, inside=true}
app.sleep(0.4)
check(free.app.input.over_ui, "pointer is over an interactive region")
check(Lock.count() == 0, "lock_inventory=false keeps Tab on hover: " .. Lock.count())
free.fake_input = {key="tab", once=true}
app.sleep(0.1)
check(free.app.input.focus_key ~= nil, "test acquired keyboard focus")
check(Lock.count() == 0, "lock_inventory=false keeps Tab with focus: " .. Lock.count())
free:dispose()
local locked = K.mount({ target = gui.root.root, content = function() K.Text("locked") end })
app.sleep(0.4)
check(Lock.count() == 1, "default target mount still locks: " .. Lock.count())
locked:dispose()
app.sleep(0.2)
check(Lock.count() == 0, "dispose releases the default lock: " .. Lock.count())

-- 5. Ошибка чужого документа не уничтожает живой хост.
local tick = K.new_state(0)
local alive = K.mount({target=gui.root.root, content=function()
    K.Text("alive " .. tick.value)
end})
app.sleep(0.3)
local apply = alive.backend.apply
local errors = 0
-- Expected diagnostic: the failure must be logged, not mistaken for host death.
alive.backend.apply = function()
    errors = errors + 1
    error("document 'kompot:missing_page' not found")
end
tick.value = 1
app.sleep(0.2)
alive.backend.apply = apply
check(errors > 0, "unrelated document failure was exercised")
check(not alive.disposed, "unrelated document error keeps healthy host alive")
tick.value = 2
app.sleep(0.2)
check(alive.host.exists, "healthy host can render again")
alive:dispose()

-- 6. Наблюдатель работает и для хостов, которые никогда не блокировали Tab.
local unlocked_cleanups = 0
local unlocked = K.mount({target=gui.root.root, lock_inventory=false, content=function()
    K.effect(function() return function() unlocked_cleanups = unlocked_cleanups + 1 end end)
    K.Text("unlocked")
end})
app.sleep(0.3)
unlocked.host:destruct()
app.sleep(0.3)
check(unlocked.disposed == true, "unlocked destroyed host disposed automatically")
check(unlocked_cleanups == 1, "unlocked destroyed host cleans up effects")

print(string.format("passed: %d, failed: %d", failed == 0 and 1 or 0, failed))
app.close_world(false)
app.delete_world("kompot_inventory_lock")
