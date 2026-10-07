-- lua tests/standalone/animation_regressions.lua /path/to/content
local content = assert(arg[1])
unpack = unpack or table.unpack
local native, loaded = require, {}
function require(name)
    local pack, file = name:match("^([%w_%-]+):(.+)$")
    if not pack then return native(name) end
    if loaded[name] then return loaded[name] end
    loaded[name] = assert(loadfile(content .. "/" .. pack .. "/modules/" .. file .. ".lua"))() or true
    return loaded[name]
end
local K = require "kompot:kompot"
local UI = require "kompot:ui"
local Recorder = require "kompot:kompot/backend/recorder"
local failed = 0
local function test(name, fn)
    local ok, err = xpcall(fn, debug.traceback)
    print((ok and "PASS " or "FAIL ") .. name)
    if not ok then failed = failed + 1; print(err) end
end
local function frames(a) for _ = 1, 5 do a:frame(0) end end

test("slider retains the full range after repeated keyed resets", function()
    local generation = K.new_state(0)
    local received
    local a = K.App.new({width=620, height=240, measurer=Recorder.measurer(), content=function()
        K.Theme(UI.theme(), function()
            K.key(generation.value, function()
                K.Column({modifier=K.M:width(600)}, function()
                    UI.Slider({value=1,on_change=function(v) received=v end})
                    UI.Slider({value=1})
                end)
            end)
        end)
    end})
    local function check()
        frames(a)
        local full = 0
        for _, p in ipairs(a.dl) do
            if p.kind == "rect" and p.h == 4 and p.w == 600 then full = full + 1 end
        end
        assert(full == 4, "expected two full tracks and two full fills, got " .. full)
        received = nil
        a:frame(0, {x=598,y=10,down=false})
        a:frame(0, {x=598,y=10,down=true})
        a:frame(0, {x=598,y=10,down=false})
        assert(received and received > 0.99, "right end no longer maps to the maximum")
    end
    check()
    for i=1,3 do generation.value=i; check() end
    a:dispose()
end)

test("placement callbacks fire on remount, not ordinary recomposition", function()
    local generation, revision = K.new_state(0), K.new_state(0)
    local sizes, placements = 0, 0
    local a = K.App.new({width=300,height=200,measurer=Recorder.measurer(),content=function()
        local _ = revision.value
        K.key(generation.value, function()
            K.Box({modifier=K.M:size(80,40):on_size(function() sizes=sizes+1 end)
                :on_placed(function() placements=placements+1 end)})
        end)
    end})
    frames(a)
    assert(sizes==1 and placements==1)
    revision.value=1; frames(a)
    assert(sizes==1 and placements==1, "ordinary recomposition called placement callbacks")
    generation.value=1; frames(a)
    assert(sizes==2 and placements==2, "new keyed subtree missed initial placement")
    a:set_size(400,300); frames(a)
    assert(sizes==2 and placements==2, "unchanged child size called callbacks")
    a:dispose()
end)

local textures = {}
assets = {to_canvas=function(name) return textures[name] end}
Canvas = function()
    return {set_data=function() end, update=function() end,
        create_texture=function(self,name) textures[name]=self end}
end
local function upvalue(fn, target)
    for i=1,100 do
        local name, value = debug.getupvalue(fn,i)
        if not name then break end
        if name == target then return value end
    end
    error("missing upvalue " .. target)
end
local Backend = upvalue(require("kompot:kompot/backend/voxelcore").mount,"Backend")
local rounded = upvalue(Backend.apply,"rounded_parts")
local border = upvalue(Backend.apply,"border_parts")

test("animated rounded rectangles have no gaps in their solid bands", function()
    for i=0,240 do
        local x, y = 12+i*0.071, 100-i*0.233
        local w, h = 36+i*0.067, 20+i*0.313
        local parts = rounded({x=x,y=y,w=w,h=h,radius=6})
        local fx, fy, fw, fh = math.floor(x), math.floor(y), math.floor(w), math.floor(h)
        local occupied = {}
        for _, p in ipairs(parts) do
            local px,py,pw,ph = math.floor(p[1]), math.floor(p[2]), math.floor(p[3]), math.floor(p[4])
            for yy=py,py+ph-1 do for xx=px,px+pw-1 do occupied[yy*10000+xx]=true end end
        end
        for yy=fy,fy+fh-1 do for xx=fx,fx+fw-1 do
            if (xx>=fx+6 and xx<fx+fw-6) or (yy>=fy+6 and yy<fy+fh-6) then
                assert(occupied[yy*10000+xx], "gap at frame " .. i .. ": " .. xx .. "," .. yy)
            end
        end end
        local bp=border({x=x,y=y,w=w,h=h,radius=6,width=2})
        for _, p in ipairs(bp) do
            assert(p[1]==math.floor(p[1]) and p[2]==math.floor(p[2]), "fractional border position")
            assert(p[3]==math.floor(p[3]) and p[4]==math.floor(p[4]), "fractional border size")
        end
    end
end)
test("nine-patch tiling starts at the top for partial rows and both source orientations", function()
    local B = require "kompot:kompot/backend/voxelcore"
    local Paint = require "kompot:kompot/core/paint"
    for _, flip in ipairs({true,false}) do
        local src = flip and K.raster({width=16,height=16,draw=function() end,key="uv-test"}) or "test:png"
        local paint = K.nine_patch(src,{source_size={16,16},border=2,center="tile",scale=2})
        local resource = {key=Paint.key(paint),flip=flip,cells={}}
        for i=1,9 do resource.cells[i]={name="cell" .. i} end
        B._paint_cache.lookup[resource.key]=resource
        local parts
        local backend=setmetatable({_apply_parts=function(_,_,_,p) parts=p end},{__index=Backend})
        for _,h in ipairs({32,56,77,119,120,121,260}) do
            backend:_apply_patch({patch_resource=resource},{},{x=0,y=0,w=120,h=h,paint=paint},{})
            local center=parts[5]
            local region=center[7]
            local ry=(h-8)/24
            assert(region[4]==(flip and 0 or 1), "tile phase depends on destination height")
            assert(math.abs(region[2]-(flip and ry or 1-ry))<1e-9)
        end
        B._paint_cache.lookup[resource.key]=nil
    end
end)
assert(failed==0, failed .. " regression(s) failed")
