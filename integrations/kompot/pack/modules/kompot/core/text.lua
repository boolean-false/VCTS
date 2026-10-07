-- Раскладка текста: перенос по словам, ограничение строк, многоточие.
-- Ширину строки измеряет measurer (бэкенд):
--   measurer:width(font, text) -> px
--   measurer:line_height(font) -> px

local text = {}

local CHAR = "[%z\1-\127\194-\244][\128-\191]*"
local ELLIPSIS = "…"

local cache = {}
local cache_n = 0
local CACHE_LIMIT = 4000

-- Разбивает строку на символы UTF-8.
local function chars(s)
    local out = {}
    for ch in s:gmatch(CHAR) do
        out[#out + 1] = ch
    end
    return out
end
text.chars = chars

-- Самый длинный префикс s (по символам), помещающийся в max_w вместе с suffix.
local function fit_prefix(m, font, s, max_w, suffix)
    suffix = suffix or ""
    local cs = chars(s)
    local lo, hi = 0, #cs
    while lo < hi do
        local mid = math.floor((lo + hi + 1) / 2)
        local w = m:width(font, table.concat(cs, "", 1, mid) .. suffix)
        if w <= max_w then
            lo = mid
        else
            hi = mid - 1
        end
    end
    return table.concat(cs, "", 1, lo), lo
end

-- Переносит один абзац по словам. Слово шире строки режется по символам.
local function wrap_paragraph(m, font, para, max_w, lines)
    if para == "" then
        lines[#lines + 1] = ""
        return
    end
    if para:match("^%s+$") then
        lines[#lines + 1] = para
        return
    end
    local line = ""
    for word in para:gmatch("%S+%s*") do
        local candidate = line .. word
        local trimmed = candidate:gsub("%s+$", "")
        if m:width(font, trimmed) <= max_w or line == "" then
            if line == "" and m:width(font, trimmed) > max_w then
                -- слово длиннее строки: режем по символам
                local rest = word
                while rest ~= "" do
                    local head, n = fit_prefix(m, font, rest, max_w)
                    if n == 0 then
                        head = rest:match(CHAR)
                    end
                    rest = rest:sub(#head + 1)
                    if rest ~= "" then
                        lines[#lines + 1] = head
                    else
                        line = head
                    end
                end
            else
                line = candidate
            end
        else
            lines[#lines + 1] = (line:gsub("%s+$", ""))
            line = word
        end
    end
    -- Пробелы в конце самого Text занимают ширину: следующий элемент Row
    -- должен начинаться после них. Убираем их только на мягком переносе.
    lines[#lines + 1] = line
end

-- Раскладывает текст. Возвращает {lines = {...}, widths = {...}, w, h, lh}.
--   max_w    - ширина переноса (math.huge - без переноса)
--   max_lines- ограничение строк (nil - без)
--   wrap     - переносить ли по словам (false - только по \n)
--   ellipsis - обрезать последнюю строку многоточием
function text.layout(m, font, s, max_w, max_lines, wrap, ellipsis)
    s = tostring(s or "")
    local key = font
        .. "\0"
        .. s
        .. "\0"
        .. tostring(max_w)
        .. "\0"
        .. tostring(max_lines)
        .. (wrap == false and "n" or "w")
        .. (ellipsis == false and "c" or "e")
    local hit = cache[key]
    if hit then
        return hit
    end
    local lines = {}
    local can_wrap = wrap ~= false and max_w < math.huge
    for para in (s .. "\n"):gmatch("(.-)\n") do
        if can_wrap then
            wrap_paragraph(m, font, para, max_w, lines)
        else
            lines[#lines + 1] = para
        end
    end
    if max_lines and #lines > max_lines then
        local last = lines[max_lines]
        for i = #lines, max_lines + 1, -1 do
            lines[i] = nil
        end
        if ellipsis ~= false then
            local limit = max_w < math.huge and max_w or m:width(font, last .. ELLIPSIS)
            if m:width(font, last .. ELLIPSIS) > limit then
                last = fit_prefix(m, font, last, limit, ELLIPSIS)
            end
            lines[max_lines] = last .. ELLIPSIS
        end
    elseif ellipsis ~= false and not can_wrap and max_w < math.huge then
        -- одна строка без переноса, не влезает: многоточие
        for i, line in ipairs(lines) do
            if m:width(font, line) > max_w then
                lines[i] = fit_prefix(m, font, line, max_w, ELLIPSIS) .. ELLIPSIS
            end
        end
    end
    local lh = m:line_height(font)
    local widths, w = {}, 0
    for i, line in ipairs(lines) do
        local lw = line == "" and 0 or m:width(font, line)
        widths[i] = lw
        if lw > w then
            w = lw
        end
    end
    local result = { lines = lines, widths = widths, w = w, h = lh * #lines, lh = lh }
    cache_n = cache_n + 1
    if cache_n > CACHE_LIMIT then
        cache, cache_n = {}, 0
    end
    cache[key] = result
    return result
end

-- Текст из отрезков: разные цвета и шрифты в одном абзаце

local function hex_color(h)
    local r, g, b = tonumber(h:sub(1, 2), 16), tonumber(h:sub(3, 4), 16), tonumber(h:sub(5, 6), 16)
    local a = #h >= 8 and tonumber(h:sub(7, 8), 16) or 255
    return { r / 255, g / 255, b / 255, a / 255 }
end

-- Разметка md движка VoxelCore (как у label markup="md"):
--   [#RRGGBB] или [#RRGGBBAA] - цвет до следующей смены, **...** - жирный.
-- Возвращает отрезки {text, color, bold}; color = nil - цвет по умолчанию.
function text.parse_md(s)
    s = tostring(s or "")
    local runs = {}
    local cur_color, bold = nil, false
    local buf = {}
    local function flush()
        if #buf > 0 then
            runs[#runs + 1] = { text = table.concat(buf), color = cur_color, bold = bold }
            buf = {}
        end
    end
    local i, n = 1, #s
    while i <= n do
        local c = s:sub(i, i)
        if c == "[" then
            local h = s:match("^%[#(%x%x%x%x%x%x%x?%x?)%]", i)
            if h and (#h == 6 or #h == 8) then
                flush()
                cur_color = hex_color(h)
                i = i + #h + 3
            else
                buf[#buf + 1] = c
                i = i + 1
            end
        elseif c == "*" and s:sub(i + 1, i + 1) == "*" then
            flush()
            bold = not bold
            i = i + 2
        elseif c == "\\" and i < n then
            buf[#buf + 1] = s:sub(i + 1, i + 1)
            i = i + 2
        else
            buf[#buf + 1] = c
            i = i + 1
        end
    end
    flush()
    return runs
end

-- Раскладка отрезков {text, font, color} с переносом по словам.
-- Возвращает {lines = {{runs = {{text, font, color, x, w}}, w}}, widths,
-- w, h, lh, rich = true}. Высота строки - по самому высокому шрифту.
local rich_cache = setmetatable({}, { __mode = "k" })

function text.layout_rich(m, runs, max_w, max_lines, wrap)
    local per = rich_cache[runs]
    local key = tostring(max_w) .. "\0" .. tostring(max_lines) .. (wrap == false and "n" or "w")
    if per and per[key] then
        return per[key]
    end
    local can_wrap = wrap ~= false and max_w < math.huge
    local lines = {}
    local line, lw = {}, 0
    local lh = 0
    for _, r in ipairs(runs) do
        local h = m:line_height(r.font)
        if h > lh then
            lh = h
        end
    end
    if lh == 0 then
        lh = m:line_height("kompot_14")
    end

    local function push_piece(piece, r)
        local last = line[#line]
        if last and last.font == r.font and last.color == r.color then
            last.text = last.text .. piece
            last.w = m:width(r.font, last.text)
        else
            line[#line + 1] =
                { text = piece, font = r.font, color = r.color, x = lw, w = m:width(r.font, piece) }
        end
        local total = 0
        for _, p in ipairs(line) do
            p.x = total
            total = total + p.w
        end
        lw = total
    end
    local function trim_line()
        -- пробелы в конце строки не занимают места
        local last = line[#line]
        while last do
            local t = last.text:gsub("%s+$", "")
            if t == "" then
                line[#line] = nil
                last = line[#line]
            else
                last.text = t
                last.w = m:width(last.font, t)
                break
            end
        end
        local total = 0
        for _, p in ipairs(line) do
            p.x = total
            total = total + p.w
        end
        return total
    end
    local function new_line(keep_trailing)
        local w = keep_trailing and lw or trim_line()
        lines[#lines + 1] = { runs = line, w = w }
        line, lw = {}, 0
    end

    for _, r in ipairs(runs) do
        local s = tostring(r.text or "")
        local first = true
        for para in (s .. "\n"):gmatch("(.-)\n") do
            if not first then
                new_line(true)
            end
            first = false
            if can_wrap then
                for w in para:gmatch("%s*%S+%s*") do
                    local word = w
                    local ww = m:width(r.font, (word:gsub("%s+$", "")))
                    if lw > 0 and lw + ww > max_w then
                        new_line()
                        word = word:gsub("^%s+", "")
                    end
                    push_piece(word, r)
                end
                local tail = para:match("^%s+$")
                if tail then
                    push_piece(tail, r)
                end
            elseif para ~= "" then
                push_piece(para, r)
            end
        end
    end
    new_line(true)
    -- без переноса: строка шире места обрезается многоточием
    if not can_wrap and max_w < math.huge then
        for _, l in ipairs(lines) do
            if l.w > max_w then
                local limit = max_w - m:width(runs[1] and runs[1].font or "kompot_14", ELLIPSIS)
                local kept = {}
                for _, r in ipairs(l.runs) do
                    if r.x + r.w <= limit then
                        kept[#kept + 1] = r
                    else
                        local head = fit_prefix(m, r.font, r.text, limit - r.x)
                        if head ~= "" then
                            r.text = head
                            r.w = m:width(r.font, head)
                            kept[#kept + 1] = r
                        end
                        break
                    end
                end
                local last = kept[#kept]
                if last then
                    last.text = last.text .. ELLIPSIS
                    last.w = m:width(last.font, last.text)
                    l.w = last.x + last.w
                else
                    l.w = 0
                end
                l.runs = kept
            end
        end
    end
    if max_lines and #lines > max_lines then
        for i = #lines, max_lines + 1, -1 do
            lines[i] = nil
        end
        local last = lines[max_lines]
        local lr = last.runs[#last.runs]
        if lr then
            lr.text = lr.text .. ELLIPSIS
            lr.w = m:width(lr.font, lr.text)
            last.w = lr.x + lr.w
        end
    end
    -- пробелы в начале отрезка - смещением: метка движка их не рисует
    for _, l in ipairs(lines) do
        for _, r in ipairs(l.runs) do
            local lead = r.text:match("^%s+")
            if lead and #lead < #r.text then
                local lw2 = m:width(r.font, lead)
                r.x = r.x + lw2
                r.w = r.w - lw2
                r.text = r.text:sub(#lead + 1)
            end
        end
    end
    local widths, w = {}, 0
    for i, l in ipairs(lines) do
        widths[i] = l.w
        if l.w > w then
            w = l.w
        end
    end
    local result = { lines = lines, widths = widths, w = w, h = lh * #lines, lh = lh, rich = true }
    if not per then
        per = {}
        rich_cache[runs] = per
    end
    per[key] = result
    return result
end

-- Версия метрик: растёт при каждом сбросе кэша (шрифт загрузился, новые
-- метрики). Раскладка хранит её вместе с размерами узлов.
text.version = 0

function text.clear_cache()
    cache, cache_n = {}, 0
    text.version = text.version + 1
end

-- Приближённый измеритель без движка (тесты, превью без шрифтов):
-- ширина символа = size * k, высота строки = size * 1.25.
function text.approx_measurer(k)
    k = k or 0.55
    local function size_of(font)
        return tonumber(font:match("(%d+)$")) or 14
    end
    return {
        width = function(_, font, s)
            local n = 0
            for _ in s:gmatch(CHAR) do
                n = n + 1
            end
            return math.floor(n * size_of(font) * k + 0.5)
        end,
        line_height = function(_, font)
            return math.floor(size_of(font) * 1.25 + 0.5)
        end,
    }
end

-- Точный измеритель без движка использует метрики, зарегистрированные
-- дизайн-системой. Для символов и шрифтов вне таблицы - приближённый.
local extra_metrics = {}
local metrics_version = 0

function text.register_metrics(tbl)
    metrics_version = metrics_version + 1
    text.clear_cache()
    for font, m in pairs(tbl) do
        extra_metrics[font] = m
    end
end

function text.metrics_measurer()
    local cache_version = metrics_version
    local metrics = extra_metrics
    local approx = text.approx_measurer()
    local cache = {}
    local byte = string.byte
    local function codepoints(s)
        local out = {}
        for ch in s:gmatch(CHAR) do
            local b1, b2, b3, b4 = byte(ch, 1, 4)
            if #ch == 1 then
                out[#out + 1] = b1
            elseif #ch == 2 then
                out[#out + 1] = (b1 - 0xC0) * 64 + (b2 - 0x80)
            elseif #ch == 4 then
                out[#out + 1] = (b1 - 0xF0) * 262144
                    + (b2 - 0x80) * 4096
                    + (b3 - 0x80) * 64
                    + b4
                    - 0x80
            else
                out[#out + 1] = (b1 - 0xE0) * 4096 + (b2 - 0x80) * 64 + ((b3 or 0x80) - 0x80)
            end
        end
        return out
    end
    return {
        -- ширины символов строки (для внешних отрисовщиков превью)
        advances = function(_, font, s)
            local m = metrics[font] or {}
            local out = {}
            for i, cp in ipairs(codepoints(s)) do
                out[i] = m[cp] or approx:width(font, "x")
            end
            return out
        end,
        width = function(_, font, s)
            if cache_version ~= metrics_version then
                cache, cache_version = {}, metrics_version
            end
            local m = metrics[font]
            if not m then
                return approx:width(font, s)
            end
            local fc = cache[font]
            if not fc then
                fc = {}
                cache[font] = fc
            end
            local w = fc[s]
            if w then
                return w
            end
            w = 0
            for _, cp in ipairs(codepoints(s)) do
                w = w + (m[cp] or approx:width(font, "x"))
            end
            fc[s] = w
            return w
        end,
        line_height = function(_, font)
            local m = metrics[font]
            return m and m.lh or approx:line_height(font)
        end,
    }
end

-- Пользовательские измерители могут дать точную метрику textbox отдельно
-- от высоты обычного label. При её отсутствии используем оценку.
local field_metrics = require "kompot:kompot/core/field_metrics"
function text.field_line_height(m, font)
    if m.field_line_height then
        return m:field_line_height(font)
    end
    local extra = extra_metrics[font]
    return (extra and extra.field_lh)
        or field_metrics[font]
        or math.floor(m:line_height(font) * 1.5)
end

return text
