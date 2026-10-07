import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {Session, findLua} from '../src/host';

const CONTENT = process.env.KOMPOT_CONTENT || path.resolve(__dirname, '../../../game/content');
const skip = !findLua() || !fs.existsSync(path.join(CONTENT, 'kompot', 'package.json'));

test('interactive session forwards Tab and Enter to Kompot', {skip}, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kompot-keys-'));
    const content = path.join(root, 'content');
    fs.mkdirSync(path.join(content, 'keys', 'modules'), {recursive: true});
    fs.symlinkSync(path.join(CONTENT, 'kompot'), path.join(content, 'kompot'));
    fs.writeFileSync(path.join(content, 'keys', 'modules', 'screen.lua'), `
local K = require "kompot:kompot"
K.preview("keys", {width = 120, height = 80}, function()
    local count = K.state(0)
    local slider = K.state(0)
    K.Column(function()
        K.Box({modifier = K.M:size(40, 20):clickable(function() count.value = count.value + 1 end)}, function()
            K.Text(tostring(count.value))
        end)
        K.Box({modifier = K.M:size(40, 20):focusable(function(key)
            if key == "right" then slider.value = slider.value + 1 end
        end)}, function()
            K.Text("v" .. slider.value)
        end)
    end)
end)
`);
    const session = new Session(content, ['keys:screen'], 'keys', [], {sandbox: false});
    const queued: any[] = [];
    let waiting: ((doc: any) => void) | null = null;
    session.onDocument = doc => {
        if (waiting) { const resolve = waiting; waiting = null; resolve(doc); }
        else queued.push(doc);
    };
    const next = () => new Promise<any>((resolve, reject) => {
        if (queued.length) return resolve(queued.shift());
        const timer = setTimeout(() => reject(new Error('session frame timeout')), 5000);
        waiting = doc => { clearTimeout(timer); resolve(doc); };
    });
    try {
        await next();
        session.frame(0, -1, -1, false, false, 0, 'tab');
        const focused = await next();
        assert.ok(focused.prims.some((p: any) => p.kind === 'border'), 'focus indicator');
        session.frame(0, -1, -1, false, false, 0, 'enter');
        const activated = await next();
        assert.ok(activated.prims.some((p: any) => p.kind === 'text' && p.text === '1'));
        session.frame(0, -1, -1, false, false, 0, 'tab');
        await next();
        session.frame(0, -1, -1, false, false, 0, 'right');
        const moved = await next();
        assert.ok(moved.prims.some((p: any) => p.kind === 'text' && p.text === 'v1'));
    } finally {
        session.dispose();
        fs.rmSync(root, {recursive: true, force: true});
    }
});
