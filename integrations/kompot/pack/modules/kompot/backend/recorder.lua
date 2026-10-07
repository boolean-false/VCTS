-- Бэкенд для тестов и превью: запоминает последний список примитивов.

local text = require "kompot:kompot/core/text"

local B = {}
B.__index = B

function B.new()
    return setmetatable({ dl = {}, applies = 0, cursor = nil }, B)
end

function B:apply(dl)
    self.dl = dl
    self.applies = self.applies + 1
end

function B:set_cursor(c)
    self.cursor = c
end

-- Примитив по подстроке ключа и виду.
function B:find(kind, pred)
    for _, p in ipairs(self.dl) do
        if p.kind == kind and (not pred or pred(p)) then
            return p
        end
    end
    return nil
end

function B:texts()
    local out = {}
    for _, p in ipairs(self.dl) do
        if p.kind == "text" then
            out[#out + 1] = p.text
        end
    end
    return out
end

B.measurer = text.approx_measurer
return B
