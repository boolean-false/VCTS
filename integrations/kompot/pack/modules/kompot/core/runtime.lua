-- Рантайм композиции Kompot: состояние, области (scopes), remember, эффекты,
-- CompositionLocal, построение дерева узлов.
--
-- Модель:
--   * UI - функция, которая при вызове "испускает" узлы (emit) в текущего
--     родителя.
--   * Область (scope) - экземпляр компонента, группы key или provide. Хранит
--     слоты remember (по порядку вызова, как хуки) и дочерние области.
--     Свои узлы область испускает во "фрагмент" - прозрачный узел, который
--     раскладка раскрывает в детей родителя.
--   * Чтение State внутри области подписывает её; запись помечает область
--     грязной. В следующем кадре перезапускаются только грязные области, на
--     своём месте (частичная рекомпозиция); родители и соседи не трогаются.
--   * Модуль не обращается к движку: всё внешнее - через бэкенд
--     (см. backend/*.lua). Поэтому ядро можно запускать без VoxelCore
--     (тесты, превью в редакторе).

local Mod = require "kompot:kompot/core/modifier"
local copy = require "kompot:kompot/core/copy"

-- VCTS: Lua traceback leaves table exceptions unchanged. Preserve TS Error.stack.
local function error_traceback(err)
    if type(err) == "table" and type(err.stack) == "string" then
        return tostring(err) .. "\n" .. err.stack
    end
    return debug.traceback(err)
end

local R = {}

local EMPTY = {}
R.EMPTY = EMPTY

-- Текущий контекст композиции
local cur_rt = nil
local cur_scope = nil
local cur_parent = nil
local cur_observer = nil -- кто подписывается на чтение State
local layout_rt = nil -- рантайм, чья раскладка идёт сейчас

-- Состояния

local WEAK_KEYS = { __mode = "k" }

local State = {}
State.__index = function(self, k)
    if k == "value" then
        local obs = cur_observer
        if obs then
            self.__subs[obs] = true
            -- обратная ссылка: при перезапуске наблюдатель отписывается
            -- от всего, что читал, и подписывается заново
            local deps = obs.deps
            if deps then
                deps[self] = true
            elseif obs.mods then
                -- узел раскладки становится наблюдателем при первом чтении
                obs.deps = setmetatable({ [self] = true }, WEAK_KEYS)
                obs.rt, obs.is_layout = layout_rt, true
            end
        end
        return rawget(self, "__v")
    end
    return State[k]
end
State.__newindex = function(self, k, v)
    if k == "value" then
        self:set(v)
    else
        rawset(self, k, v)
    end
end

-- Кэш раскладки: узел, его предки (по _parent, который раскладка ставит в
-- kids()) и фрагменты помечаются устаревшими. Путь проходится до корня
-- целиком: отметки, сделанные во время раскладки, её конец снимает не везде.
local function invalidate_node(node)
    while node do
        node._stale = true
        node = node._parent
    end
end
R.invalidate_node = invalidate_node

local function notify(subs)
    for obs in pairs(subs) do
        local rt = obs.rt
        if rt and not rt.disposed then
            if obs.is_layout then
                -- наблюдатель - узел, прочитавший State во время раскладки
                rt.need_layout = true
                invalidate_node(obs)
            else
                rt:mark_dirty(obs)
            end
            rt:request_frame()
        end
    end
end

function State:set(v)
    local old = rawget(self, "__v")
    if old == v then
        return
    end
    local eq = rawget(self, "__eq")
    if eq and eq(old, v) then
        return
    end
    rawset(self, "__v", v)
    notify(self.__subs)
end

-- Чтение без подписки.
function State:peek()
    return rawget(self, "__v")
end

function State:update(fn)
    self:set(fn(rawget(self, "__v")))
end

-- Несколько полей: новая таблица, без глубокого слияния.
function State:patch(changes)
    local old = rawget(self, "__v")
    assert(type(old) == "table", "State:patch requires a table value")
    assert(type(changes) == "table", "State:patch changes must be a table")
    self:set(copy(old, changes))
end

-- Одно поле: значение или функция от старого значения. nil удаляет поле.
function State:update_field(key, value_or_fn)
    local old = rawget(self, "__v")
    assert(type(old) == "table", "State:update_field requires a table value")
    assert(key ~= nil and key == key, "State:update_field key must not be nil or NaN")
    local value = value_or_fn
    if type(value_or_fn) == "function" then
        value = value_or_fn(old[key])
    end
    local out = copy(old)
    out[key] = value
    self:set(out)
end

function R.new_state(v, eq)
    return setmetatable({ __v = v, __subs = setmetatable({}, WEAK_KEYS), __eq = eq }, State)
end

-- Снимает все подписки наблюдателя: следующий запуск соберёт их заново,
-- и State, который область перестала читать, её больше не будит.
local function unsubscribe(obs)
    local deps = obs.deps
    if not deps or next(deps) == nil then
        return
    end
    for st in pairs(deps) do
        rawget(st, "__subs")[obs] = nil
    end
    obs.deps = setmetatable({}, WEAK_KEYS)
end
R.unsubscribe = unsubscribe

function R.is_state(v)
    return getmetatable(v) == State
end

-- Выполняет fn, подписывая на прочитанные State наблюдателя obs.
function R.observe(obs, fn, ...)
    local prev = cur_observer
    cur_observer = obs
    local a, b, c = fn(...)
    cur_observer = prev
    return a, b, c
end

function R.untracked(fn, ...)
    return R.observe(nil, fn, ...)
end

-- Меняет текущего наблюдателя, возвращает прежнего (раскладка ставит
-- наблюдателем измеряемый узел).
function R.swap_observer(obs)
    local prev = cur_observer
    cur_observer = obs
    return prev
end

-- Рантайм текущей раскладки: узлы, прочитавшие State, будят его.
function R.set_layout_runtime(rt)
    layout_rt = rt
end

-- CompositionLocal

local Local = {}
Local.__index = Local

function R.local_of(default, name)
    return setmetatable({ default = default, name = name or "local" }, Local)
end

-- Текущее значение (во время композиции).
function Local:get()
    local locals = cur_scope and cur_scope.locals or EMPTY
    local v = locals[self]
    if v == nil then
        return self.default
    end
    return v
end

-- Области

local function new_scope(rt, parent, fn, key, kind)
    local scope = {
        rt = rt,
        parent = parent,
        fn = fn,
        key = key,
        kind = kind,
        slots = {},
        hook_kinds = {},
        children = {},
        props = nil,
        dirty = true,
        deps = setmetatable({}, WEAK_KEYS),
        visited = 0,
        depth = parent and parent.depth + 1 or 0,
        locals = parent and parent.locals or EMPTY,
    }
    scope.fragment =
        { kind = "fragment", mods = EMPTY, params = EMPTY, children = {}, scope = scope }
    return scope
end

local function dispose_scope(scope)
    if scope.disposed then
        return
    end
    for _, child in pairs(scope.children) do
        dispose_scope(child)
    end
    scope.children = {}
    unsubscribe(scope)
    for _, slot in pairs(scope.slots) do
        if type(slot) == "table" then
            if slot.__effect then slot.pending=nil end
            if slot.__effect and slot.cleanup then
                local ok, err = pcall(slot.cleanup)
                if not ok and scope.rt then
                    scope.rt:report_error(err)
                end
                slot.cleanup = nil
            end
        end
    end
    scope.disposed = true
end
R._dispose_scope = dispose_scope

local function scope_failed(scope)
    while scope do
        if scope.failed then return true end
        scope = scope.parent
    end
    return false
end

local function hook_site()
    for level = 3, 18 do
        local info = debug.getinfo(level, "Sl")
        if not info then break end
        local source = info.source or ""
        if info.what ~= "C" and not source:find("kompot/core/runtime.lua", 1, true)
            and not source:find("kompot/core/anim.lua", 1, true)
            and not source:find("kompot/ui/foundation.lua", 1, true)
            and not source:find("modules/kompot.lua", 1, true) then
            return info.short_src .. ":" .. info.currentline
        end
    end
end

local function hook_error(scope, index, expected, actual)
    local info = debug.getinfo(scope.fn, "Sn")
    local component = (info.name or scope.kind) .. " (" .. info.short_src .. ":" .. info.linedefined .. ")"
    local message = "Hook order changed in component " .. component
        .. ": slot " .. index .. " expected " .. expected .. ", got " .. actual .. "."
    if scope.rt.hook_diagnostics then
        message = message .. "\nPrevious:"
        for i = 1, scope.hook_count or #scope.hook_kinds do
            message = message .. "\n  " .. i .. " " .. scope.hook_kinds[i]
                .. " at " .. ((scope.hook_sites or {})[i] or "unknown")
        end
        message = message .. "\nCurrent:"
        for i, hook in ipairs(scope.current_hooks or {}) do
            message = message .. "\n  " .. i .. " " .. hook.kind .. " at " .. (hook.site or "unknown")
        end
    end
    return message .. "\nUse K.key or a separate K.component for conditional hooks."
end

-- Не запускать эффекты дерева, композиция которого завершилась ошибкой.
local function cancel_scope_effects(scope)
    local effects = scope.rt.effects
    for i = #effects, 1, -1 do
        local slot, owner = effects[i], effects[i].scope
        while owner and owner ~= scope do owner = owner.parent end
        if owner == scope then
            slot.pending, slot.queued = nil, nil
            slot.keys = slot.committed_keys
            slot.scope.dirty = true
            table.remove(effects, i)
        end
    end
end

local function mark_visited(scope, frame)
    scope.visited = frame
    for _, child in pairs(scope.children) do
        mark_visited(child, frame)
    end
end

local function shallow_equal(a, b)
    if a == b then
        return true
    end
    if type(a) ~= "table" or type(b) ~= "table" then
        return false
    end
    for k, v in pairs(a) do
        local w = b[k]
        -- модификаторы сравниваются по слоям (см. Modifier.equals)
        if w ~= v and not (Mod.is(v) and Mod.is(w) and Mod.equals(v, w)) then
            return false
        end
    end
    for k in pairs(b) do
        if a[k] == nil then
            return false
        end
    end
    return true
end
R.shallow_equal = shallow_equal

-- Удаляет дочерние области, не посещённые в кадре frame.
-- Подкомпозиции (ленивые списки) убирает их список, не этот обход.
local function sweep(scope, frame, deferred)
    for k, child in pairs(scope.children) do
        if child.kind == "sub" then
            if child.visited == frame then
                sweep(child, frame, deferred)
            end
        elseif child.visited ~= frame then
            if deferred then
                child.detached=true
                deferred[#deferred+1]=child
            else dispose_scope(child) end
            scope.children[k] = nil
        else
            sweep(child, frame, deferred)
        end
    end
end

-- Узлы

-- Испускает узел в текущего родителя. content - функция, испускающая детей.
function R.emit(kind, mods, params, content, key)
    local node =
        { kind = kind, mods = mods or EMPTY, params = params or EMPTY, children = {}, key = key,
            placement_owner = cur_scope }
    local parent = cur_parent
    if parent then
        parent.children[#parent.children + 1] = node
    end
    if content then
        local prev = cur_parent
        cur_parent = node
        content()
        cur_parent = prev
    end
    return node
end

function R.current_parent()
    return cur_parent
end

-- Запускает область: узлы - во фрагмент области (очищается заново).
local function run_scope(scope, fn, ...)
    local frag = scope.fragment
    local previous_slots = #scope.slots
    -- новые дети фрагмента: раскладку владельца и его предков пересчитать
    invalidate_node(frag)
    frag.children = {}
    frag.overlays = nil
    unsubscribe(scope)
    local prev_scope, prev_parent, prev_obs = cur_scope, cur_parent, cur_observer
    cur_scope, cur_parent, cur_observer = scope, frag, scope
    scope.slot_i = 0
    scope.failed = nil
    scope.current_hooks = scope.rt.hook_diagnostics and {} or nil
    scope.call_i = 0
    scope.used_keys = nil
    scope.dirty = false
    scope.visited = cur_rt.frame
    local ok, err = xpcall(fn, error_traceback, ...)
    scope.initializing_hook = nil
    if ok and scope.hook_count and scope.slot_i ~= scope.hook_count then
        ok = false
        err = hook_error(scope, scope.slot_i + 1, scope.hook_kinds[scope.slot_i + 1], "end of composition")
    end
    if ok then
        scope.hook_count = scope.slot_i
        if scope.current_hooks then
            scope.hook_sites = {}
            for i, hook in ipairs(scope.current_hooks) do scope.hook_sites[i] = hook.site end
        end
    else
        scope.failed = true
        cancel_scope_effects(scope)
        -- Частично созданные хуки не становятся базой для следующей попытки.
        for i = #scope.slots, previous_slots + 1, -1 do
            local slot = scope.slots[i]
            if slot.__frame then slot.dead = true end
            if type(slot.v) == "table" and slot.v.__anim then slot.v.dead = true end
            if slot.__effect and slot.cleanup then
                local cleanup_ok, cleanup_err = pcall(slot.cleanup)
                if not cleanup_ok then scope.rt:report_error(cleanup_err) end
            end
            scope.slots[i], scope.hook_kinds[i] = nil, nil
        end
        for i = previous_slots + 1, scope.slot_i do scope.hook_kinds[i] = nil end
    end
    scope.current_hooks = nil
    cur_scope, cur_parent, cur_observer = prev_scope, prev_parent, prev_obs
    if not ok then
        error(err, 0)
    end
end

-- Находит или создаёт дочернюю область текущей области.
-- same_fn: для компонентов другая функция на том же месте - другой
-- компонент (область пересоздаётся). Для групп key/provide содержимое -
-- обычно свежая анонимная функция, и область сохраняется.
local function child_scope(fn, key, same_fn, kind)
    local parent = cur_scope
    local k
    parent.call_i = (parent.call_i or 0) + 1
    if key ~= nil then
        k = "k:" .. tostring(key)
        -- один ключ дважды в одной области: вторая группа затрёт первую
        local used = parent.used_keys
        if not used then
            used = {}
            parent.used_keys = used
        end
        if used[k] then
            cur_rt:warn(
                "duplicate key '"
                    .. tostring(key)
                    .. "' in one scope: keys must be unique among siblings"
            )
        end
        used[k] = true
    else
        k = parent.call_i
    end
    local scope = parent.children[k]
    if scope and (scope.disposed or (same_fn and scope.fn ~= fn)) then
        dispose_scope(scope)
        scope = nil
    end
    if not scope then
        scope = new_scope(cur_rt, parent, fn, key, kind)
        parent.children[k] = scope
    end
    scope.fn = fn
    return scope
end

local function attach(scope)
    local children = cur_parent.children
    children[#children + 1] = scope.fragment
end

-- Вызов компонента: своя область, пропуск без изменений.
function R.call(fn, props, content)
    if not cur_scope then
        -- вне композиции (например, в тестах) - просто вызов
        return fn(props or EMPTY, content)
    end
    props = props or EMPTY
    local scope = child_scope(fn, props.key, true, "call")
    local locals = cur_scope.locals
    attach(scope)
    if
        not scope.dirty
        and not scope.failed
        and scope.ran
        and scope.locals == locals
        and scope.content == content
        and shallow_equal(scope.props, props)
    then
        -- пропуск: фрагмент остаётся прежним
        mark_visited(scope, cur_rt.frame)
        return
    end
    scope.props = props
    scope.content = content
    scope.locals = locals
    scope.ran = true
    run_scope(scope, fn, props, content)
end

-- Оборачивает функцию в компонент: C(props, content).
-- Обёртка компонента -> исходная функция (инструменты: документация и
-- переход к объявлению в редакторе).
R.component_source = setmetatable({}, { __mode = "k" })

function R.component(fn)
    local wrapper = function(props, content)
        return R.call(fn, props, content)
    end
    R.component_source[wrapper] = fn
    return wrapper
end

-- Группа с ключом: своя область для элемента списка / условной ветки.
function R.key(k, fn)
    if not cur_scope then
        return fn()
    end
    local scope = child_scope(fn, k, false, "group")
    scope.locals = cur_scope.locals
    attach(scope)
    run_scope(scope, fn)
end

-- Предоставляет значение CompositionLocal содержимому.
function R.provide(lcl, value, fn)
    if not cur_scope then
        return fn()
    end
    local scope = child_scope(fn, nil, false, "group")
    local locals = {}
    for k, v in pairs(cur_scope.locals) do
        locals[k] = v
    end
    locals[lcl] = value
    -- та же таблица, если значения не поменялись: пропуски потомков работают
    if scope.provided and shallow_equal(scope.provided, locals) then
        locals = scope.provided
    end
    scope.provided = locals
    scope.locals = locals
    attach(scope)
    run_scope(scope, fn)
end

-- Хуки

local function next_slot(kind)
    local scope = cur_scope
    if not scope then
        error("hook called outside of composition", 3)
    end
    if scope.initializing_hook then
        error("hook called inside initializer of " .. scope.initializing_hook .. "; call hooks during composition", 3)
    end
    scope.slot_i = scope.slot_i + 1
    local i = scope.slot_i
    if scope.current_hooks then
        scope.current_hooks[i] = { kind = kind, site = hook_site() }
    end
    local expected = scope.hook_kinds[i]
    if expected and expected ~= kind then
        error(hook_error(scope, i, expected, kind), 3)
    end
    if scope.hook_count and i > scope.hook_count then
        error(hook_error(scope, i, "end of composition", kind), 3)
    end
    scope.hook_kinds[i] = kind
    return scope, scope.slot_i
end

-- Ключи хуков: {n = число, ...}. n нужен, чтобы nil среди ключей
-- сравнивался корректно (# для таблиц с дырами не определён).
local function pack_keys(...)
    return { n = select("#", ...), ... }
end

local function keys_changed(old, new)
    if old == nil then
        return true
    end
    if old.n ~= new.n then
        return true
    end
    for i = 1, new.n do
        if old[i] ~= new[i] then
            return true
        end
    end
    return false
end

-- Запоминает значение между рекомпозициями. init - значение или функция.
-- Дополнительные аргументы - ключи: при их смене значение пересчитывается.
function R._remember(kind, init, ...)
    local scope, i = next_slot(kind)
    local slot = scope.slots[i]
    local keys = select("#", ...) > 0 and pack_keys(...) or nil
    if slot == nil or (keys and keys_changed(slot.keys, keys)) then
        local v = init
        if type(init) == "function" then
            scope.initializing_hook = kind
            v = init()
            scope.initializing_hook = nil
        end
        slot = { v = v, keys = keys }
        scope.slots[i] = slot
    end
    return slot.v
end

function R.remember(init, ...)
    return R._remember("remember", init, ...)
end

-- Состояние, живущее в компоненте.
function R.state(initial, eq)
    return R._remember("state", function()
        if type(initial) == "function" then
            return R.new_state(initial(), eq)
        end
        return R.new_state(initial, eq)
    end)
end

-- Фиксированная схема формы; один хук независимо от числа полей.
function R.form(initial)
    assert(type(initial) == "table", "K.form initial must be a table")
    local form = R._remember("form", function()
        local fields = {}
        for key, value in pairs(initial) do fields[key] = R.new_state(value) end
        return fields
    end)
    for key in pairs(initial) do
        assert(form[key] ~= nil, "K.form schema changed; recreate the form in a new K.key scope")
    end
    for key in pairs(form) do
        assert(initial[key] ~= nil, "K.form schema changed; recreate the form in a new K.key scope")
    end
    return form
end

-- Побочный эффект после применения кадра. Перезапускается при смене ключей.
-- fn может вернуть функцию очистки.
function R.effect(fn, ...)
    local scope, i = next_slot("effect")
    local keys = pack_keys(...)
    local slot = scope.slots[i]
    if slot == nil then
        slot = { __effect = true, scope = scope }
        scope.slots[i] = slot
    end
    if keys_changed(slot.keys, keys) then
        slot.keys = keys
        slot.pending = fn
        local rt = cur_rt
        if not slot.queued then
            slot.queued=true
            rt.effects[#rt.effects + 1] = slot
        end
    end
end

-- Вызывается при уходе компонента из композиции.
function R.on_dispose(fn)
    local scope, i = next_slot("on_dispose")
    local slot = scope.slots[i]
    if slot == nil then
        slot = { __effect = true }
        scope.slots[i] = slot
    end
    slot.cleanup = fn
end

-- Подписка принадлежит слоту компонента, callback обновляется при композиции.
function R.on_frame(fn)
    assert(type(fn) == "function", "on_frame callback required")
    local scope, i = next_slot("on_frame")
    local slot = scope.slots[i]
    if not slot then
        slot = {__frame=true, scope=scope}
        scope.slots[i] = slot
        scope.rt.frame_callbacks[#scope.rt.frame_callbacks+1] = slot
    end
    slot.fn = fn
end

-- Значение внешнего (нереактивного) источника: getter() вызывается каждый
-- кадр, и область перезапускается, только когда результат изменился.
-- Мост к обычному коду, как supplier в XML-макетах движка:
--   local text = K.poll(editor.status_text)
function R.poll(getter, eq)
    local rt = cur_rt
    local p = R._remember("poll", function()
        local ok, v = pcall(getter)
        -- по умолчанию поверхностное сравнение: новая таблица с теми же
        -- полями - не изменение
        return { state = R.new_state(ok and v or nil, eq or shallow_equal) }
    end)
    p.getter = getter
    rt.pollers[p] = true
    local slot = cur_scope.slots[cur_scope.slot_i]
    slot.__effect = true
    slot.cleanup = function() rt.pollers[p] = nil end
    return p.state.value
end

-- Текущий рантайм и время кадра.
function R.runtime()
    return cur_rt
end

function R.current_scope()
    return cur_scope
end

-- Регистрирует всплывающий слой во фрагменте текущей области.
function R.add_overlay(ov)
    local frag = cur_scope and cur_scope.fragment
    if not frag then
        return
    end
    frag.overlays = frag.overlays or {}
    frag.overlays[#frag.overlays + 1] = ov
end

-- Рантайм приложения

local Runtime = {}
Runtime.__index = Runtime

-- opts: content (функция UI), width, height, backend (может быть nil),
-- measurer (text), on_error
function R.new(opts)
    local rt = setmetatable({
        content = opts.content,
        width = opts.width or 800,
        height = opts.height or 600,
        measurer = opts.measurer,
        backend = opts.backend,
        frame = 0,
        layout_pass = 0,
        -- поколение кэша раскладки: смена сбрасывает размеры всех узлов
        layout_gen = 0,
        time = 0,
        need_compose = true,
        need_layout = true,
        dirty = {},
        effects = {},
        anims = {},
        pollers = {},
        frame_callbacks = {},
        pending_disposals = {},
        errors = {},
        warnings = {},
        on_error = opts.on_error,
        hook_diagnostics = opts.hook_diagnostics == true,
        root = nil,
        overlays = {},
        base_locals = opts.locals or EMPTY,
        stats = { full = 0, partial = 0, reruns = 0 },
    }, Runtime)
    rt.root_scope = new_scope(rt, nil, opts.content, "root", "root")
    rt.root_scope.locals = rt.base_locals
    return rt
end

-- Предупреждение разработчику: печатается один раз, копится в rt.warnings.
function Runtime:warn(msg)
    self.warned = self.warned or {}
    if self.warned[msg] then
        return
    end
    self.warned[msg] = true
    self.warnings[#self.warnings + 1] = msg
    print("[kompot] warning: " .. msg)
end

-- Опрос внешних источников (R.poll): изменившиеся помечают области.
function Runtime:run_pollers()
    for p in pairs(self.pollers) do
        local ok, v = pcall(p.getter)
        if ok then
            p.state:set(v)
        else
            self:report_error(v)
        end
    end
end

function Runtime:request_frame()
    self.frame_requested = true
end

-- Полная рекомпозиция в следующем кадре: корневое содержимое или его
-- окружение (тема, content хоста) заменены снаружи.
function Runtime:invalidate()
    self.force_full = true
    self.need_compose = true
    self:request_frame()
end

-- Полная перераскладка: изменилось то, от чего зависят размеры всех узлов
-- (метрики шрифтов и т.п.), но не само дерево.
function Runtime:invalidate_layout()
    self.layout_gen = self.layout_gen + 1
    self.need_layout = true
    self:request_frame()
end

function Runtime:mark_dirty(scope)
    if scope.disposed then
        return
    end
    scope.dirty = true
    self.dirty[scope] = true
    self.need_compose = true
end

function Runtime:report_error(err)
    self.errors[#self.errors + 1] = tostring(err)
    if #self.errors > 50 then
        table.remove(self.errors, 1)
    end
    if self.on_error then
        self.on_error(err)
    end
end

function Runtime:set_viewport(w, h)
    if w ~= self.width or h ~= self.height then
        self.width, self.height = w, h
        self.need_layout = true
    end
end

local function scope_active(scope)
    while scope do
        if scope.disposed or scope.detached then return false end
        scope=scope.parent
    end
    return true
end

-- Перезапускает одну область на её месте.
function Runtime:_rerun(scope)
    local kind = scope.kind
    if kind == "call" then
        run_scope(scope, scope.fn, scope.props, scope.content)
    elseif kind == "sub" then
        run_scope(scope, scope.fn, scope.arg)
    else
        run_scope(scope, scope.fn)
    end
    sweep(scope, self.frame)
    self.stats.reruns = self.stats.reruns + 1
end

-- Композиция: полная (первый кадр, корень грязный) или частичная.
function Runtime:compose()
    self.frame = self.frame + 1
    local prev_rt = cur_rt
    cur_rt = self
    -- набор грязных областей забираем сразу: пометки, сделанные во время
    -- этой композиции, доживут до следующего кадра
    local dirty = self.dirty
    self.dirty = {}
    self.need_compose = false
    local full = self.root == nil or self.root_scope.dirty or self.force_full
    local ok, err = true, nil
    if full then
        self.force_full = false
        local root = { kind = "box", mods = EMPTY, params = { fill = true }, children = {} }
        self.root_scope.fn = self.content
        root.children[1] = self.root_scope.fragment
        ok, err = pcall(run_scope, self.root_scope, self.content)
        self.root = root
        self.last_full = true
        self.stats.full = self.stats.full + 1
    else
        -- грязные области сверху вниз; потомка, которого уже перезапустил
        -- предок, пропускаем (флаг dirty у него снят)
        local list = {}
        for scope in pairs(dirty) do
            list[#list + 1] = scope
        end
        table.sort(list, function(a, b)
            return a.depth < b.depth
        end)
        for _, scope in ipairs(list) do
            if scope.dirty and scope_active(scope) then
                local r_ok, r_err = pcall(self._rerun, self, scope)
                if not r_ok then
                    ok, err = false, r_err
                end
            end
        end
        self.stats.partial = self.stats.partial + 1
    end
    cur_rt = prev_rt
    self.need_layout = true
    if not ok then
        self:report_error(err)
        self.error_text = tostring(err)
        self.force_full = true
    else
        self.error_text = nil
    end
    return self.root
end

-- Подкомпозиция во время раскладки (ленивые списки): запускает fn(arg) в
-- области с ключом key внутри owner_scope. Возвращает узел-обёртку.
-- key должен включать идентификатор списка (в одной области их может быть
-- несколько); см. layout.lua POLICIES.lazy.
function Runtime:subcompose(owner_scope, key, fn, arg)
    local prev_rt, prev_scope, prev_parent = cur_rt, cur_scope, cur_parent
    cur_rt, cur_scope = self, owner_scope
    local k = "sub:" .. tostring(key)
    local scope = owner_scope.children[k]
    if scope and scope.disposed then
        scope = nil
    end
    if not scope then
        scope = new_scope(self, owner_scope, fn, key, "sub")
        owner_scope.children[k] = scope
    end
    local wrapper = scope.wrapper
    if not wrapper then
        wrapper = {
            kind = "box",
            mods = EMPTY,
            params = EMPTY,
            children = { scope.fragment },
            key = "i" .. tostring(key),
        }
        scope.wrapper = wrapper
    end
    scope.locals = owner_scope.locals
    scope.lazy_seen = self.layout_pass
    scope.lazy_list = tostring(key):match("^(.-):")
    local ok, err = true, nil
    if scope.fn ~= fn or scope.arg ~= arg or scope.dirty or not scope.ran then
        scope.fn, scope.arg, scope.ran = fn, arg, true
        ok, err = pcall(run_scope, scope, fn, arg)
    else
        mark_visited(scope, self.frame)
    end
    scope.visited = self.frame
    cur_rt, cur_scope, cur_parent = prev_rt, prev_scope, prev_parent
    if not ok then
        self:report_error(err)
    end
    return wrapper
end

-- Убирает подкомпозиции списка list_id, не видимые в текущей раскладке.
function Runtime:sweep_subcompositions(owner_scope, list_id)
    for k, child in pairs(owner_scope.children) do
        if
            child.kind == "sub"
            and child.lazy_list == list_id
            and child.lazy_seen ~= self.layout_pass
        then
            dispose_scope(child)
            owner_scope.children[k] = nil
        end
    end
end

-- Отсоединяем ушедшие области перед кадровыми callbacks, но выполняем
-- cleanup после применения интерфейса. Вторая композиция может быть частичной,
-- поэтому обход полной композиции должен завершиться до её начала.
function Runtime:prune_scopes()
    if self.last_full then
        sweep(self.root_scope,self.frame,self.pending_disposals)
        self.last_full=false
    end
end

local function dispose_pending(rt)
    local pending=rt.pending_disposals
    rt.pending_disposals={}
    for _,scope in ipairs(pending) do dispose_scope(scope) end
end

-- Удаляет ушедшие области и запускает эффекты. Вызывать после раскладки.
function Runtime:commit()
    dispose_pending(self)
    if self.last_full then
        sweep(self.root_scope, self.frame)
        self.last_full = false
    end
    local effects = self.effects
    self.effects = {}
    for _, slot in ipairs(effects) do
        slot.queued=nil
        if slot.cleanup then
            local ok, err = pcall(slot.cleanup)
            if not ok then
                self:report_error(err)
            end
            slot.cleanup = nil
        end
        if slot.pending then
            slot.committed_keys = slot.keys
            local ok, res = pcall(slot.pending)
            slot.pending = nil
            if not ok then
                self:report_error(res)
            elseif type(res) == "function" then
                slot.cleanup = res
            end
        end
    end
end

function Runtime:dispose()
    dispose_pending(self)
    dispose_scope(self.root_scope)
    self.frame_callbacks = {}
    self.disposed = true
end

function Runtime:run_frame_callbacks(dt)
    if #self.frame_callbacks==0 and not self.frame_error then return end
    if self.frame_error and self.error_text==self.frame_error then
        self.error_text=nil
        self.need_layout=true
    end
    self.frame_error=nil
    local keep = {}
    for _, slot in ipairs(self.frame_callbacks) do
        if not slot.dead and scope_active(slot.scope) then
            keep[#keep+1] = slot
            local ok, err = true, nil
            if not scope_failed(slot.scope) then ok, err = pcall(slot.fn, dt) end
            if not ok then
                self:report_error(err)
                self.frame_error=tostring(err)
                self.need_layout=true
            end
        end
    end
    self.frame_callbacks = keep
end

-- Регистрирует активную анимацию (см. anim.lua).
function Runtime:add_anim(a)
    if not a.active then
        a.active = true
        self.anims[#self.anims + 1] = a
    end
end

-- Продвигает анимации на dt. Возвращает true, если что-то изменилось.
function Runtime:step_anims(dt)
    local list = self.anims
    if #list == 0 then
        return false
    end
    local keep = {}
    for _, a in ipairs(list) do
        -- анимация ушедшего компонента больше не нужна
        if a.scope and a.scope.disposed then
            a.dead = true
            a.active = false
        end
        if not a.dead then
            local running = a:step(dt)
            if a.scope then
                self:mark_dirty(a.scope)
            end
            if running then
                keep[#keep + 1] = a
            else
                a.active = false
            end
        end
    end
    self.anims = keep
    return true
end

R.Runtime = Runtime

-- Для отладки и тестов
function R._set_current(rt, scope, parent)
    cur_rt, cur_scope, cur_parent = rt, scope, parent
end

return R
