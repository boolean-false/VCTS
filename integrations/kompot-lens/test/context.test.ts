import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {analyze, parseAliases, callAt, wordAt, tokenize} from '../src/lua-context';
import {parseDoc} from '../src/docs';

test('member access after alias', () => {
    assert.deepEqual(analyze('local x = UI.Bu'), {kind: 'member', path: ['UI'], partial: 'Bu'});
    assert.deepEqual(analyze('UI.PALETTE.'), {kind: 'member', path: ['UI', 'PALETTE'], partial: ''});
    assert.deepEqual(analyze('local c = K.theme().colors.pri'), {kind: 'member', path: ['K', 'theme()', 'colors'], partial: 'pri'});
});

test('modifier chain', () => {
    assert.deepEqual(analyze('M:'), {kind: 'method', root: 'M', previous: null, partial: ''});
    assert.deepEqual(analyze('K.Box({modifier = M:padding(8, 4):backg'), {kind: 'method', root: 'M', previous: 'padding', partial: 'backg'});
    const c = analyze('(props.modifier or M):height(26):');
    assert.equal(c.kind, 'method');
    assert.equal((c as any).previous, 'height');
});

test('props inside component table', () => {
    assert.deepEqual(analyze('UI.Button({text = "OK", '), {kind: 'prop', callee: 'UI.Button', present: ['text'], partial: ''});
    assert.deepEqual(analyze('UI.Button{va'), {kind: 'prop', callee: 'UI.Button', present: [], partial: 'va'});
    assert.deepEqual(analyze('K.Text("hi", {st'), {kind: 'prop', callee: 'K.Text', present: [], partial: 'st'});
    // вложенная таблица - не свойства вызова
    assert.equal(analyze('UI.Choice({options = {').kind, 'none');
    // значение свойства - отдельный контекст, без кавычек
    assert.deepEqual(analyze('UI.Button({text = '), {kind: 'value-expr', callee: 'UI.Button', prop: 'text', partial: ''});
});

test('string values and arguments', () => {
    assert.deepEqual(analyze('UI.Button({variant = "pr'), {kind: 'value', callee: 'UI.Button', prop: 'variant', partial: 'pr'});
    assert.deepEqual(analyze('K.Icon("ad'), {kind: 'string-arg', callee: 'K.Icon', index: 0, partial: 'ad'});
    assert.deepEqual(analyze('local K = require "komp'), {kind: 'string-arg', callee: 'require', index: 0, partial: 'komp'});
    assert.deepEqual(analyze('local K = require("komp'), {kind: 'string-arg', callee: 'require', index: 0, partial: 'komp'});
    assert.deepEqual(analyze('UI.Button({variant = pri'), {kind: 'value-expr', callee: 'UI.Button', prop: 'variant', partial: 'pri'});
    assert.deepEqual(analyze('K.Text("x", {color = '), {kind: 'value-expr', callee: 'K.Text', prop: 'color', partial: ''});
});

test('comments and strings do not confuse the lexer', () => {
    assert.equal(analyze('-- UI.Button({\nUI.').kind, 'member');
    assert.equal(analyze('local s = "UI.Button({"\nUI.Pa').kind, 'member');
    assert.equal(tokenize('--[[ long\ncomment ]] x').length, 1);
});

test('aliases of a file', () => {
    const a = parseAliases(`local K = require "kompot:kompot"
local UI = require("kompot:ui")
local M = K.M
local Widgets = K.ui()
local t = K.theme()
local c = t.colors
local c2 = K.theme().colors`);
    assert.deepEqual(a.modules, {K: 'kompot:kompot', UI: 'kompot:ui'});
    assert.deepEqual(a.modifiers, ['M']);
    assert.deepEqual(a.ui, ['Widgets']);
    assert.deepEqual(a.themes, ['t']);
    assert.deepEqual(a.colors, ['c', 'c2']);
    const clean = parseAliases(`-- local Fake = require "kompot:kompot"
local s = 'local Phantom = require "kompot:kompot"'
local K = require "kompot:kompot"
local K2 = K
local UI = require "kompot:ui"
local t = UI.theme()
local colors = t.colors
local M = K2.M`);
    assert.deepEqual(clean.modules, {K: 'kompot:kompot', K2: 'kompot:kompot', UI: 'kompot:ui'});
    assert.deepEqual(clean.themes, ['t']);
    assert.deepEqual(clean.colors, ['colors']);
    assert.deepEqual(clean.modifiers, ['M']);
});

test('call and word under cursor', () => {
    assert.deepEqual(callAt('M:padding(8, '), {callee: 'M:padding', index: 1});
    assert.deepEqual(callAt('UI.Button({text = "a"}, fu'), {callee: 'UI.Button', index: 1});
    assert.deepEqual(wordAt('    UI.Button({text = "OK"})', 8), {expr: 'UI.Button', name: 'Button'});
    assert.deepEqual(wordAt('M:padding(8):background(c)', 16), {expr: ':background', name: 'background'});
});

test('doc comments: summary, props, enum values', () => {
    const d = parseDoc([
        'Плоская кнопка. props: text, icon (слева), on_click, on_right_click,',
        '  variant ("default"|"primary"|"danger"), selected,',
        '  size ("sm"|"md"|"lg"), item(i) (содержимое)',
        'Кнопка "toggle" с selected = true - включённое условие.',
    ]);
    assert.equal(d.summary, 'Плоская кнопка.\nКнопка "toggle" с selected = true - включённое условие.');
    assert.deepEqual(d.props.map(p => p.name), ['text', 'icon', 'on_click', 'on_right_click', 'variant', 'selected', 'size', 'item']);
    assert.deepEqual(d.props.find(p => p.name === 'variant')!.values, ['default', 'primary', 'danger']);
    assert.equal(d.props.find(p => p.name === 'icon')!.detail, 'слева');
    const m = parseDoc(['props: count (nil - точка), color, max']);
    assert.deepEqual(m.props.map(p => p.name), ['count', 'color', 'max']);
});
