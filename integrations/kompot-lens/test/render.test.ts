// Отрисовщик превью на поддельном контексте: порядок, обрезка, текст по ширинам движка.
import {test} from 'node:test';
import * as assert from 'node:assert/strict';
const R = require('../media/render');

function fakeCtx() {
    const calls: any[] = [];
    const ctx: any = new Proxy({}, {
        get(target: any, key: string) {
            if (key === 'calls') return calls;
            if (key in target) return target[key];
            if (key === 'measureText') return () => ({fontBoundingBoxAscent: 13.6, fontBoundingBoxDescent: 3.4});
            return (...args: any[]) => { calls.push([key, ...args]); };
        },
        set(target: any, key: string, value: any) {
            target[key] = value;
            calls.push(['set ' + key, value]);
            return true;
        },
    });
    return ctx;
}

test('colors from #RRGGBBAA', () => {
    assert.equal(R.rgba('#FF800080'), 'rgba(255,128,0,0.502)');
    assert.equal(R.rgba('#12171DFF', 0.5), 'rgba(18,23,29,0.5)');
});

test('multiline fields display every line and native line numbers', () => {
    const ctx = fakeCtx();
    const doc = {width: 300, height: 100, prims: [{kind: 'field', key: 'f', clip: '',
        x: 0, y: 0, w: 300, h: 100, text: 'local a = 1\nreturn a', lines: 2,
        line_numbers: true, line_height: 24, pad: 7, font_size: 14, color: '#FFFFFFFF'}]};
    R.render(ctx, doc, 1, {fontFamily: () => 'monospace'});
    const calls = ctx.calls.filter((c: any[]) => c[0] === 'fillText');
    assert.deepEqual(calls.map((c: any[]) => c[1]), ['1', 'local a = 1', '2', 'return a']);
    assert.equal(calls[3][3] - calls[1][3], 24);
});

test('text is placed by engine advances', () => {
    const ctx = fakeCtx();
    const doc = {width: 100, height: 40, background: '#000000FF', prims: [
        {kind: 'text', key: 't', clip: '', x: 10, y: 5, w: 30, h: 18, text: 'Ab', color: '#FFFFFFFF',
            font: 'kompot_14', font_file: 'kompot/fonts/Inter-Regular.ttf', font_size: 14, advances: [9, 8]},
    ]};
    R.render(ctx, doc, 1, {fontFamily: () => '"f"'});
    const texts = ctx.calls.filter((c: any[]) => c[0] === 'fillText');
    assert.deepEqual(texts.map((c: any[]) => [c[1], c[2]]), [['A', 10], ['b', 19]]);
    // Font baseline = floor(y + (h - (size + size/2))/2) + size.
    assert.equal(texts[0][3], 17);
});

test('clip regions nest and offset children', () => {
    const ctx = fakeCtx();
    const doc = {width: 200, height: 100, prims: [
        {kind: 'clip', key: 'c1', clip: '', x: 20, y: 10, w: 100, h: 50},
        {kind: 'rect', key: 'r', clip: 'c1', x: 5, y: 5, w: 400, h: 10, color: '#FF0000FF', radius: 0},
    ]};
    R.render(ctx, doc, 2, {});
    const clipRect = ctx.calls.filter((c: any[]) => c[0] === 'rect');
    // обрезка по c1 (20,10 100x50), прямоугольник смещён на начало c1
    assert.deepEqual(clipRect[0].slice(1), [20, 10, 100, 50]);
    assert.deepEqual(clipRect[1].slice(1), [25, 15, 400, 10]);
    assert.deepEqual(ctx.calls.find((c: any[]) => c[0] === 'scale').slice(1), [2, 2]);
});

test('resources of a document', () => {
    const r = R.resources({prims: [
        {kind: 'text', font_file: 'a.ttf'}, {kind: 'text', font_file: 'a.ttf'},
        {kind: 'image', src: 'kompot_ui_icons:add'}, {kind: 'nine_patch', src: 'kompot_ui_skin:panel'},
    ]});
    assert.deepEqual(r, {fonts: ['a.ttf'], images: ['kompot_ui_icons:add', 'kompot_ui_skin:panel']});
});

