-- Фон не зависит от размера элемента. Координаты и края указаны в пикселях исходника.
local P = {}
local serial = 0
local function positive(n, name)
    assert(type(n) == "number" and n > 0 and n < math.huge, name .. " must be positive")
    return n
end
function P.raster(opts)
    local w, h = positive(opts.width, "width"), positive(opts.height, "height")
    assert(w % 1 == 0 and h % 1 == 0, "raster dimensions must be integers")
    assert(type(opts.draw) == "function", "raster draw callback required")
    assert(
        opts.key == nil or (type(opts.key) == "string" and opts.key ~= ""),
        "raster key must be a nonempty string"
    )
    assert(
        opts.version == nil or type(opts.version) == "string" or type(opts.version) == "number",
        "raster version must be a string or number"
    )
    serial = serial + 1
    return {
        kind = "raster",
        width = w,
        height = h,
        draw = opts.draw,
        key = opts.key or ("anonymous:" .. serial),
        version = opts.version or 1,
    }
end
function P.nine_patch(src, opts)
    opts = opts or {}
    assert(
        type(src) == "string" or (type(src) == "table" and src.kind == "raster"),
        "image or raster source required"
    )
    local size = opts.source_size or (type(src) == "table" and { src.width, src.height })
    assert(size, "source_size required for texture images")
    local w, h = positive(size[1], "source width"), positive(size[2], "source height")
    if type(src) == "table" then
        assert(w == src.width and h == src.height, "raster source_size cannot be overridden")
    end
    local b = opts.border or 0
    if type(b) == "number" then
        b = { b, b, b, b }
    end
    assert(type(b) == "table" and #b == 4, "border must be a number or {left, top, right, bottom}")
    local border = {}
    for i = 1, 4 do
        assert(
            type(b[i]) == "number" and b[i] >= 0 and b[i] % 1 == 0,
            "border must contain nonnegative integers"
        )
        border[i] = b[i]
    end
    assert(
        w % 1 == 0 and h % 1 == 0 and b[1] + b[3] < w and b[2] + b[4] < h,
        "border must leave a nonempty image center"
    )
    local center, edges = opts.center or "stretch", opts.edges or "stretch"
    assert(center == "stretch" or center == "tile" or center == "none", "unknown center mode")
    assert(edges == "stretch" or edges == "tile", "unknown edge mode")
    return {
        kind = "nine_patch",
        src = src,
        width = w,
        height = h,
        border = border,
        scale = positive(opts.scale or 1, "scale"),
        center = center,
        edges = edges,
    }
end
function P.key(p)
    local src = p.src
    local key
    if type(src) == "table" then
        local version = tostring(src.version)
        key = "r:" .. #src.key .. ":" .. src.key .. ":" .. #version .. ":" .. version
    else
        key = "i:" .. #src .. ":" .. src
    end
    return key .. ":" .. p.width .. ":" .. p.height .. ":" .. table.concat(p.border, ",")
end
-- До девяти прямоугольников. Если места мало, края уменьшаются пропорционально.
function P.parts(p, x, y, w, h)
    local floor, min = math.floor, math.min
    x, y, w, h = floor(x), floor(y), math.max(0, floor(w)), math.max(0, floor(h))
    local b, s = p.border, p.scale
    local sx, sy = { 0, b[1], p.width - b[3], p.width }, { 0, b[2], p.height - b[4], p.height }
    local fx = min(1, w / math.max(1, (b[1] + b[3]) * s))
    local fy = min(1, h / math.max(1, (b[2] + b[4]) * s))
    local dx = { x, x + floor(b[1] * s * fx), x + w - floor(b[3] * s * fx), x + w }
    local dy = { y, y + floor(b[2] * s * fy), y + h - floor(b[4] * s * fy), y + h }
    local out = {}
    for row = 1, 3 do
        for col = 1, 3 do
            local center = row == 2 and col == 2
            local sw, sh = sx[col + 1] - sx[col], sy[row + 1] - sy[row]
            local dw, dh = dx[col + 1] - dx[col], dy[row + 1] - dy[row]
            if sw > 0 and sh > 0 and dw > 0 and dh > 0 and not (center and p.center == "none") then
                local mode = center and p.center or p.edges
                out[#out + 1] = {
                    x = dx[col],
                    y = dy[row],
                    w = dw,
                    h = dh,
                    sx = sx[col],
                    sy = sy[row],
                    sw = sw,
                    sh = sh,
                    index = (row - 1) * 3 + col,
                    repeat_x = col == 2 and mode == "tile",
                    repeat_y = row == 2 and mode == "tile",
                    scale = s,
                }
            end
        end
    end
    return out
end
return P
