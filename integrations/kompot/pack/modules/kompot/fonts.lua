-- Семейства шрифтов: общие ресурсы для тем, движка и внешнего превью.
-- Регистрация описывает уже загруженные preload.json ресурсы, не загружает TTF.
local Text = require "kompot:kompot/core/text"
local F = {}
local families, resources = {}, {}

function F.register_family(id, entries)
    assert(type(id) == "string" and id:find(":", 1, true), "font family must be pack:name")
    assert(not families[id], "font family already registered: " .. id)
    local family, pending = {}, {}
    for _, entry in ipairs(entries) do
        assert(
            type(entry.name) == "string" and type(entry.file) == "string",
            "font name and file required"
        )
        assert(type(entry.size) == "number" and entry.size > 0, "positive font size required")
        local weight = entry.weight or "regular"
        family[weight] = family[weight] or {}
        assert(not family[weight][entry.size], "duplicate font face/size: " .. id)
        assert(
            not resources[entry.name] and not pending[entry.name],
            "duplicate font resource: " .. entry.name
        )
        local info = {}
        for k, v in pairs(entry) do
            info[k] = v
        end
        info.family, info.weight, info.absolute, info.measured = id, weight, true, false
        family[weight][entry.size], pending[entry.name] = info, info
    end
    assert(next(pending), "empty font family: " .. id)
    families[id] = family
    for name, info in pairs(pending) do
        resources[name] = info
    end
end

function F.info(name)
    return resources[name]
end

function F.resolve(id, size, weight)
    weight = weight or "regular"
    local family = assert(families[id], "unregistered font family: " .. tostring(id))
    local face = family[weight] and family[weight][size]
    assert(
        face,
        string.format(
            "font %s: missing %s at %s px; add it to the font manifest",
            id,
            weight,
            tostring(size)
        )
    )
    return face.name
end

-- Общие стили остаются связаны, пока их не переопределили отдельно.
-- Моноширинные стили берут шрифт из mono_family.
function F.typography(defaults, opts, overrides)
    opts, overrides = opts or {}, overrides or {}
    local result, copies = {}, {}
    for name, base in pairs(defaults) do
        local copy = copies[base]
        if not copy then
            copy = {}
            for k, v in pairs(base) do
                copy[k] = v
            end
            copies[base] = copy
            local mono = name:match("^mono") or (base.font or ""):find("mono", 1, true)
            local family = mono and opts.mono_family or (not mono and opts.family)
            if family then
                local size = assert(base.size, "font size missing for style " .. name)
                copy.font = F.resolve(family, size, base.weight or "regular")
                copy.family = family
                -- Смещение старого шрифта здесь уже не подходит.
                copy.optical_offset = nil
                if base.bold then
                    copy.bold = F.resolve(family, size, "semibold")
                end
            end
        end
        result[name] = copy
    end
    for name, override in pairs(overrides) do
        assert(type(override) == "table", "text style must be a table: " .. name)
        local copy = {}
        for k, v in pairs(result[name] or {}) do
            copy[k] = v
        end
        for k, v in pairs(override) do
            copy[k] = v
        end
        if
            not override.font
            and copy.family
            and (override.family or override.size or override.weight)
        then
            copy.font = F.resolve(copy.family, copy.size, copy.weight)
            copy.optical_offset = override.optical_offset
            if copy.bold and not override.bold then
                copy.bold = F.resolve(copy.family, copy.size, "semibold")
            end
        elseif override.font then
            -- Явно заданный шрифт больше не наследует семейство.
            copy.family = override.family
            copy.optical_offset = override.optical_offset
            copy.bold = override.bold
        end
        result[name] = copy
    end
    return result
end

function F.register_metrics(metrics)
    Text.register_metrics(metrics)
    for name, info in pairs(resources) do
        if metrics[name] then
            info.measured = true
        end
    end
end

return F