test('canvas refreshes when only middle pixels or its dimensions change', () => {
    const writes: {width: number; height: number; data: Uint8ClampedArray}[] = [];
    const res = {createCanvas: (width: number, height: number) => ({getContext: () => ({
        createImageData: (w: number, h: number) => ({data: new Uint8ClampedArray(w * h * 4)}),
        putImageData: (image: any) => writes.push({width, height, data: image.data}),
    })})};
    const bytes = Buffer.alloc(32 * 4 * 4);
    const primitive = {kind: 'canvas', key: 'moving_canvas', clip: '', x: 0, y: 0,
        w: 32, h: 4, pixels: bytes.toString('base64')};
    const doc = {width: 32, height: 8, prims: [primitive]};
    R.render(fakeCtx(), doc, 1, res);
    bytes[200] = 255;
    primitive.pixels = bytes.toString('base64');
    R.render(fakeCtx(), doc, 1, res);
    assert.equal(writes.length, 2, 'middle change must invalidate the cached canvas');
    assert.equal(writes[1].data[200], 255);
    primitive.w = 16;
    primitive.h = 8;
    R.render(fakeCtx(), doc, 1, res);
    assert.equal(writes.length, 3, 'same pixels with another shape need another canvas');
    assert.deepEqual([writes[2].width, writes[2].height], [16, 8]);
});

test('nine-patch tiles the center, preserves corners and applies tint', () => {
    const source = Buffer.alloc(3 * 3 * 4);
    for (let i = 0; i < 9; i++) {
        source[i * 4] = (i + 1) * 20;
        source[i * 4 + 3] = 255;
    }
    let output: Uint8ClampedArray | undefined;
    const res = {createCanvas: () => ({getContext: () => ({
        createImageData: (w: number, h: number) => ({data: new Uint8ClampedArray(w * h * 4)}),
        putImageData: (image: any) => { output = image.data; },
    })})};
    const doc = {width: 5, height: 5, prims: [{kind: 'nine_patch', key: 'skin', clip: '',
        x: 0, y: 0, w: 5, h: 5, source_size: [3, 3], border: [1, 1, 1, 1],
        scale: 1, center: 'tile', edges: 'tile', source_pixels: source.toString('base64'), color: '#80FFFFFF'}]};
    R.render(fakeCtx(), doc, 1, res);
    assert.ok(output);
    const red = (x: number, y: number) => output![(y * 5 + x) * 4];
    assert.equal(red(0, 0), 10);
    assert.equal(red(4, 0), 30);
    assert.equal(red(2, 2), 50);
    assert.equal(red(4, 4), 90);
    doc.prims[0].center = 'none';
    R.render(fakeCtx(), doc, 1, res);
    assert.equal(output![(2 * 5 + 2) * 4 + 3], 0);
});

test('nine-patch uses the loaded PNG and refreshes when its URI changes', () => {
    const source = new Uint8ClampedArray(3 * 3 * 4).fill(255);
    const output: Uint8ClampedArray[] = [];
    const image = {src: 'panel.png?v=1'};
    const res = {image: () => image, createCanvas: () => ({getContext: () => ({
        drawImage: () => {},
        getImageData: () => ({data: source}),
        createImageData: (w: number, h: number) => ({data: new Uint8ClampedArray(w * h * 4)}),
        putImageData: (value: any) => output.push(value.data),
    })})};
    const doc = {width: 5, height: 5, prims: [{kind: 'nine_patch', key: 'skin', clip: '',
        x: 0, y: 0, w: 5, h: 5, src: 'kompot_ui_skin:panel', source_size: [3, 3],
        border: [1, 1, 1, 1], scale: 1, center: 'stretch', edges: 'stretch', color: '#FFFFFFFF'}]};
    R.render(fakeCtx(), doc, 1, res);
    assert.equal(output.length, 1);
    assert.equal(output[0][(2 * 5 + 2) * 4 + 3], 255);
    image.src = 'panel.png?v=2';
    R.render(fakeCtx(), doc, 1, res);
    assert.equal(output.length, 2);
});

