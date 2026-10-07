import {test} from 'node:test';
import * as assert from 'node:assert/strict';
const R=require('../media/render');
test('Canvas samples rotation at pixel centers and composites straight alpha',()=>{
 const source=new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,128]);
 const target=new Uint8ClampedArray(4*4*4);
 R.composite(target,4,4,source,2,2,2,2,[0,1,-1,0,3,1]);
 assert.deepEqual([...target.slice((1*4+1)*4,(1*4+1)*4+4)],[0,0,255,255]);
 assert.deepEqual([...target.slice((1*4+2)*4,(1*4+2)*4+4)],[255,0,0,255]);
 const blend=new Uint8ClampedArray([100,100,100,255]);
 R.composite(blend,1,1,source,2,2,1,1,[1,0,0,1,0,0],{alpha:0.5,region:[0,0.5,0.5,1]});
 assert.deepEqual([...blend],[178,50,50,255]);
 const zero=new Uint8ClampedArray(4);R.composite(zero,1,1,source,2,2,1,1,[0,0,0,0,0,0]);
 assert.deepEqual([...zero],[0,0,0,0]);
});
test('Canvas commands preserve overwrite, clear and native inclusive rectangles',()=>{
 const pixels=R.commandPixels({},3,3,[{op:'clear',args:[10,20,30,255]},
  {op:'rect',args:[0,0,1,1,100,110,120,128]},{op:'set',args:[0,0,0xFF030201]}]);
 assert.deepEqual([...pixels.slice(0,4)],[1,2,3,255]);
 assert.deepEqual([...pixels.slice(16,20)],[100,110,120,128]);
 assert.deepEqual([...pixels.slice(32,36)],[10,20,30,255]);
});
test('resources include nested transform layers and recursive Canvas sources',()=>{
 const doc={prims:[{kind:'layer',prims:[{kind:'text',font_file:'font.ttf'},
  {kind:'canvas',commands:[{op:'image',src:'pack:png'},{op:'image',source:{commands:[{op:'image',src:'atlas:icon'}]}}]}]}]};
 assert.deepEqual(R.resources(doc),{fonts:['font.ttf'],images:['pack:png','atlas:icon']});
 assert.equal(R.primitives(doc).length,3);
});
