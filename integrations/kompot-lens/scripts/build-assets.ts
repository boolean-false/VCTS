// Копирует в out/ то, что не собирает tsc: разметку и стили webview.
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(__dirname, '../..');
for (const [source, destination] of [
    ['media/preview.html', 'out/media/preview.html'],
    ['media/preview.css', 'out/media/preview.css'],
    ['media/FreeType-FTL.txt', 'out/media/FreeType-FTL.txt'],
    ['media/Brotli-MIT.txt', 'out/media/Brotli-MIT.txt'],
]) {
    const target = path.join(root, destination);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.copyFileSync(path.join(root, source), target);
}

// FreeType's ESM loader is exposed as a local classic script for the webview.
const vendor = path.join(root, 'node_modules/freetype-wasm');
let loader = fs.readFileSync(path.join(vendor, 'dist/freetype.js'), 'utf8')
    .replace('var _scriptDir = import.meta.url;', 'var _scriptDir = document.currentScript.src;')
    .replaceAll('import.meta.url', '_scriptDir')
    .replace('export default FreeType;', 'window.KompotFreeTypeInit = FreeType;');
// Embind's generated wrappers normally use Function(). Equivalent closures keep
// the webview CSP strict: only WASM compilation is allowed, no JavaScript eval.
function replaceWrapper(name: string, next: string, replacement: string): void {
    const start = loader.indexOf(`function ${name}(`);
    const end = loader.indexOf(next, start);
    if (start < 0 || end < 0) throw new Error(`FreeType wrapper missing: ${name}`);
    loader = loader.slice(0, start) + replacement + loader.slice(end);
}
replaceWrapper('createNamedFunction', 'function extendError(', `
function createNamedFunction(name, body) {
    var fn = function() { return body.apply(this, arguments); };
    Object.defineProperty(fn, 'name', {value: makeLegalFunctionName(name)});
    return fn;
}`);
replaceWrapper('craftEmvalAllocator', 'var emval_newers=', `
function craftEmvalAllocator(argCount) {
    return function(constructor, argTypes, args) {
        var values = [];
        for (var i = 0; i < argCount; i++) {
            var type = requireRegisteredType(Module.HEAP32[(argTypes >>> 2) + i], 'parameter ' + i);
            values.push(type.readValueFromPointer(args));
            args += type.argPackAdvance;
        }
        return Emval.toHandle(Reflect.construct(constructor, values));
    };
}`);
replaceWrapper('craftInvokerFunction', 'function ensureOverloadTable(', `
function craftInvokerFunction(name, types, classType, invoker, target) {
    var method = types[1] !== null && classType !== null;
    var stackNeeded = types.slice(1).some(t => t !== null && t.destructorFunction === undefined);
    return createNamedFunction(name, function() {
        if (arguments.length !== types.length - 2) throwBindingError('Invalid argument count for ' + name);
        var destructors = stackNeeded ? [] : null;
        var wired = [target];
        if (method) wired.push(types[1].toWireType(destructors, this));
        for (var i = 0; i < arguments.length; i++) wired.push(types[i + 2].toWireType(destructors, arguments[i]));
        var result = invoker.apply(null, wired);
        if (stackNeeded) runDestructors(destructors);
        else for (var i = method ? 1 : 2; i < types.length; i++) {
            if (types[i].destructorFunction !== null) types[i].destructorFunction(wired[method ? i : i - 1]);
        }
        if (types[0].name !== 'void') return types[0].fromWireType(result);
    });
}`);
replaceWrapper('__emval_get_method_caller', 'function __emval_get_property(', `
function __emval_get_method_caller(argCount, argTypes) {
    var types = __emval_lookupTypes(argCount, argTypes), retType = types[0];
    var signature = retType.name + '_$' + types.slice(1).map(t => t.name).join('_') + '$';
    if (emval_registeredMethods[signature] !== undefined) return emval_registeredMethods[signature];
    var caller = function(handle, name, destructors, args) {
        var values = [];
        for (var i = 1; i < types.length; i++) {
            values.push(types[i].readValueFromPointer(args));
            args += types[i].argPackAdvance;
        }
        var result = handle[name].apply(handle, values);
        for (var i = 1; i < types.length; i++) if (types[i].deleteObject) types[i].deleteObject(values[i - 1]);
        if (!retType.isVoid) return retType.toWireType(destructors, result);
    };
    return emval_registeredMethods[signature] = __emval_addMethodCaller(caller);
}`);
fs.writeFileSync(path.join(root, 'out/media/freetype.js'), loader);
fs.copyFileSync(path.join(vendor, 'dist/freetype.wasm'), path.join(root, 'out/media/freetype.wasm'));
fs.copyFileSync(path.join(vendor, 'LICENSE'), path.join(root, 'out/media/freetype-wasm-MIT.txt'));

// A universal, offline interpreter: Node loader + Lua 5.4 WebAssembly.
const runtime = path.join(root, 'out/runtime');
fs.mkdirSync(runtime, {recursive: true});
require('esbuild').buildSync({entryPoints: [path.join(root, 'src/runtime.ts')],
    outfile: path.join(runtime, 'lua.js'), bundle: true, platform: 'node', target: 'node22', minify: true});
fs.copyFileSync(path.join(root, 'node_modules/wasmoon/dist/glue.wasm'), path.join(runtime, 'lua.wasm'));
fs.copyFileSync(path.join(root, 'node_modules/wasmoon/LICENSE'), path.join(runtime, 'Wasmoon-MIT.txt'));
require('esbuild').buildSync({entryPoints: [path.join(root, 'src/luals.ts')],
    outfile: path.join(root, 'out/src/luals.js'), bundle: true, platform: 'node',
    external: ['vscode'], mainFields: ['module', 'main'], target: 'node22'});

fs.copyFileSync(path.join(root, 'node_modules/jsonc-parser/LICENSE.md'), path.join(runtime, 'jsonc-parser-MIT.txt'));
fs.copyFileSync(path.join(root, 'lua/Lua-MIT.txt'), path.join(runtime, 'Lua-MIT.txt'));

fs.rmSync(path.join(root, 'out/src/runtime.js'), {force: true});
fs.rmSync(path.join(root, 'out/src/runtime.js.map'), {force: true});
