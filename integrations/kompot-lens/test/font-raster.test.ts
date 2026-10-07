import {test} from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

const CONTENT = process.env.KOMPOT_CONTENT || path.resolve(__dirname, '../../../game/content');
const fontFile = path.join(CONTENT, 'kompot/fonts/IBMPlexSans-Regular.ttf');
test('FreeType loads without JS eval and matches native Cyrillic glyph geometry',
    {skip: !fs.existsSync(fontFile)}, async () => {
        const context = vm.createContext({URL, console, window: {},
            document: {currentScript: {src: 'file:///freetype.js'}},
            ImageData: class {
                constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
            },
        }, {codeGeneration: {strings: false, wasm: true}});
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../media/freetype.js'), 'utf8'), context);
        // Font loading is async: currentScript is gone before WASM initialization.
        context.document.currentScript = null;
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../media/font-raster.js'), 'utf8'), context);
        const ft = await context.window.KompotFreeTypeInit({
            wasmBinary: fs.readFileSync(path.join(__dirname, '../media/freetype.wasm')),
        });
        const font = new context.window.KompotRasterFont(ft, fs.readFileSync(fontFile));
        try {
            const g = font.glyph(16, 'О'.codePointAt(0));
            assert.deepEqual([g.advance,g.left,g.top,g.width,g.height], [11,0,11,11,11]);
            assert.equal(font.glyph(16,32).advance,8);
            const expected = [11,10,9,9,8,11,9,8,9,9,9,9,9];
            assert.deepEqual(Array.from('Один материал', ch => font.glyph(16,ch.codePointAt(0)).advance), expected);
            assert.strictEqual(font.glyph(16,1054),g);
        } finally {font.dispose();}
        const mono = new context.window.KompotRasterFont(
            await context.window.KompotFreeTypeInit({wasmBinary: fs.readFileSync(path.join(__dirname, '../media/freetype.wasm'))}),
            fs.readFileSync(path.join(CONTENT, 'kompot/fonts/IBMPlexMono-Regular.ttf')));
        try { assert.equal(mono.glyph(16,32).advance,8);
            assert.equal(mono.glyph(16,48).layoutAdvance,8);
            assert.equal(mono.glyph(16,48).advance,10); }
        finally {mono.dispose();}
    });
