app.config_packs({"kompot"})
app.new_world("kompot_paint_pixels", "1", "core:default")
local Paint = require "kompot:kompot/core/paint"
local Cache = require "kompot:kompot/backend/paint_cache"
local canvases = {}
local function canvas(size)
    local cv = Canvas(size)
    local wrapper = {native=cv,width=size[1],height=size[2]}
    function wrapper:clear(...) cv:clear(...) end
    function wrapper:rect(...) cv:rect(...) end
    function wrapper:blit(src,x,y) cv:blit(src.native,x,y) end
    function wrapper:create_texture(name) canvases[name]=cv end
    return wrapper
end
local source=Paint.raster({width=16,height=16,draw=function(cv)
    cv:clear(50,65,50,255)
    cv:rect(0,0,16,2,100,120,85,255)
    cv:rect(0,2,2,12,100,120,85,255)
    cv:rect(0,14,16,2,20,30,20,255)
    cv:rect(14,2,2,12,20,30,20,255)
    cv:rect(4,4,2,2,65,80,60,255)
end})
local r=Cache.new({canvas=canvas}):acquire(Paint.nine_patch(source,{border=2,center="tile",scale=2}))
local Preview = require "kompot:kompot/preview"
local passed, failed = 0, 0
local function test(name, fn)
    local ok, err = xpcall(fn, debug.traceback)
    if ok then passed=passed+1 else failed=failed+1; print("FAIL " .. name .. ": " .. err) end
end
local function equal(native, soft)
    local data, bytes = native:get_data(), soft:bytes()
    for i=1,#bytes do
        assert(data[i] == bytes:byte(i), "pixel channel " .. i .. ": " .. data[i] .. " vs " .. bytes:byte(i))
    end
end

test("raster source has identical pixels in engine and preview", function()
    local native = canvas({16,16})
    source.draw(native)
    local soft = Preview.soft_canvas(16,16)
    source.draw(soft)
    equal(native.native,soft)
end)
test("rect endpoints, fractional arguments and clipping match native Canvas", function()
    for _, rect in ipairs({{2,3,0,0},{2,3,2,1},{-2,-1,4,4},{10,10,2,2},
        {-8,-8,2,2},{1.7,2.4,2.6,3.2},{-1.7,-2.4,4.6,4.2},{4,4,-2,-2}}) do
        local native, soft = Canvas({8,8}), Preview.soft_canvas(8,8)
        native:clear(1,2,3,255); soft:clear(1,2,3,255)
        native:rect(unpack({rect[1],rect[2],rect[3],rect[4],40,60,80,255}))
        soft:rect(unpack({rect[1],rect[2],rect[3],rect[4],40,60,80,255}))
        equal(native,soft)
    end
end)
test("repeated center contains the border pixel visible in the game", function()
    local c=canvases[r.cells[5].name]
    assert(c.width==12 and c.height==12)
    local data=c:get_data()
    for x=0,11 do assert(data[x*4+1]==100) end
end)
test("antialiased native RGBA buffers match the software compositor", function()
    local C=require "kompot:kompot/core/canvas"
    local source,soft_source=Canvas({8,8}),Preview.soft_canvas(8,8)
    source:clear(20,40,255,0);soft_source:clear(20,40,255,0)
    for y=0,7 do for x=0,7 do
        if x%3~=0 then
            local r,g,b,a=x*30,y*30,120,(x+y)%2==0 and 128 or 255
            source:set(x,y,r,g,b,a);soft_source:set(x,y,r,g,b,a)
        end
    end end
    for _,angle in ipairs({0.5,27,90,-33}) do
        for _,top in ipairs({true,false}) do
            local native,soft=Canvas({24,24}),Preview.soft_canvas(24,24)
            native:clear(40,70,90,100);soft:clear(40,70,90,100)
            local m=C.image_matrix({x=8,y=8,angle=angle,scale={-1.2,0.8}},8,8)
            local opts={alpha=0.7,color={0.5,1,0.8,1},region={0.1,0.2,0.9,1}}
            C.composite(native,24,24,source,8,8,m,opts,top)
            C.composite(soft,24,24,soft_source,8,8,m,opts,top)
            equal(native,soft)
            -- Повторный проход сохраняет и правильно смешивает содержимое dst.
            m[5]=m[5]+1.5
            C.composite(native,24,24,source,8,8,m,opts,top)
            C.composite(soft,24,24,soft_source,8,8,m,opts,top)
            equal(native,soft)
        end
    end
end)
print(string.format("passed: %d, failed: %d",passed,failed))
app.close_world(false)
app.delete_world("kompot_paint_pixels")
