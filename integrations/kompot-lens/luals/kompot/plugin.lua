-- Resolve VoxelCore pack modules, including types before the dependency is installed.
-- The extension supplies workspace-specific paths in a generated wrapper.
local furi = require 'file-uri'
local plugin_file = debug.getinfo(1, 'S').source:sub(2):gsub('\\', '/')
local bundled = plugin_file:match('^(.*)/plugin.lua$')
local library = kompot_library or (bundled and bundled .. '/library')
local configured = kompot_content
local function exists(file)
    local f = io.open(file, 'rb')
    if not f then return false end
    f:close()
    return true
end
function ResolveRequire(uri, name, suri)
    local pack, module = name:match('^([%w_%-]+):([%w_/%-]+)$')
    if not pack then return nil end
    if pack == 'kompot' and kompot_modules and (module == 'kompot' or module == 'ui') then
        return {furi.encode(kompot_modules .. '/' .. module .. '.lua')}
    end
    if configured and configured ~= '' then
        local file = configured .. '/' .. pack .. '/modules/' .. module .. '.lua'
        if exists(file) then return {furi.encode(file)} end
    end
    local source = furi.decode(suri or uri):gsub('\\', '/')
    local own_root = source:match('^(.*)/modules/')
    if own_root and exists(own_root .. '/package.json') then
        local f = io.open(own_root .. '/package.json', 'rb')
        local manifest = f:read('*a'); f:close()
        if manifest:match('"id"%s*:%s*"([%w_%-]+)"') == pack then
            return {furi.encode(own_root .. '/modules/' .. module .. '.lua')}
        end
    end
    local dir = source:match('^(.*)/')
    for _ = 1, 12 do
        if not dir then break end
        local file = dir .. '/' .. pack .. '/modules/' .. module .. '.lua'
        if exists(file) then return {furi.encode(file)} end
        dir = dir:match('^(.*)/')
    end
    if pack == 'kompot' and library and (module == 'kompot' or module == 'ui') then
        local stub = library .. '/modules/' .. module .. '.lua'
        if exists(stub) then return {furi.encode(stub)} end
    end
    return nil
end
