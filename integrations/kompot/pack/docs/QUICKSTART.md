# Первый экран с Kompot UI

Этот пример открывает окно по клавише **H**. В окне есть счётчик: по нему
легко увидеть, что состояние меняет надпись без ручной перерисовки.

Распакуйте релиз Kompot так, чтобы файл `package.json` оказался в
`content/kompot/`. Затем создайте рядом папку `hello`:

```text
content/
  kompot/
  hello/
    package.json
    config/bindings.toml
    scripts/hud.lua
    layouts/hello.xml
    layouts/hello.xml.lua
```

В `hello/package.json` объявите зависимость:

```json
{
  "id": "hello",
  "title": "Hello Kompot",
  "version": "0.1.0",
  "creator": "Your name",
  "dependencies": ["kompot"]
}
```

Клавиша задаётся в `hello/config/bindings.toml`:

```toml
[hello]
open = "key:h"
```

В `hello/scripts/hud.lua` откройте и закройте окно по этой клавише:

```lua
function on_hud_open()
    input.add_callback("hello.open", function()
        time.post_runnable(function()
            if hud.is_open("hello:hello") then
                hud.close("hello:hello")
            elseif not hud.is_inventory_open() then
                hud.show_overlay("hello:hello", false)
            end
        end)
        return true
    end, nil, true)
end
```

`hello/layouts/hello.xml` даёт Kompot прозрачный контейнер на весь экран:

```xml
<?xml version="1.0" encoding="utf-8"?>
<container
    id="root"
    color="#00000000"
    position-func="0,0"
    size-func="unpack(gui.get_viewport())"
/>
```

Интерфейс находится в `hello/layouts/hello.xml.lua`:

```lua
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local handle

local Screen = K.component(function()
    local count = K.state(0)

    UI.Panel({ title = "Первый экран" }, function()
        K.Text("Нажатий: " .. count.value)
        UI.Button({
            text = "Нажать",
            on_click = function()
                count.value = count:peek() + 1
            end,
        })
    end)
end)

function on_open()
    handle = K.mount({
        target = document.root,
        theme = UI.theme(),
        content = Screen,
    })
end

function on_close()
    if handle then
        handle:dispose()
        handle = nil
    end
end
```

Включите оба пака в мире и нажмите **H**. `K.state` хранит счётчик, а чтение
`count.value` подписывает экран на его изменения. `on_close` освобождает
интерфейс при закрытии окна. Из обработчика внутри окна вызывайте `hud.close`
через `time.post_runnable`, чтобы движок не удалял дерево во время обхода.

Дальше можно открыть [компоненты Kompot UI](UI.md) или посмотреть живые
примеры по **F12**. Для своего оформления есть [руководство по дизайн-системам](DESIGN_SYSTEM.md).

## Если окно не открылось

- Проверьте, что мир загружает оба пака и в `hello/package.json` указана
  зависимость `kompot`.
- Имена должны совпадать: `hello.open` для клавиши и `hello:hello` для
  `layouts/hello.xml`. Lua-код окна лежит рядом в `hello.xml.lua`.
- Если окно открылось пустым, проверьте `id="root"` в XML и
  `target = document.root` в `K.mount`.
