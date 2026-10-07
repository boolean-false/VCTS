import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import * as path from 'node:path';
const R=require('../media/render');
const corners={top_left:20,top_right:8,bottom_right:0,bottom_left:12};
function canvas(w:number,h:number):any {
    const c:any={width:w,height:h,data:new Uint8ClampedArray(w*h*4)};
    c.getContext=()=>({
        createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
        putImageData:(image:any)=>c.data.set(image.data),
    });return c;
}
const res={createCanvas:canvas};
const alpha=(c:any,x:number,y:number)=>c.data[(y*c.width+x)*4+3];
test('corner geometry scales adjacent radii and intersects opposite large arcs',()=>{
    assert.deepEqual(R.cornerValues({top_left:80,top_right:40,bottom_left:20},60,100),[40,20,0,10]);
    assert.deepEqual(R.cornerValues(100,80,60),[30,30,30,30]);
    assert.ok(R.cornerDistance(90,90,100,100,[100,0,100,0])<0);
    assert.ok(R.cornerDistance(50,50,100,100,[100,0,100,0])>0);
});
test('native raster preserves independent corners and border interiors',()=>{
    const p={kind:'rect',w:80,h:60,radius:corners,color:'#FFFFFF80'};
    const fill=R.nativeShape(res,p);
    assert.equal(alpha(fill,0,0),0);
    assert.equal(alpha(fill,79,59),128);
    const border=R.nativeShape(res,{...p,kind:'border',width:8});
    assert.equal(alpha(border,40,30),0);
    assert.equal(alpha(border,20,0),128);
    assert.equal(alpha(border,79,59),128);
    const zero=R.nativeShape(res,{...p,kind:'border',width:0});
    assert.ok([...zero.data].every((v,i)=>i%4!==3 || v===0));
});
test('game and plugin produce the same asymmetric coverage pixels',()=>{
    const content=process.env.KOMPOT_CONTENT || path.resolve(__dirname,'../../../game/content');
    const script=`package.preload['kompot:kompot/core/shape']=function() return assert(loadfile(arg[1]..'/kompot/modules/kompot/core/shape.lua'))() end
local path=arg[1]..'/kompot/modules/kompot/core/corners.lua'
local C=assert(loadfile(path))()
for _,width in ipairs({-1,0,2,12,100}) do
 local data=C.pixels(41,31,{top_left=24,top_right=7,bottom_right=0,bottom_left=11},width>=0 and width or nil)
 for i=4,#data,4 do io.write(data[i],',') end
 io.write('\\n')
end`;
    const result=spawnSync('lua',['-',content],{input:script,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    result.stdout.trim().split('\n').forEach((line,index)=>{
        const width=[-1,0,2,12,100][index];
        const shape=R.nativeShape(res,{kind:width<0?'rect':'border',width,w:41,h:31,
            radius:{top_left:24,top_right:7,bottom_right:0,bottom_left:11},color:'#FFFFFFFF'});
        const expected=line.split(',').filter(Boolean).map(Number);
        assert.deepEqual([...shape.data].filter((_,i)=>i%4===3),expected);
    });
});

test('cut fills, perpendicular borders and shadows match Lua pixel for pixel',()=>{
    const content=process.env.KOMPOT_CONTENT || path.resolve(__dirname,'../../../game/content');
    const script=`package.preload['kompot:kompot/core/shape']=function() return assert(loadfile(arg[1]..'/kompot/modules/kompot/core/shape.lua'))() end
local C=assert(loadfile(arg[1]..'/kompot/modules/kompot/core/corners.lua'))()
for _,case in ipairs({{-1,0},{0,0},{4,0},{15,0},{100,0},{-1,4}}) do
 local data=C.pixels(41,31,{kind='cut',top_left=24,top_right=7,bottom_right=0,bottom_left=11},case[1]>=0 and case[1] or nil,case[2])
 for i=4,#data,4 do io.write(data[i],',') end
 io.write('\\n')
end`;
    const result=spawnSync('lua',['-',content],{input:script,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    result.stdout.trim().split('\n').forEach((line,index)=>{
        const [width,blur]=[[-1,0],[0,0],[4,0],[15,0],[100,0],[-1,4]][index];
        const image=R.nativeShape(res,{kind:blur?'shadow':width<0?'rect':'border',width,blur,w:41,h:31,
            shape:{kind:'cut',top_left:24,top_right:7,bottom_right:0,bottom_left:11},color:'#FFFFFFFF'});
        assert.deepEqual([...image.data].filter((_,i)=>i%4===3),line.split(',').filter(Boolean).map(Number));
    });
});

test('vector fallback keeps cut border thickness perpendicular to its diagonal',()=>{
    const calls:any[]=[];
    const ctx=new Proxy({}, {get:(_,key)=> (...args:any[])=>calls.push([key,...args]),set:()=>true});
    R.render(ctx,{width:100,height:80,prims:[{kind:'border',clip:'',x:0,y:0,w:80,h:60,width:4,
        color:'#FFFFFFFF',shape:{kind:'cut',top_left:20,top_right:0,bottom_right:0,bottom_left:0}}]},1,{});
    const start=calls.find(c=>c[0]==='moveTo');
    assert.ok(Math.abs((start[1]+start[2]-20)/Math.SQRT2-2)<1e-9);
    assert.ok(calls.some(c=>c[0]==='stroke'));
});
