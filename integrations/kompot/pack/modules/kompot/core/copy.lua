-- Поверхностная копия обычной таблицы с необязательной заменой полей.
-- Вложенные значения сохраняют ссылки; метатаблица не переносится.
return function(source, changes)
    assert(type(source) == "table", "K.copy requires a table source")
    assert(changes == nil or type(changes) == "table", "K.copy changes must be a table")
    local out = {}
    for key, value in pairs(source) do
        out[key] = value
    end
    if changes then
        for key, value in pairs(changes) do
            out[key] = value
        end
    end
    return out
end
