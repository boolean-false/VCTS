import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {uiContractNames} from '../src/catalog';

const content = process.env.KOMPOT_CONTENT || path.resolve(__dirname, '../../../game/content');
const kompot = path.join(content, 'kompot');
const source = (name: string) => fs.readFileSync(path.join(kompot, 'modules', name), 'utf8');
const annotation = (name: string) => fs.readFileSync(path.resolve(__dirname, '../../luals/kompot/library', name), 'utf8');
const names = (text: string, pattern: RegExp) => new Set([...text.matchAll(pattern)].map(m => m[1]));
const fields = (text: string, className: string) => {
    const block = text.split(`---@class ${className}`)[1]?.split(/\n---@class /)[0] || '';
    return names(block, /^---@field ([A-Za-z_]\w*)/gm);
};
const missing = (exported: Set<string>, documented: Set<string>) => [...exported].filter(name => !documented.has(name));
const skip = !fs.existsSync(path.join(kompot, 'modules', 'kompot.lua')) ? 'Kompot pack not available' : false;

test('LuaLS definitions cover public core, modifier and built-in UI exports', {skip}, () => {
    const core = annotation('kompot.lua');
    const api = fields(core, 'KompotApi');
    const main = source('kompot.lua');
    const foundation = source('kompot/ui/foundation.lua');
    const mainExports = names(main, /^(?:K\.|function K\.)([A-Za-z_]\w*)\s*(?:=|\()/gm);
    const componentExports = names(foundation, /^(?:F\.|function F\.)([A-Za-z_]\w*)\s*(?:=|\()/gm);
    for (const name of componentExports) mainExports.add(name);
    mainExports.add('VERSION');
    assert.deepEqual(missing(mainExports, api), [], 'KompotApi');

    const modifierExports = names(source('kompot/core/modifier.lua'), /^function Mod:([A-Za-z_]\w*)\(/gm);
    assert.deepEqual(missing(modifierExports, fields(core, 'KompotModifier')), [], 'KompotModifier');

    for (const [module, className, receiver] of [
        ['kompot/core/color.lua', 'KompotColorApi', 'color'],
        ['kompot/core/text.lua', 'KompotTextApi', 'text'],
        ['kompot/fonts.lua', 'KompotFontApi', 'F'],
    ]) {
        const exported = names(source(module), new RegExp(`^(?:function ${receiver}\\.|${receiver}\\.)([A-Za-z_]\\w*)\\s*(?:=|\\()`, 'gm'));
        assert.deepEqual(missing(exported, fields(core, className)), [], className);
    }

    const ui = annotation('ui.lua');
    const uiContract = fields(ui, 'KompotUiContract');
    const uiApi = fields(ui, 'KompotUiApi: KompotUiContract');
    assert.deepEqual([...uiContractNames].sort(), [...uiContract].sort(),
        'Lens suppression matches LuaLS portable UI members');
    assert.deepEqual([...uiApi].filter(name => uiContract.has(name)), [],
        'built-in UI does not redeclare inherited component fields');
    const uiExports = names(source('ui.lua'), /^(?:UI\.|function UI\.)([A-Za-z_]\w*)\s*(?:=|\()/gm);
    const componentUiExports = names(source('ui/components.lua'), /^(?:C\.|function C\.)([A-Za-z_]\w*)\s*(?:=|\()/gm);
    for (const name of componentUiExports) uiExports.add(name);
    uiExports.add('VERSION');
    assert.deepEqual(missing(uiExports, new Set([...uiContract, ...uiApi])), [], 'KompotUiApi');
});
