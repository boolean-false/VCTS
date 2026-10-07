import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {spawnSync} from 'node:child_process';

const luaLS = process.env.KOMPOT_LUALS || '';
const available = !!luaLS && fs.existsSync(luaLS);
const addon = path.resolve(__dirname, '../../luals/kompot');

function check(code: string): {status: number | null; output: string} {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kompot-luals-types-'));
    try {
        const root = path.join(temp, 'content');
        const modules = path.join(root, 'kompot', 'modules');
        fs.mkdirSync(modules, {recursive: true});
        fs.writeFileSync(path.join(root, 'kompot', 'package.json'), '{"id":"kompot"}');
        fs.writeFileSync(path.join(modules, 'kompot.lua'), 'local K = {}\n---@cast K +KompotApi\nreturn K\n');
        fs.writeFileSync(path.join(modules, 'ui.lua'), 'local UI = {}\n---@cast UI +KompotUiApi\nreturn UI\n');
        fs.writeFileSync(path.join(modules, 'probe.lua'), code);
        fs.writeFileSync(path.join(root, '.luarc.json'), JSON.stringify({
            'runtime.plugin': path.join(addon, 'plugin.lua'),
            'workspace.library': [path.join(addon, 'library')],
            'runtime.version': 'LuaJIT',
        }));
        const result = spawnSync(luaLS, [`--check=${root}`, '--check_format=pretty'], {encoding: 'utf8'});
        return {status: result.status, output: result.stdout + result.stderr};
    } finally {
        fs.rmSync(temp, {recursive: true, force: true});
    }
}

test('LuaLS accepts correct Kompot core and UI calls', {skip: !available && 'set KOMPOT_LUALS to LuaLS executable'}, () => {
    const result = check(`local K = require "kompot:kompot"
local UI = require "kompot:ui"
K.Column({spacing = 8, modifier = K.M:padding(4):offset(1, 2)}, function()
    K.Text("Hello", {color = "#FFFFFF"})
    UI.Button({text = "OK", enabled = true})
end)
local corners = K.rounded_corners({top_left = 24, top_right = 8, bottom_right = 0, bottom_left = 12})
K.Box({modifier = K.M:shadow(6, corners):background("#FFFFFF", corners):border(2, "#000000", corners):clip(corners)})
K.M:clip(12):clickable(function() end, {focus_radius = corners})
local shape = K.Shape.cut({top_left = K.Shape.percent(50), top_right = K.Shape.px(12)})
K.M:background("#FFFFFF", shape):border(2, "#FFFFFF", shape):shadow(8, shape):clip(shape)
K.M:clip(K.Shape.rectangle()):background("#FFFFFF", K.Shape.circle())
K.M:focusable(function() end, {focus_shape = K.Shape.rounded(K.Shape.percent(25))})
local skin = K.nine_patch("kompot_ui_skin:panel", {source_size = {72, 72}, border = 4, center = "tile"})
K.Box({modifier = K.M:background_image(skin)})
UI.theme({skin = {panel = "kompot_ui_skin:panel"}})
UI.InventoryGrid({items = {}, columns = 4})
local s = K.new_state(1)
s:set(2)
K.on_frame(function(dt) s.value = s:peek() + dt end)
K.Box({modifier = K.M:rotate(30, {0, 0}):scale(1.2, 0.8):draggable({
    on_event = function(e)
        if e.type == "start" then return {id = "item"} end
        if e.type == "move" then s.value = e.parent_dx + e.velocity_x end
        if e.type == "cancel" then print(e.reason, e.cancelled) end
    end
})})
UI.ItemSlot({item = {name = "item"}, drag_button = "right", on_drag_event = function(e, item)
    if e.type == "start" then return item end
end})
K.Canvas({width = 64, height = 64, draw = function(cv)
    cv:image("pack:image", {angle = 30, scale = {1, 2}, pivot = {x = 0.5, y = 0.5}, alpha = 0.5})
end})
`);
    assert.equal(result.status, 0, result.output);
});

test('LuaLS rejects incorrect Kompot props, modifiers and state values', {skip: !available && 'set KOMPOT_LUALS to LuaLS executable'}, () => {
    const result = check(`local K = require "kompot:kompot"
local UI = require "kompot:ui"
K.Column({spacing = "wrong"}, function() end)
K.M:padding("wrong")
K.Image("x", {width = "wrong"})
UI.Button({enabled = "wrong"})
local s = K.new_state(1)
s:set("wrong")
K.NoSuchThing()
`);
    assert.equal(result.status, 1, result.output);
    for (const name of ['spacing', 'padding', 'width', 'enabled', 'NoSuchThing']) {
        assert.match(result.output, new RegExp(name), result.output);
    }
});
