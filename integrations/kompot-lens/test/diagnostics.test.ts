import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import {errorLines} from '../src/errors';

test('error lines of the current file', () => {
    const file = '/home/u/game/content/pack/modules/pack/screen.lua';
    const err = '/home/u/game/content/pack/modules/pack/screen.lua:12: attempt to index a nil value\nstack traceback:\n\t/home/u/game/content/kompot/modules/kompot/core/runtime.lua:240: in function\n\t...ame/content/pack/modules/pack/screen.lua:30: in function';
    assert.deepEqual(errorLines(err, file), [12, 30]);
    assert.deepEqual(errorLines('[string "other.lua"]:5: boom', file), []);
});
