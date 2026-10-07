-- Minimal VoxelCore adapter. Functions use dot calls, matching noImplicitSelf.
local M = {}
local definitions, instances, timers = {}, {}, {}
local clock, active_panel = 0, nil
local function key(x, y, z) return x .. ":" .. y .. ":" .. z end
local function int16(value)
    assert(type(value) == "number" and value == math.floor(value)
        and value >= -32768 and value <= 32767, "expected int16")
    return value
end

function M.signal()
    local handlers = {}
    return {
        subscribe = function(callback)
            local token = {}
            handlers[token] = callback
            token.dispose = function() handlers[token] = nil end
            return token
        end,
        emit = function(value)
            local snapshot = {}
            for token, callback in pairs(handlers) do snapshot[token] = callback end
            for token, callback in pairs(snapshot) do
                if handlers[token] then callback(value) end
            end
        end,
    }
end

local function lifetime()
    local resources = {}
    local scope = {closed = false}
    scope.own = function(resource)
        if scope.closed then resource.dispose() else resources[resource] = true end
    end
    scope._release = function(resource) resources[resource] = nil end
    scope.after = function(seconds, callback)
        assert(type(seconds) == "number" and seconds >= 0 and seconds < math.huge, "invalid delay")
        local token = {}
        token.dispose = function() timers[token] = nil; resources[token] = nil end
        if not scope.closed then
            timers[token] = {at = clock + seconds, callback = callback, owner = scope}
            resources[token] = true
        end
        return token
    end
    scope.close = function()
        if scope.closed then return end
        scope.closed = true
        local old = resources
        resources = {}
        for resource in pairs(old) do resource.dispose() end
    end
    return scope
end

M.field = {int16 = function(initial) return {kind = "int16", initial = int16(initial)} end}
function M.defineBlock(definition) return definition end
function M.definePack(definition) return definition end
function M.defineProject(definition) return definition end

function M.register_pack(pack_definition)
    for _, definition in ipairs(pack_definition.blocks) do
        -- World scripts reload while require may keep the same exported table.
        assert(not definitions[definition.id] or definitions[definition.id] == definition,
            "duplicate block definition " .. definition.id)
        definitions[definition.id] = definition
    end
end

function M.forget(x, y, z)
    local name = key(x, y, z)
    local instance = instances[name]
    if instance then
        instances[name] = nil
        instance.context.lifetime.close()
    end
end

function M.present(id, x, y, z, placed)
    -- VC may still deliver a queued presence event after the world has closed.
    if not world.is_open() then return nil end
    local definition = assert(definitions[id], "unknown block " .. id)
    if block.get(x, y, z) ~= block.index(id) then return nil end
    local name = key(x, y, z)
    if placed then M.forget(x, y, z) end
    if instances[name] and instances[name].id ~= id then M.forget(x, y, z) end
    if instances[name] then return instances[name].context end
    for field_name, spec in pairs(definition.state) do
        if placed or block.get_field(x, y, z, field_name) == nil then
            block.set_field(x, y, z, field_name, spec.initial)
        end
    end
    local scope = lifetime()
    local state = setmetatable({}, {
        __index = function(_, field_name)
            assert(not scope.closed, "block lifetime is closed")
            assert(definition.state[field_name], "unknown state field " .. field_name)
            return block.get_field(x, y, z, field_name)
        end,
        __newindex = function(_, field_name, value)
            assert(not scope.closed, "block lifetime is closed")
            assert(block.get(x, y, z) == block.index(id), "block was replaced")
            assert(definition.state[field_name], "unknown state field " .. field_name)
            block.set_field(x, y, z, field_name, int16(value))
        end,
    })
    local context = {position = {x=x, y=y, z=z}, state=state,
        transient=definition.transient(), lifetime=scope}
    instances[name] = {id=id, context=context}
    return context
end

function M.interact(id, x, y, z, playerid)
    local context = M.present(id, x, y, z, false)
    if not context then return false end
    return definitions[id].onInteract(context, playerid)
end

local function escaped(text)
    return tostring(text):gsub("&", "&amp;"):gsub("<", "&lt;")
        :gsub(">", "&gt;"):gsub('"', "&quot;")
end

function M.close_panel(from_document)
    local panel = active_panel
    if not panel then return end
    active_panel = nil
    panel.subscription.dispose()
    panel.model.owner._release(panel.owner_token)
    if not from_document and hud ~= nil and hud.is_open("vcts:panel") then hud.close("vcts:panel") end
end

local function render(panel)
    if panel ~= active_panel or not panel.document then return end
    local view = panel.model.read()
    panel.document.title.text = panel.definition.title
    -- Basic VC bitmap fonts do not include typographic ellipsis.
    panel.document.summary.text = panel.definition.text(view):gsub("…", "...")
    for index, button in ipairs(panel.definition.buttons) do
        panel.document["action_" .. index].enabled = button.enabled(view)
    end
end

function M.mount_panel(document)
    local panel = assert(active_panel, "no panel model")
    panel.document = document
    document.buttons:clear()
    for index, button in ipairs(panel.definition.buttons) do
        document.buttons:add(string.format(
            '<button id="action_%d" size="360,40" margin="0,0,0,8" onclick="action(%d)">%s</button>',
            index, index, escaped(button.label)))
    end
    render(panel)
end

function M.click(index)
    local panel = active_panel
    if not panel or panel.model.owner.closed then return end
    local button = panel.definition.buttons[index]
    if button and button.enabled(panel.model.read()) then button.invoke(panel.model.actions) end
end

function M.definePanel(definition)
    return {open = function(playerid, model)
        assert(not model.owner.closed, "cannot open panel for a closed owner")
        if hud ~= nil then assert(playerid == hud.get_player(), "only local player UI is supported") end
        M.close_panel(false)
        local panel = {definition=definition, model=model}
        active_panel = panel
        panel.subscription = model.changed.subscribe(function() render(panel) end)
        panel.owner_token = {dispose=function()
            if active_panel == panel then M.close_panel(false) end
        end}
        model.owner.own(panel.owner_token)
        if hud ~= nil then hud.show_overlay("vcts:panel", false) end
    end}
end

function M.tick()
    if not world.is_open() then return end
    clock = clock + 1/20 -- Gameplay time: only world ticks advance delayed work.
    local stale = {}
    for _, instance in pairs(instances) do
        local pos = instance.context.position
        if block.get(pos.x, pos.y, pos.z) ~= block.index(instance.id) then stale[#stale+1] = pos end
    end
    for _, pos in ipairs(stale) do M.forget(pos.x, pos.y, pos.z) end
    local due = {}
    for token, task in pairs(timers) do
        if task.at <= clock + 1e-8 then due[#due+1] = token end
    end
    for _, token in ipairs(due) do
        local task = timers[token]
        if task then
            token.dispose()
            if not task.owner.closed then task.callback() end
        end
    end
end

function M.shutdown()
    M.close_panel(false)
    for _, instance in pairs(instances) do instance.context.lifetime.close() end
    instances, timers, clock = {}, {}, 0
end

-- Read-only diagnostics used by the integration scripts.
function M.snapshot(x, y, z)
    local instance = instances[key(x,y,z)]
    return instance and {charging=instance.context.transient.charging,
        stored=instance.context.state.stored, closed=instance.context.lifetime.closed} or nil
end
function M.panel_snapshot()
    return active_panel and active_panel.model.read() or nil
end
function M.stats()
    local count, pending = 0, 0
    for _ in pairs(instances) do count = count + 1 end
    for _ in pairs(timers) do pending = pending + 1 end
    return {instances=count, pending=pending, panel=active_panel ~= nil}
end
return M
