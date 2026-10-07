-- A pooled GUI frame may be leased again before deferred destructors run.
app.config_packs({"base", "kompot"})
app.new_world("kompot_layer_reuse", "1", "core:default")
local K = require "kompot:kompot"
local revision = K.new_state(0)
local function content()
    K.Box({modifier = K.M:size(120, 50):scale(1.45):background("#BA3528")}, function()
        K.Text("Round " .. revision.value)
    end)
end
local h = K.mount({content = content, lock_inventory = false})
h.fake_input = {x = -1, y = -1, inside = false, down = false}
local function entry()
    for _, e in pairs(h.backend.entries) do
        if e.layer_backend then return e end
    end
    error("scaled container was not created")
end
local function ready()
    for _ = 1, 60 do
        app.sleep(0.05)
        if entry().source_canvas then return entry() end
    end
    error("pooled layer never produced a snapshot")
end
h.app:frame(0)
local first = ready()
app.sleep(0.2)
local frame_id = first.layer_frame.id
local prefixes = {[first.layer_backend.prefix] = true, [first.layer_white_backend.prefix] = true}
for n = 1, 5 do
    -- Both operations happen before GUI postRunnable removes the old nodes.
    h:set_content(function() end)
    h.app:frame(0)
    h:set_content(content)
    h.app:frame(0)
    local current = entry()
    assert(current.layer_frame.id == frame_id, "test did not reuse the pooled frame")
    for _, backend in ipairs({current.layer_backend, current.layer_white_backend}) do
        assert(not prefixes[backend.prefix], "a new lease reused IDs from a deferred destructor")
        prefixes[backend.prefix] = true
    end
    ready()
    -- Touch the staged widgets after the old destructors have run: a stale
    -- document index previously made these updates fail with missing IDs.
    revision.value = n
    h.app:frame(0)
    app.sleep(0.2)
    for _, backend in ipairs({current.layer_backend, current.layer_white_backend}) do
        local found = false
        for _, e in pairs(backend.entries) do
            if e.prim.kind == "text" then
                assert(e.el.exists and e.el.text == "Round " .. n,
                    "reused frame lost its text widget or update")
                found = true
            end
        end
        assert(found, "pooled frame lost its text")
    end
    local cv = assert(current.source_canvas)
    local buffer = cv:get_data()
    local i = ((cv.height - 2) * cv.width + cv.width - 2) * 4
    assert(buffer.bytes[i] == 186 and buffer.bytes[i + 1] == 53
        and buffer.bytes[i + 2] == 40 and buffer.bytes[i + 3] == 255,
        "pooled frame corrupted its matte capture")
end
h:dispose()
app.close_world(false)
app.delete_world("kompot_layer_reuse")
print("passed: 5, failed: 0")
