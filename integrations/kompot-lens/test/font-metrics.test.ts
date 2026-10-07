import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {runHost, Session, findLua} from '../src/host';

const CONTENT = process.env.KOMPOT_CONTENT || path.resolve(__dirname, '../../../game/content');
const skip = !findLua() || !fs.existsSync(path.join(CONTENT, 'kompot', 'package.json'));

// Different glyph widths change layout, wrapping and button hit areas together.
const source = `local K = require "kompot:kompot"
local UI = require "kompot:ui"
K.preview("fonts", {width=240, height=160}, function()
    local count = K.state(0)
    K.Column(function()
        UI.Button({text="Wi " .. count.value, on_click=function() count.value=count:peek()+1 end})
        K.Text("WiWi", {font="kompot_16", modifier=K.M:width(24)})
    end)
end)`;
const initial = {kompot_16: {lh: 20, 65: 11, 103: 9, 87: 15, 105: 4, 32: 4, 48: 10}};
const override = [{module: 'kompot:font_test', file: path.join(CONTENT, 'kompot/modules/font_test.lua'), text: source}];

test('TTF glyph measurements drive button sizing and request hidden/wrapped characters', {skip}, async () => {
    const before = await runHost('render', CONTENT, ['kompot:font_test'], [], override, {sandbox: false});
    const req = before.previews[0].font_requests.find((r: any) => r.font === 'kompot_16');
    assert.ok(req.codepoints.includes(87) && req.codepoints.includes(105));
    assert.equal(req.file, 'kompot/fonts/IBMPlexSans-Regular.ttf');
    const result = await runHost('render', CONTENT, ['kompot:font_test'], [], override,
        {sandbox: false, fontMetrics: initial});
    const doc = result.previews[0];
    assert.deepEqual(doc.font_requests, []);
    const label = doc.prims.find((p: any) => p.text === 'Wi 0');
    assert.deepEqual(label.advances, [15, 4, 4, 10]);
    assert.equal(label.font_metrics, 'measured');
    assert.equal(doc.prims.find((p: any) => p.kind === 'nine_patch').w, 33 + 28);
    assert.equal(doc.prims.filter((p: any) => p.text === 'Wi').length, 2, 'wrap uses actual glyph widths');
});

test('new glyph metrics relayout interactive preview without resetting state or earlier widths', {skip}, async () => {
    const session = new Session(CONTENT, ['kompot:font_test'], 'fonts', override,
        {sandbox: false, fontMetrics: initial});
    const queue: any[] = [];
    let waiting: ((doc: any) => void) | undefined;
    session.onDocument = doc => {
        if (waiting) { const cb = waiting; waiting = undefined; cb(doc); }
        else queue.push(doc);
    };
    const next = () => new Promise<any>((resolve, reject) => {
        if (queue.length) return resolve(queue.shift());
        const timer = setTimeout(() => reject(new Error('font frame timeout')), 5000);
        waiting = doc => { clearTimeout(timer); resolve(doc); };
    });
    try {
        await next();
        session.frame(0, 30, 30, true, false, 0); await next();
        session.frame(0, 30, 30, false, false, 0);
        const clicked = await next();
        assert.ok(clicked.prims.some((p: any) => p.text === 'Wi 1'));
        assert.ok(clicked.font_requests.some((r: any) => r.codepoints.includes(49)));
        session.metrics({kompot_16: {lh: 20, 49: 6}});
        session.frame(0, -1, -1, false, false, 0);
        const measured = await next();
        const label = measured.prims.find((p: any) => p.text === 'Wi 1');
        assert.deepEqual(label.advances, [15, 4, 4, 6], 'earlier metrics retained');
        assert.deepEqual(measured.font_requests, []);
        assert.equal(measured.prims.find((p: any) => p.kind === 'nine_patch').w, 29 + 28);
    } finally { session.dispose(); }
});

test('background after padding covers the inner text when the preview has enough height', {skip}, async () => {
    const body = `local K = require "kompot:kompot"
local UI = require "kompot:ui"
local M = K.M
K.preview("order", {width=360,height=HEIGHT,theme=UI.theme}, function()
    K.Column({modifier=M:fill_max_width(),spacing=12}, function()
        K.Text("background -> padding")
        K.Box({modifier=M:background("#386F94"):padding(20)}, function() K.Text("Внутренний отступ") end)
        K.Text("padding -> background")
        K.Box({modifier=M:padding(20):background("#386F94")}, function() K.Text("Внешний отступ") end)
    end)
end)`;
    const metrics: any = {kompot_16: {lh:24}};
    for (const ch of Array.from(body)) metrics.kompot_16[ch.codePointAt(0)!] = ch === ' ' ? 8 : 9;
    for (const height of [200, 260]) {
        const result = await runHost('render', CONTENT, ['kompot:order_check'], ['order'], [{
            module:'kompot:order_check', file:path.join(CONTENT, 'kompot/modules/order_check.lua'),
            text:body.replace('HEIGHT', String(height)),
        }], {sandbox:false, fontMetrics:metrics});
        const doc = result.previews[0];
        const backgrounds = doc.prims.filter((p: any) => p.kind === 'rect' && p.color === '#386F94FF');
        assert.equal(backgrounds.length, 2);
        const first = doc.prims.find((p: any) => p.text === 'Внутренний отступ');
        const second = doc.prims.find((p: any) => p.text === 'Внешний отступ');
        assert.equal(backgrounds[0].h, 64);
        assert.equal(first.y - backgrounds[0].y, 20);
        assert.equal(first.x - backgrounds[0].x, 20);
        assert.equal(backgrounds[1].x, second.x);
        assert.equal(backgrounds[1].y, second.y);
        assert.equal(backgrounds[1].h, height === 260 ? 24 : 0);
        if (height === 260) assert.equal(backgrounds[1].w, second.w);
    }
});

test('Lua previews request the theme Mono TTF instead of engine bitmap resources', {skip}, async () => {
    const text=`local K = require "kompot:kompot"
local UI = require "kompot:ui"
K.preview("lua_mono", {width=400, height=250, theme=UI.theme}, function()
    K.Column(function()
        UI.Lua({code="local привет = 42", lines=2})
        K.BasicTextField({value="return привет", syntax="lua", lines=2})
    end)
end)`;
    const result=await runHost('render',CONTENT,['kompot:lua_mono_test'],[],[{
        module:'kompot:lua_mono_test',file:path.join(CONTENT,'kompot/modules/lua_mono_test.lua'),text,
    }],{sandbox:false});
    assert.ok(result.ok,result.error);
    const doc=result.previews[0];
    assert.equal(doc.error,null);
    const fields=doc.prims.filter((p:any)=>p.kind==='field');
    assert.equal(fields.length,2);
    for(const field of fields) {
        assert.equal(field.font,'kompot_mono_16');
        assert.equal(field.font_size,16);
        assert.equal(field.font_file,'kompot/fonts/IBMPlexMono-Regular.ttf');
        assert.notEqual(field.font_kind,'bitmap');
    }
    assert.ok(doc.font_requests.some((r:any)=>r.file==='kompot/fonts/IBMPlexMono-Regular.ttf'));
    assert.ok(!doc.font_requests.some((r:any)=>r.file.startsWith('@engine/')));
});