test('image region uses bottom-origin UVs and reloads tinted cache with a new image URI', () => {
    const image = {src: 'first.png', naturalWidth: 100, naturalHeight: 80};
    const layers: any[] = [];
    const res = {image: () => image, createCanvas: () => {
        const c = fakeCtx();
        layers.push(c);
        return {getContext: () => c};
    }};
    const doc = {width: 60, height: 40, prims: [
        {kind: 'image', key: 'i', clip: '', src: 'atlas:a', x: 0, y: 0, w: 60, h: 40,
            color: '#FFFFFFFF', region: [0.25, 0.5, 0.75, 1]},
    ]};
    R.render(fakeCtx(), doc, 1, res);
    assert.deepEqual(layers[0].calls.find((c: any[]) => c[0] === 'drawImage').slice(2), [25, 0, 50, 40, 0, 0, 60, 40]);
    image.src = 'second.png';
    R.render(fakeCtx(), doc, 1, res);
    assert.equal(layers.length, 2, 'changed URI creates a fresh tinted image');
    doc.prims[0].region = [0, 1, 1, 0];
    R.render(fakeCtx(), doc, 1, res);
    assert.ok(layers[2].calls.some((c: any[]) => c[0] === 'scale' && c[1] === 1 && c[2] === -1));
});

test('missing image is visible in the preview', () => {
    const ctx = fakeCtx();
    R.render(ctx, {width: 20, height: 20, prims: [
        {kind: 'image', key: 'i', clip: '', src: 'missing', x: 1, y: 2, w: 10, h: 8},
    ]}, 1, {image: () => null});
    assert.ok(ctx.calls.some((c: any[]) => c[0] === 'fillRect' && c[1] === 1 && c[2] === 2 && c[3] === 10));
});

test('approximate advances do not impose monospace spacing on proportional TTF', () => {
    const ctx = fakeCtx();
    R.render(ctx, {width: 100, height: 40, prims: [{kind: 'text', x: 10, y: 0, w: 50, h: 20,
        text: 'Wi', font_size: 16, color: '#FFFFFFFF', advances: [9, 9], font_metrics: 'approximate'}]},
        1, {fontFamily: () => 'sans-serif'});
    assert.deepEqual(ctx.calls.filter((c: any[]) => c[0] === 'fillText').map((c: any[]) => c[1]), ['Wi']);
});


test('VoxelCore label heights and whitespace follow engine rules instead of browser font bounds', () => {
    assert.equal(R.engineLineHeight(16), 24);
    assert.equal(R.engineLineHeight(13), 19);
    assert.equal(R.engineLineHeight(32), 48);
    const ctx = {measureText: (ch: string) => ({width: ch === 'W' ? 15.3 : 4.1})};
    for (const ch of [' ', '\t', '\n', '\f', '\r']) assert.equal(R.engineAdvance(ctx, 16, ch), 8);
    assert.equal(R.engineAdvance(ctx, 16, 'W'), 15);
    assert.equal(R.engineAdvance(ctx, 16, 'i'), 4);
    assert.equal(R.engineAdvance({measureText: () => ({width:4, actualBoundingBoxLeft:0,
        actualBoundingBoxRight:0, actualBoundingBoxAscent:0, actualBoundingBoxDescent:0})}, 16, '\u00a0'), 8);
});

test('FreeType drawing uses glyph advances independently of native layout widths', () => {
    const ctx = fakeCtx();ctx.globalAlpha=1;
    const image = {};
    R.render(ctx,{width:100,height:40,prims:[{kind:'text',x:10,y:5,w:16,h:24,text:'AB',font_size:16,
        font_file:'player/Custom.ttf',color:'#FFFFFFFF',font_metrics:'measured',advances:[8,8]}]},1,{
        fontGlyph:()=>({image,left:-1,top:12,advance:10,alpha:1}),
    });
    assert.deepEqual(ctx.calls.filter((c:any[])=>c[0]==='drawImage').map((c:any[])=>c.slice(2)),[[9,9],[19,9]]);
    assert.equal(ctx.calls.filter((c:any[])=>c[0]==='fillText').length,0);
});
