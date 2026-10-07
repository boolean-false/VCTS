-- Диспетчер ввода: наведение, нажатие, клик, перетаскивание, колесо, курсор.
-- Работает по областям ввода из render.lua (абсолютные координаты).
--
-- Событие кадра от бэкенда:
--   {x, y, down = bool, rdown = bool (правая кнопка), wheel = число, inside = bool}
-- inside = указатель над корнем Kompot (иначе наведение сбрасывается).

local Corners = require "kompot:kompot/core/corners"
local runtime = require "kompot:kompot/core/runtime"

local A = require "kompot:kompot/core/affine"
local Input = {}
Input.__index = Input

local DRAG_THRESHOLD = 4

function Input.new(rt)
    return setmetatable({
        rt = rt,
        x = -1,
        y = -1,
        down = false,
        capture = nil,
        dragging = false,
        drag_target = nil,
        drag_payload = nil,
        rdragging = false,
        hovered = {},
        cursor = nil,
        focus_key = nil,
        focus_visible = false,
    }, Input)
end

-- Источник взаимодействия: состояния наведения, нажатия, перетаскивания.
function Input.interaction()
    return {
        hovered = runtime.new_state(false),
        pressed = runtime.new_state(false),
        dragged = runtime.new_state(false),
        focused = runtime.new_state(false),
    }
end

local function focus_spec(r)
    if not r then
        return nil
    end
    if r.focus and r.focus.enabled then
        return r.focus
    end
    if r.click and r.click.enabled and r.click.focusable then
        return r.click
    end
    return nil
end

function Input:set_focus(key, by_key, keyboard)
    local visible = key ~= nil and keyboard == true
    if key == self.focus_key then
        if self.focus_visible ~= visible then
            self.focus_visible = visible
            self.rt.need_layout = true
        end
        return
    end
    local old = self.focus_region or (self.focus_key and by_key[self.focus_key])
    local new = key and by_key[key]
    local old_spec = focus_spec(old)
    if old_spec then
        if old_spec.interaction then
            old_spec.interaction.focused:set(false)
        end
        if old_spec.on_defocus then
            self:call(old_spec.on_defocus)
        end
    end
    self.focus_key = new and key or nil
    self.focus_visible = self.focus_key ~= nil and visible
    self.focus_region = new
    local new_spec = focus_spec(new)
    if new_spec then
        if new_spec.interaction then
            new_spec.interaction.focused:set(true)
        end
        if new_spec.on_focus then
            self:call(new_spec.on_focus)
        end
    end
    self.rt.need_layout = true
end

local function local_point(r,x,y)
    x,y=A.point(r.inverse,x,y)
    return x-r.x,y-r.y
end
local function inside(r,x,y)
    if r.singular then return false end
    local c=r.clip
    while c do
        if c.inverse then
            local cx,cy=A.point(c.inverse,x,y)
            if not Corners.contains(cx-c.x,cy-c.y,c.w,c.h,c.radius) then return false end
        elseif not c.passthrough and not c.parent then
            if x<c.x0 or y<c.y0 or x>=c.x1 or y>=c.y1 then return false end
        end
        c=c.parent
    end
    local lx,ly=local_point(r,x,y)
    return lx>=0 and ly>=0 and lx<r.w and ly<r.h
end


function Input:call(fn, ...)
    local ok, err = pcall(fn, ...)
    if not ok then
        self.rt:report_error(err)
    end
    return ok and err
end

-- Единый формат событий перетаскивания и координат указателя
function Input:drag_event(r, phase, x, y, last_x, last_y, right)
    local lx,ly=local_point(r,x,y)
    local px,py=A.point(r.parent_inverse,x,y)
    local ox,oy=A.point(r.parent_inverse,last_x or x,last_y or y)
    local ex,ey=local_point(r,last_x or x,last_y or y)
    local opts=r.drag
    if right then opts=r.rdrag end
    local dx,dy=lx-ex,ly-ey
    local pdx,pdy=px-ox,py-oy
    if opts and opts.axis==1 then dy,pdy=0,0 elseif opts and opts.axis==2 then dx,pdx=0,0 end
    local velocity=self.velocity
    if right then velocity=self.rvelocity end
    velocity=velocity or {x=0,y=0,time=self.rt.time}
    local dt=self.rt.time-(velocity.time or self.rt.time)
    if phase=="move" and dt>0 then
        velocity.x,velocity.y=pdx/dt,pdy/dt
        velocity.time=self.rt.time
    elseif phase=="end" and self.rt.time-velocity.time>0.1 then
        velocity.x,velocity.y=0,0
    end
    if right then self.rvelocity=velocity else self.velocity=velocity end
    return {type=phase,x=lx,y=ly,dx=dx,dy=dy,parent_x=px-(r.parent_x or 0),
        parent_y=py-(r.parent_y or 0),parent_dx=pdx,parent_dy=pdy,
        velocity_x=velocity.x,velocity_y=velocity.y,button=right and "right" or "left"}
