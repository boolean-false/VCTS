-- Общая геометрия фона, рамки, тени и маски. Порядок: TL, TR, BR, BL.
local Shape = require "kompot:kompot/core/shape"
local C = {}
local names = { "top_left", "top_right", "bottom_right", "bottom_left" }
local min, max, sqrt = math.min, math.max, math.sqrt

local function radius(v)
    assert(type(v) == "number" and v == v and v >= 0, "corner radius must be a non-negative number")
    return v
end

function C.of(value)
    if value == nil then return 0 end
    if Shape.is(value) then return Shape.copy(value) end
    if type(value) == "number" then return radius(value) end
    assert(type(value) == "table", "radius expects a number or corner table")
    local out = {}
    for k in pairs(value) do
        local known = false
        for _, name in ipairs(names) do if k == name then known = true end end
        assert(known, "unknown corner: " .. tostring(k))
    end
    for _, name in ipairs(names) do out[name] = radius(value[name] == nil and 0 or value[name]) end
    return out
end

function C.resolve(value, w, h)
    w, h = max(0, w), max(0, h)
    if Shape.is(value) then value = Shape.resolve(value,w,h) end
    if type(value) ~= "table" then return min(value or 0, w / 2, h / 2) end
    local r = {kind = value.kind}
    for _, name in ipairs(names) do
        local v = value[name] or 0
        r[name] = v == math.huge and min(w, h) / 2 or v
    end
    local a,b,c,d = r.top_left,r.top_right,r.bottom_right,r.bottom_left
    local scale = 1
    for _, pair in ipairs({{w,a+b},{w,d+c},{h,a+d},{h,b+c}}) do
        if pair[2] > 0 then scale = min(scale, pair[1] / pair[2]) end
    end
    for _, name in ipairs(names) do r[name] = r[name] * scale end
    return r
end

function C.values(value)
    if type(value) ~= "table" then return {value or 0,value or 0,value or 0,value or 0} end
    return {value.top_left or 0,value.top_right or 0,value.bottom_right or 0,value.bottom_left or 0,kind=value.kind}
end

function C.any(value)
    for _, v in ipairs(C.values(value)) do if v > 0 then return true end end
    return false
end

-- Signed distance to the boundary in corner squares; straight sides elsewhere.
function C.distance(x,y,w,h,r)
    local a,b,c,d = r[1],r[2],r[3],r[4]
    local distance = min(x,y,w-x,h-y)
    if r.kind == "cut" then
        return min(distance,(x+y-a)/sqrt(2),(w-x+y-b)/sqrt(2),
            (w-x+h-y-c)/sqrt(2),(x+h-y-d)/sqrt(2))
    end
    if a>0 and x<a and y<a then distance=min(distance,a-sqrt((x-a)^2+(y-a)^2)) end
    if b>0 and x>w-b and y<b then distance=min(distance,b-sqrt((x-w+b)^2+(y-b)^2)) end
    if c>0 and x>w-c and y>h-c then distance=min(distance,c-sqrt((x-w+c)^2+(y-h+c)^2)) end
    if d>0 and x<d and y>h-d then distance=min(distance,d-sqrt((x-d)^2+(y-h+d)^2)) end
    return distance
end

function C.contains(x,y,w,h,value)
    return x>=0 and y>=0 and x<w and y<h and C.distance(x,y,w,h,C.values(value))>=0
end

-- White RGBA coverage, tinted by the backend. Border is outer minus inner mask.
function C.pixels(w,h,value,border,blur)
    blur = max(0, math.floor((blur or 0)+0.5))
    local iw,ih = max(0,w-2*blur),max(0,h-2*blur)
    local r = C.values(C.resolve(value,iw,ih))
    if type(value) ~= "table" then
        for i,v in ipairs(r) do r[i] = min(math.floor(v+0.5),math.floor(iw/2),math.floor(ih/2)) end
    end
    local inner = {kind=r.kind}
    border = border and max(0,math.floor(border+0.5))
    for i,v in ipairs(r) do inner[i] = max(0,v-(border or 0)*(r.kind == "cut" and (2-sqrt(2)) or 1)) end
    local alpha = {}
    local function coverage(d) return max(0,min(1,d+0.5)) end
    for y=0,h-1 do for x=0,w-1 do
        local px,py=x+0.5-blur,y+0.5-blur
        local a=coverage(C.distance(px,py,iw,ih,r))
        if border then
            local inside = 0
            if iw>2*border and ih>2*border then
                inside=coverage(C.distance(px-border,py-border,iw-2*border,ih-2*border,inner))
            end
            a=max(0,a-inside)
        end
        alpha[y*w+x+1]=a
    end end
    if blur>0 then
        local kernel,sum={},0
        for i=-blur,blur do local v=math.exp(-i*i/(2*(blur/2)^2));kernel[i]=v;sum=sum+v end
        for i=-blur,blur do kernel[i]=kernel[i]/sum end
        for _,horizontal in ipairs({true,false}) do
            local next_alpha={}
            for y=0,h-1 do for x=0,w-1 do
                local a=0
                for i=-blur,blur do
                    local xx,yy=x+(horizontal and i or 0),y+(horizontal and 0 or i)
                    if xx>=0 and xx<w and yy>=0 and yy<h then a=a+alpha[yy*w+xx+1]*kernel[i] end
                end
                next_alpha[y*w+x+1]=a
            end end
            alpha=next_alpha
        end
    end
    local data={}
    for i,a in ipairs(alpha) do
        local j=(i-1)*4+1
        data[j],data[j+1],data[j+2],data[j+3]=255,255,255,math.floor(a*255+0.5)
    end
    return data
end

return C
