-- LuaLS: require "pack:path" -> <content>/<pack>/modules/<path>.lua.
-- LuaLS передаёт URI корня рабочей области, а не текущего файла.
function ResolveRequire(uri, name)
    local pack, module = name:match("^([%w_%-]+):([%w_/%-]+)$")
    if not pack then
        return nil
    end
    local content = uri:match("^(.*[/]content)$") or uri:match("^(.*[/]content)/[^/]+$")
    if not content then
        return nil
    end
    return { content .. "/" .. pack .. "/modules/" .. module .. ".lua" }
end
