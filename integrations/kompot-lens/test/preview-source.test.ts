import * as test from 'node:test';
import * as assert from 'node:assert/strict';
import {hasPreviews} from '../src/preview-source';

test('preview action follows declarations in any Lua module', () => {
    assert.equal(hasPreviews('local K = require "kompot:kompot"\nK.preview("Card", function() end)'), true);
    assert.equal(hasPreviews('local K = require "kompot:kompot"\nK.preview (\n  "Card", function() end)'), true);
});

test('preview action ignores comments, strings and unrelated preview methods', () => {
    assert.equal(hasPreviews('-- K.preview("Example", function() end)'), false);
    assert.equal(hasPreviews('--[[ K.preview("Example", function() end) ]]'), false);
    assert.equal(hasPreviews('local text = "K.preview(\\"Example\\")"'), false);
    assert.equal(hasPreviews('schematic.preview(1, {x = 0})'), false);
});
