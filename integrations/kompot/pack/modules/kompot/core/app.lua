-- Приложение Kompot: связывает композицию, раскладку, отрисовку, ввод и
-- бэкенд в кадровый цикл. Не зависит от движка.
--
--   local app = App.new{content = MyUi, measurer = m, backend = b, width = 800, height = 600}
--   app:frame(dt, {x = mx, y = my, down = pressed, wheel = w, inside = true})

local runtime = require "kompot:kompot/core/runtime"
local layout = require "kompot:kompot/core/layout"
local render = require "kompot:kompot/core/render"
local Input = require "kompot:kompot/core/input"

local App = {}
App.__index = App

-- opts: content, measurer, backend (может быть nil), width, height, locals
function App.new(opts)
    local app = setmetatable({}, App)
    app.rt = runtime.new({
        content = opts.content,
        width = opts.width,
        height = opts.height,
        measurer = opts.measurer,
        backend = opts.backend,
        locals = opts.locals,
        on_error = opts.on_error,
        hook_diagnostics = opts.hook_diagnostics,
    })
    app.backend = opts.backend
    app.input = Input.new(app.rt)
    app.regions = {}
    app.dl = {}
    app.stats = {
        compose = 0,
        layout = 0,
        frames = 0,
        prims = 0,
        frame_ms = 0,
        compose_ms = 0,
        layout_ms = 0,
        apply_ms = 0,
    }
    app.rt.app = app
    return app
end

function App:set_size(w, h)
    self.rt:set_viewport(w, h)
end

-- Один кадр. Возвращает true, если что-то перерисовывалось.
function App:frame(dt, ev)
    local rt = self.rt
    if rt.disposed then
        return false
    end
    dt = dt or 0
    assert(dt >= 0 and dt < math.huge, "frame dt must be finite and nonnegative")
    rt.time = rt.time + dt
    self.stats.frames = self.stats.frames + 1

    if ev then
        self.input:frame(ev, self.regions)
        if self.backend and self.backend.set_cursor then
            self.backend:set_cursor(self.input.cursor)
        end
    end
    rt:run_pollers()
    rt:step_anims(dt)
    local clock = os.clock
    local t0 = clock()

    -- Обновляем состав подписок перед callback; очистка эффектов остаётся
    -- в commit после применения интерфейса
    local precomposed = rt.need_compose or not rt.root
    if precomposed then rt:compose() end
    rt:prune_scopes()
    rt:run_frame_callbacks(dt)

    local changed = precomposed
    if precomposed then self.stats.compose = self.stats.compose + 1 end
    if rt.need_compose or rt.root == nil then
        rt:compose()
        self.stats.compose = self.stats.compose + 1
        changed = true
    end
    if rt.frame_error then rt.error_text=rt.frame_error end
    local t1 = clock()
    if changed or rt.need_layout then
        layout.run(rt, rt.root, rt.width, rt.height)
        local dl, regions, placed = render.run(rt, rt.root)
        self.dl, self.regions = dl, regions
        self.input:sync_regions(regions)
        self.stats.layout = self.stats.layout + 1
        self.stats.prims = #dl
        if rt.error_text then
            dl[#dl + 1] = {
                key = "__error_bg",
                kind = "rect",
                clip = "",
                x = 8,
                y = 8,
                w = rt.width - 16,
                h = 120,
                color = { 0.5, 0.05, 0.08, 0.92 },
                radius = 8,
            }
            local line_y = 16
            for line in (rt.error_text .. "\n"):gmatch("(.-)\n") do
                if line_y > 110 then
                    break
                end
                dl[#dl + 1] = {
                    key = "__error_t" .. line_y,
                    kind = "text",
                    clip = "",
                    x = 18,
                    y = line_y,
                    w = rt.width - 36,
                    h = 16,
                    text = line:sub(1, 160),
                    font = "kompot_12",
                    color = { 1, 1, 1, 1 },
                }
                line_y = line_y + 16
            end
        end
        local t2 = clock()
        if self.backend then
            self.backend:apply(dl)
        end
        local t3 = clock()
        rt:commit()
        self:_placed_callbacks(placed)
        changed = true
        -- сглаженные замеры (мс) для отладки и экрана производительности
        local st = self.stats
        st.compose_ms = st.compose_ms * 0.9 + (t1 - t0) * 100
        st.layout_ms = st.layout_ms * 0.9 + (t2 - t1) * 100
        st.apply_ms = st.apply_ms * 0.9 + (t3 - t2) * 100
    end
    self.stats.frame_ms = self.stats.frame_ms * 0.9 + (clock() - t0) * 100
    return changed
end

-- on_size / on_placed вызываются только при изменении.
function App:_placed_callbacks(placed)
    local prev = self.placed_cache or {}
    local now = {}
    for _, p in ipairs(placed) do
        local m = p.m
        local old = prev[p.key]
        if old and old.owner ~= p.owner then old = nil end
        now[p.key] = p
        if m.t == "on_size" then
            if not old or old.w ~= p.w or old.h ~= p.h then
                self.input:call(m.fn, p.w, p.h)
            end
        elseif m.t == "on_placed" then
            if not old or old.x ~= p.x or old.y ~= p.y or old.w ~= p.w or old.h ~= p.h then
                self.input:call(m.fn, p.x, p.y, p.w, p.h)
            end
        end
    end
    self.placed_cache = now
end

-- Находит примитивы/области по метке tag (для тестов).
function App:find_tag(name)
    for _, p in pairs(self.placed_cache or {}) do
        if p.m.t == "tag" and p.m.name == name then
            return p
        end
    end
    return nil
end

function App:dispose()
    self.input:reset()
    self.rt:dispose()
    if self.backend and self.backend.dispose then
        self.backend:dispose()
    end
end

return App
