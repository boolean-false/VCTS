-- Отрисовка текста по нативной раскладке. Все координаты локальны полю.
local P = {}
local Color = require "kompot:kompot/core/color"
local CHAR = "[%z\1-\127\194-\244][\128-\191]*"

function P.draw(layout, options, context)
    local out = {}
    local function rect(r, color)
        out[#out + 1] = {
            kind = "rect",
            x = r[1],
            y = r[2],
            w = r[3],
            h = r[4],
            color = Color.mul_alpha(Color.of(color), context.alpha or 1),
        }
    end
    if context.focused then
        for _, r in ipairs(layout.selectionRects) do
            rect(r, options.selection_color or "#427AA980")
        end
    end
    for _, line in ipairs(layout.lines) do
        local x, index = line.pos[1], line.start
        local run, run_color, run_x, run_width = {}, nil, x, 0
        local function flush()
            if #run == 0 then
                return
            end
            out[#out + 1] = {
                kind = "text",
                x = run_x,
                y = line.pos[2],
                w = run_width,
                h = layout.textHeight,
                text = table.concat(run),
                font = layout.font,
                color = Color.mul_alpha(
                    Color.of(run_color),
                    (context.hint and 0.5 or 1)
                        * (run_color == context.color and 1 or (context.alpha or 1))
                ),
            }
            run = {}
        end
        local n = 0
        for ch in line.text:gmatch(CHAR) do
            local color = context.color
            for _, span in ipairs(options.spans or {}) do
                if index >= span.start and index < span.finish then
                    color = span.color
                end
            end
            if color ~= run_color then
                flush()
                run_x, run_width, run_color = x, 0, color
            end
            n = n + 1
            local advance = line.advances[n] or 0
            run[#run + 1], run_width = ch, run_width + advance
            x, index = x + advance, index + 1
        end
        flush()
    end
    if context.focused and context.editable then
        local caret = options.caret or {}
        local blink = caret.blink
        if blink == nil then
            blink = 0.5
        end
        if blink <= 0 or math.floor(context.caret_age / blink) % 2 == 0 then
            local r = layout.caretRect
            if options.draw_caret then
                for _, p in ipairs(options.draw_caret({ r[1], r[2], r[3], r[4] }, context) or {}) do
                    local copy = {}
                    for k, v in pairs(p) do
                        copy[k] = v
                    end
                    copy.color =
                        Color.mul_alpha(Color.of(p.color) or Color.WHITE, context.alpha or 1)
                    out[#out + 1] = copy
                end
            else
                rect(
                    { r[1], r[2], caret.shape == "block" and r[3] or (caret.width or 2), r[4] },
                    caret.color or "#FFFFFFFF"
                )
            end
        end
    end
    return out
end

return P