end
function Input:cancel_capture(right,reason,r)
    if not r then
        if right then r=self.rcapture_region else r=self.capture_region end
    end
    if r then
        local opts,dragging=r.drag,self.dragging
        if right then opts,dragging=r.rdrag,self.rdragging end
        if opts and opts.interaction then
            opts.interaction.pressed:set(false)
            opts.interaction.dragged:set(false)
        end
        if r.click and r.click.interaction then r.click.interaction.pressed:set(false) end
        local e=self:drag_event(r,"cancel",self.x,self.y,nil,nil,right)
        e.cancelled,e.reason=true,reason
        if dragging and opts and opts.on_event then self:call(opts.on_event,e) end
        if r.pointer then self:call(r.pointer,e) end
    end
    if right then self.rcapture,self.rcapture_region,self.rdragging=nil,nil,false
    else self.capture,self.capture_region,self.dragging=nil,nil,false end
end

local function scroll_region(self, r, wheel)
    if r.wheel then
        return self:call(r.wheel, wheel)
    end
    if r.scroll then
        return r.scroll:scroll_by(-wheel * (r.scroll.step or 48)) ~= 0
    end
    return false
end

-- Нативный TextBox получает колесо позже в том же кадре. Если его scroll
-- не изменился, передаём событие ближайшему прокручиваемому предку.
function Input:scroll_ancestors(field_key, x, y, wheel, regions)
    local field_path = field_key:match("^(.-)|") or field_key
    for i = #regions, 1, -1 do
        local r = regions[i]
        local path = r.key:match("^(.-)|") or r.key
        if
            (r.wheel or r.scroll)
            and (field_path == path or field_path:sub(1, #path + 1) == path .. "/")
            and inside(r, x, y)
            and scroll_region(self, r, wheel)
        then
            return true
        end
    end
    return false
end

local function set_hover(self, r, flag)
    if r.click and r.click.interaction then
        r.click.interaction.hovered:set(flag)
    end
    local h = r.hover
    if h then
        if type(h) == "function" then
            self:call(h, flag)
        elseif h.hovered then
            h.hovered:set(flag)
        end
    end
    if r.drag and r.drag.interaction then
        r.drag.interaction.hovered:set(flag)
    end
    if r.rdrag and r.rdrag.interaction then
        r.rdrag.interaction.hovered:set(flag)
    end
end

local function set_pressed(r, flag)
    if r.click and r.click.interaction then
        r.click.interaction.pressed:set(flag)
    end
    if r.drag and r.drag.interaction then
        r.drag.interaction.pressed:set(flag)
    end
    if r.rdrag and r.rdrag.interaction then
        r.rdrag.interaction.pressed:set(flag)
    end
end

local function drag_target(self, hits)
    local next_target
    for _, r in ipairs(hits) do
        if r.drop then
            next_target = r
            break
        end
        if r.block then
            break
        end
    end
    local old = self.drag_target
    if old and (not next_target or old.key ~= next_target.key) and old.drop.on_leave then
        self:call(old.drop.on_leave, self.drag_payload)
    end
    if next_target and (not old or old.key ~= next_target.key) and next_target.drop.on_enter then
        self:call(next_target.drop.on_enter, self.drag_payload)
    end
    self.drag_target = next_target
    return next_target
end

function Input:sync_regions(regions)
    local by_key, indices = {}, {}
    for i, r in ipairs(regions) do
        by_key[r.key], indices[r.key] = r, i
    end
    local focus_start = 1
    for i, r in ipairs(regions) do
        if r.focus_scope then
            focus_start = i + 1
        end
    end
    if self.focus_key and focus_start > 1 then
        local allowed = false
        for i = focus_start, #regions do
            if regions[i].key == self.focus_key then
                allowed = true
                break
            end
        end
        if not allowed then
            self:set_focus(nil, by_key)
        end
    end
    if self.focus_key and not focus_spec(by_key[self.focus_key]) then
        self:set_focus(nil, by_key)
    elseif self.focus_key and self.focus_region ~= by_key[self.focus_key] then
        local current = by_key[self.focus_key]
        local old_spec, new_spec = focus_spec(self.focus_region), focus_spec(current)
        if old_spec and old_spec.interaction and old_spec.interaction ~= new_spec.interaction then
            old_spec.interaction.focused:set(false)
            if new_spec.interaction then
                new_spec.interaction.focused:set(true)
            end
        end
        self.focus_region = current
    end
    local pointer_start = math.max(1, focus_start - 1)
    local function blocked(key)
        return not indices[key] or indices[key] < pointer_start
    end
    if self.capture and (blocked(self.capture) or (by_key[self.capture] and
        (by_key[self.capture].singular or (self.capture_region.drag and not by_key[self.capture].drag)))) then
        local reason=not by_key[self.capture] and "removed" or "blocked"
        self:cancel_capture(false,reason,(by_key[self.capture] and by_key[self.capture].drag) and by_key[self.capture] or self.capture_region)
        drag_target(self,{})
        self.drag_payload=nil
    end
    if self.rcapture and (blocked(self.rcapture) or (by_key[self.rcapture] and (by_key[self.rcapture].singular or (self.rcapture_region.rdrag and not by_key[self.rcapture].rdrag)))) then
        self:cancel_capture(true,not by_key[self.rcapture] and "removed" or "blocked",(by_key[self.rcapture] and by_key[self.rcapture].rdrag) and by_key[self.rcapture] or self.rcapture_region)
        drag_target(self,{})
        self.drag_payload=nil
    end
    for key, r in pairs(self.hovered) do
        if blocked(key) then
            set_hover(self, r, false)
            self.hovered[key] = nil
        end
    end
    return by_key, focus_start, pointer_start
end

-- Обрабатывает кадр ввода. regions - из последней отрисовки.
function Input:frame(ev, regions)
    local by_key, focus_start, pointer_start = self:sync_regions(regions)
    local x, y = ev.x or self.x, ev.y or self.y
    local moved = x ~= self.x or y ~= self.y
    self.x, self.y = x, y
    local over = ev.inside ~= false

    -- области под указателем, верхняя первая; «непрозрачная» область
    -- (block_pointer) закрывает всё, что под ней
    local hits, wheel_ancestors = {}, {}
    if over then
        for i = #regions, pointer_start, -1 do
            local r = regions[i]
            if inside(r, x, y) then
                hits[#hits + 1] = r
                if r.block then
                    -- block_pointer закрывает нижние элементы, но прокрутка
                    -- родителя должна получать колесо над дочерней панелью.
                    local blocked_path = r.key:match("^(.-)|") or r.key
                    for j = i - 1, pointer_start, -1 do
                        local parent = regions[j]
                        local parent_path = parent.key:match("^(.-)|") or parent.key
                        if
                            (parent.scroll or parent.wheel)
                            and (blocked_path == parent_path or blocked_path:sub(
                                1,
                                #parent_path + 1
                            ) == parent_path .. "/")
                            and inside(parent, x, y)
                        then
                            wheel_ancestors[#wheel_ancestors + 1] = parent
                        end
                    end
                    break
                end
            end
        end
    end
    self.over_ui = #hits > 0

    -- наведение
    local now = {}
    for _, r in ipairs(hits) do
        if r.click or r.hover or r.drag or r.rdrag then
            now[r.key] = r
        end
    end
    for key, r in pairs(self.hovered) do
        if not now[key] then
            set_hover(self, by_key[key] or r, false)
        end
    end
    for key, r in pairs(now) do
        if not self.hovered[key] then
            set_hover(self, r, true)
        end
    end
    self.hovered = now

    -- курсор
    local cursor = nil
    for _, r in ipairs(hits) do
        if r.cursor then
            cursor = r.cursor
            break
        end
        if r.click or r.drag or r.rdrag then
            break
        end
    end
    if self.capture and self.dragging then
        cursor = (by_key[self.capture] and by_key[self.capture].cursor) or cursor
    end
    self.cursor = cursor

    -- Tab идёт в порядке компонентов, Shift+Tab в обратном. Активация
    -- клавишами использует тот же обработчик, что и щелчок мышью.
    if ev.key == "tab" then
        local candidates = {}
        for i = focus_start, #regions do
            local r = regions[i]
            local clip = r.clip
            if
                focus_spec(r)
                and r.w > 0
                and r.h > 0
                and (
                    not clip
                    or (
                        r.x < clip.x1
                        and r.x + r.w > clip.x0
                        and r.y < clip.y1
                        and r.y + r.h > clip.y0
                    )
                )
            then
                candidates[#candidates + 1] = r.key
            end
        end
        if #candidates > 0 then
            local current = 0
            for i, key in ipairs(candidates) do
                if key == self.focus_key then
                    current = i
                    break
                end
            end
            local next_index = current == 0 and (ev.shift and #candidates or 1)
                or (
                    ev.shift and ((current - 2 + #candidates) % #candidates + 1)
                    or (current % #candidates + 1)
                )
            self:set_focus(candidates[next_index], by_key, true)
        end
    elseif ev.key == "enter" or ev.key == "space" then
        local r = self.focus_key and by_key[self.focus_key]
        if r and r.click and r.click.enabled and r.click.on_click then
            self:call(r.click.on_click)
        elseif r and r.focus and r.focus.on_key then
            self:call(r.focus.on_key, ev.key)
        end
    elseif ev.key == "left" or ev.key == "right" or ev.key == "up" or ev.key == "down" then
        local r = self.focus_key and by_key[self.focus_key]
        if r and r.focus and r.focus.on_key then
            self:call(r.focus.on_key, ev.key)
        end
    elseif ev.key == "escape" then
        self:cancel_capture(false,"escape")
        self:cancel_capture(true,"escape")
        drag_target(self,{})
        self.drag_payload=nil
        self:set_focus(nil, by_key)
    end

    if ev.cancel then
        self:cancel_capture(false,"cancelled")
        self:cancel_capture(true,"cancelled")
        drag_target(self,{})
        self.drag_payload=nil
        self.down,self.rdown=ev.down==true,ev.rdown==true
    end
    -- нажатие
    local down = ev.down and true or false
    if down and not self.down then
        local captured = false
        for _, r in ipairs(hits) do
            local clickable = r.click and r.click.enabled
            if clickable or r.drag or r.pointer or focus_spec(r) then
                self:set_focus(focus_spec(r) and r.key or nil, by_key)
                self.capture, self.capture_region = r.key, r
                captured = true
                self.press_x, self.press_y = x, y
                self.last_x, self.last_y = x, y
                self.dragging = false
                self.velocity={x=0,y=0,time=self.rt.time}
                set_pressed(r, true)
                if r.pointer then
                    self:call(r.pointer, self:drag_event(r,"down",x,y))
                end
                break
            end
        end
        if not captured then
            self:set_focus(nil, by_key)
        end
    elseif down and self.capture then
        local r = by_key[self.capture]
        if not r then
            self.capture, self.capture_region = nil, nil
        elseif moved then
            self.capture_region=r
            if r.drag then
                if
                    not self.dragging
                    and (math.abs(x - self.press_x) + math.abs(y - self.press_y))
                        >= DRAG_THRESHOLD
                then
                    self.dragging = true
                    if r.drag.interaction then
                        r.drag.interaction.dragged:set(true)
                    end
                    self.last_x, self.last_y = self.press_x, self.press_y
                    self.drag_payload=nil
                    if r.drag.on_event then
                        self.drag_payload=self:call(r.drag.on_event,self:drag_event(r,"start",self.press_x,self.press_y))
                    end
                end
                if self.dragging then
                    local e=self:drag_event(r,"move",x,y,self.last_x,self.last_y)
                    if r.drag.on_event then self:call(r.drag.on_event,e) end
                end
            end
            if r.pointer then
                self:call(r.pointer, self:drag_event(r,"move",x,y,self.last_x,self.last_y))
            end
            self.last_x, self.last_y = x, y
        end
        if self.dragging then
            drag_target(self, hits)
        end
    elseif not down and self.down then
        local key = self.capture
        self.capture, self.capture_region = nil, nil
        local r = key and by_key[key]
        if r then
            set_pressed(r, false)
            if self.dragging then
                if r.drag.interaction then
                    r.drag.interaction.dragged:set(false)
                end
                local target = drag_target(self, hits)
                local accepted = target
                        and target.drop.on_drop
                        and self:call(target.drop.on_drop, self.drag_payload) ~= false
                    or false
                local e=self:drag_event(r,"end",x,y,self.last_x,self.last_y)
                e.accepted,e.cancelled=accepted,false
                if r.drag.on_event then self:call(r.drag.on_event,e) end
            elseif r.click and r.click.enabled and r.click.on_click and inside(r, x, y) then
                self:call(r.click.on_click)
            end
            if r.pointer then
                self:call(r.pointer, self:drag_event(r,"up",x,y))
            end
        end
        drag_target(self, {})
        self.drag_payload = nil
        self.dragging = false
    end
    self.down = down

    -- правая кнопка: щелчок по области с on_right_click
    local rdown = ev.rdown and true or false
    if rdown and not self.rdown then
        self.rcapture = nil
        for _, r in ipairs(hits) do
            if r.rdrag or (r.click and r.click.enabled and r.click.on_right) then
                self.rcapture = r.key
                self.rcapture_region = r
                self.rpress_x, self.rpress_y = x, y
                self.rlast_x, self.rlast_y = x, y
                self.rdragging = false
                self.rvelocity={x=0,y=0,time=self.rt.time}
                break
            end
            if r.click or r.drag or r.pointer or r.block then
                break
            end
        end
    elseif rdown and self.rcapture and moved then
        local r = by_key[self.rcapture]
        if r and r.rdrag then
            if
                not self.rdragging
                and (math.abs(x - self.rpress_x) + math.abs(y - self.rpress_y))
                    >= DRAG_THRESHOLD
            then
                self.rdragging = true
                if r.rdrag.interaction then
                    r.rdrag.interaction.dragged:set(true)
                end
                self.rlast_x, self.rlast_y = self.rpress_x, self.rpress_y
                self.drag_payload=nil
                if r.rdrag.on_event then
                    self.drag_payload=self:call(r.rdrag.on_event,self:drag_event(r,"start",self.rpress_x,self.rpress_y,nil,nil,true))
                end
            end
            if self.rdragging then
                drag_target(self, hits)
                local e=self:drag_event(r,"move",x,y,self.rlast_x,self.rlast_y,true)
                if r.rdrag.on_event then self:call(r.rdrag.on_event,e) end
            end
            self.rlast_x, self.rlast_y = x, y
        end
    elseif not rdown and self.rdown and self.rcapture then
        local r = by_key[self.rcapture]
        self.rcapture, self.rcapture_region = nil, nil
        if self.rdragging then
            local target = drag_target(self, hits)
            local accepted = target
                    and target.drop.on_drop
                    and self:call(target.drop.on_drop, self.drag_payload) ~= false
                or false
            if r and r.rdrag then
                if r.rdrag.interaction then
                    r.rdrag.interaction.dragged:set(false)
                end
                local e=self:drag_event(r,"end",x,y,self.rlast_x,self.rlast_y,true)
                e.accepted,e.cancelled=accepted,false
                if r.rdrag.on_event then self:call(r.rdrag.on_event,e) end
            end
            drag_target(self, {})
            self.drag_payload = nil
            self.rdragging = false
        elseif r and r.click and r.click.on_right and inside(r, x, y) then
            self:call(r.click.on_right)
        end
    end
    self.rdown = rdown

    -- колесо: от верхней области вниз, пока кто-то не поглотит
    local wheel = ev.wheel or 0
    if wheel ~= 0 and over then
        local wheel_hits = {}
        for _, r in ipairs(hits) do
            wheel_hits[#wheel_hits + 1] = r
        end
        for _, r in ipairs(wheel_ancestors) do
            wheel_hits[#wheel_hits + 1] = r
        end
        for _, r in ipairs(wheel_hits) do
            if scroll_region(self, r, wheel) then
                break
            end
        end
    end
end

-- Есть ли под точкой (абсолютные координаты корня) область ввода или
-- непрозрачная область: указатель «над интерфейсом».
function Input:hit(regions, x, y)
    for i = #regions, 1, -1 do
        if inside(regions[i], x, y) then
            return true
        end
    end
    return false
end

-- Сбрасывает наведение и захват (указатель ушёл, окно закрыто).
function Input:reset()
    for _, r in pairs(self.hovered) do
        set_hover(self, r, false)
    end
    self.hovered = {}
    drag_target(self, {})
    self:cancel_capture(false,"reset")
    self:cancel_capture(true,"reset")
    self.drag_payload=nil
    self.capture, self.capture_region = nil, nil
    self.rcapture, self.rcapture_region = nil, nil
    self.dragging = false
    self.down = false
    self.rdown = false
    self.rdragging = false
    self:set_focus(nil, {})
end

return Input
